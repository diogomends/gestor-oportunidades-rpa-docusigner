import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import bytenode from "bytenode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const BUNDLE_DIR = path.join(ROOT_DIR, "dist-bundle");
const OBF_DIR = path.join(ROOT_DIR, "dist-obf");
const JSC_DIR = path.join(ROOT_DIR, "dist-jsc");

/**
 * Lê o arquivo .env.dev ou .env na raiz do projeto.
 */
function loadRootEnv() {
  const envDevPath = path.resolve(ROOT_DIR, "..", ".env.dev");
  const envPath = path.resolve(ROOT_DIR, "..", ".env");
  const pathToLoad = fs.existsSync(envDevPath) ? envDevPath : (fs.existsSync(envPath) ? envPath : null);
  const env = {};
  if (pathToLoad) {
    const content = fs.readFileSync(pathToLoad, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  }
  return env;
}

/**
 * Parse CLI args suportando argumentos posicionais, --flag "val" e flags vazias
 */
function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const result = {
    key: "",
    headless: null,
    apiUrl: "",
  };

  const cleanArgs = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const item = rawArgs[i].trim();
    if (!item) continue;
    if (item.includes("=") && item.startsWith("--")) {
      const [k, ...rest] = item.split("=");
      cleanArgs.push(k, rest.join("="));
    } else {
      cleanArgs.push(item);
    }
  }

  for (let i = 0; i < cleanArgs.length; i++) {
    const arg = cleanArgs[i];
    let nextVal = "";
    if (cleanArgs[i + 1] && !cleanArgs[i + 1].startsWith("--")) {
      nextVal = cleanArgs[++i].trim();
    }

    if ((arg === "--key" || arg === "--robot-key" || arg === "--keys" || arg === "--ROBOT_KEY") && nextVal) {
      result.key = nextVal;
    } else if (arg === "--headless" && nextVal) {
      const low = nextVal.toLowerCase();
      result.headless = !(low === "false" || low === "0" || low === "no" || low === "off");
    } else if ((arg === "--api-url" || arg === "--uri-prod") && nextVal) {
      result.apiUrl = nextVal;
    }
  }
  return result;
}

const rootEnv = loadRootEnv();
const { key, headless: argHeadless, apiUrl } = parseArgs();

// Chave do robô (CLI > ROBOT_KEY > ROBOT_API_KEY > ROBOT_API_KEY_1 no .env.dev/.env)
const resolvedKey = key || process.env.ROBOT_KEY || process.env.ROBOT_API_KEY || rootEnv.ROBOT_KEY || rootEnv.ROBOT_API_KEY || rootEnv.ROBOT_API_KEY_1 || "";

if (!resolvedKey) {
  console.error("==================================================");
  console.error(" [ERRO] A chave do robô (--key) é obrigatória para o build.");
  console.error(" Exemplo de uso:");
  console.error('   node build/build.js --key "rf_sec_sua_chave"');
  console.error("==================================================");
  process.exit(1);
}

// URL de produção obtida do parâmetro, .env.dev / .env raiz ou fallback padrão
const targetApiUrl = (apiUrl || process.env.API_URL || rootEnv.API_URL || rootEnv.URI_PROD || "http://localhost:3111").replace(/\/$/, "");

// Headless resolvido com fallback para rootEnv.HEADLESS ou true
const isHeadless = argHeadless !== null
  ? argHeadless
  : (process.env.HEADLESS !== undefined
      ? !(process.env.HEADLESS === "false" || process.env.HEADLESS === "0")
      : (rootEnv.HEADLESS !== undefined
          ? !(rootEnv.HEADLESS === "false" || rootEnv.HEADLESS === "0")
          : true));

// ── Limpeza ──
console.log("==================================================");
console.log(" Iniciando Pipeline de Build Protegido do Robô");
console.log(` Servidor Central (API_URL): ${targetApiUrl}`);
console.log(` Chave do Robô (KEY):        ${resolvedKey.substring(0, 10)}...`);
console.log(` Modo Headless:              ${isHeadless}`);
console.log("==================================================");

for (const dir of [DIST_DIR, BUNDLE_DIR, OBF_DIR, JSC_DIR]) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

async function runBuild() {
  try {
    const entryFile = path.join(ROOT_DIR, "src", "main.js");
    const bundleName = "robot-docusigner";

    console.log(`\n--- Compilando executável standalone ---`);

    // ── Etapa 1: Bundle com esbuild (Injeção de Defines em tempo de compilação) ──
    console.log(` 1/4 Empacotando com esbuild (ESM -> CJS + Defines)...`);
    const bundleOut = path.join(BUNDLE_DIR, `main-${bundleName}.cjs`);

    const defineArgs = [
      `--define:process.env.API_URL='"${targetApiUrl}"'`,
      `--define:process.env.ROBOT_KEY='"${resolvedKey}"'`,
      `--define:process.env.HEADLESS="${isHeadless}"`,
    ].join(" ");

    execSync(
      `npx esbuild "${entryFile}" --bundle --platform=node --format=cjs --target=node18 --external:playwright --external:bytenode ${defineArgs} --outfile="${bundleOut}"`,
      { stdio: "inherit", cwd: ROOT_DIR }
    );

    // ── Etapa 2: Ofuscação ──
    console.log(` 2/4 Ofuscando código-fonte...`);
    const obfOut = path.join(OBF_DIR, `main-${bundleName}.cjs`);

    execSync(
      `npx javascript-obfuscator "${bundleOut}" --output "${obfOut}" --compact true --control-flow-flattening true --dead-code-injection false --string-array true --string-array-encoding base64`,
      { stdio: "inherit", cwd: ROOT_DIR }
    );

    // ── Etapa 3: Bytecode V8 ──
    console.log(` 3/4 Compilando para Bytecode V8 (.jsc)...`);
    const jscOut = path.join(JSC_DIR, `main-${bundleName}.jsc`);

    await bytenode.compileFile({
      filename: obfOut,
      output: jscOut,
      compileAsModule: true,
    });

    // Loader que carrega o .jsc
    const loaderContent = `
const bytenode = require('bytenode');
const path = require('path');
const fs = require('fs');

const jscFilename = 'main-${bundleName}.jsc';
const localJsc = path.join(__dirname, jscFilename);
const externalJsc = path.join(path.dirname(process.execPath), jscFilename);
const jscPath = fs.existsSync(localJsc) ? localJsc : externalJsc;

if (fs.existsSync(jscPath)) {
  require(jscPath);
} else {
  console.error('[Loader] Arquivo bytecode ' + jscFilename + ' não encontrado!');
  process.exit(1);
}
`;
    const loaderFile = path.join(JSC_DIR, `index-${bundleName}.cjs`);
    fs.writeFileSync(loaderFile, loaderContent, "utf-8");

    // ── Etapa 4: Gerar executável com @yao-pkg/pkg ──
    console.log(` 4/4 Empacotando binário .exe...`);

    const exeOut = path.join(DIST_DIR, "robot-docusigner.exe");

    // Copia o arquivo .jsc para a pasta de distribuição ao lado do .exe
    fs.copyFileSync(jscOut, path.join(DIST_DIR, `main-${bundleName}.jsc`));

    execSync(
      `npx @yao-pkg/pkg "${loaderFile}" --target node18-win-x64 --output "${exeOut}"`,
      { stdio: "inherit", cwd: ROOT_DIR }
    );

    console.log(` -> OK: ${exeOut}`);

    console.log("\n==================================================");
    console.log(` Build concluído com sucesso em ${DIST_DIR}:`);
    console.log(`   - dist/robot-docusigner.exe (Loader)`);
    console.log(`   - dist/main-robot-docusigner.jsc (Bytecode com chave embutida)`);
    console.log(" Zero arquivos json expostos no disco de distribuição.");
    console.log("==================================================");
  } catch (error) {
    console.error("\n Erro durante o pipeline de build:", error.message);
    process.exit(1);
  }
}

runBuild();


