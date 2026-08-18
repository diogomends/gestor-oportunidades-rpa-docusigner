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

/**
 * Coleta todas as ROBOT_API_KEY_* do env (ex: ROBOT_API_KEY_1, ROBOT_API_KEY_2, ...).
 * Retorna array ordenado por índice: [{ index: 1, key: "rf_..." }, ...]
 */
function resolveAllKeys(rootEnv) {
  const keys = [];
  for (const [k, v] of Object.entries(rootEnv)) {
    const m = k.match(/^ROBOT_API_KEY_(\d+)$/);
    if (m && v) keys.push({ index: parseInt(m[1], 10), key: v });
  }
  keys.sort((a, b) => a.index - b.index);
  return keys;
}

// ── Resolução de chaves ──
const rootEnv = loadRootEnv();
const { key: cliKey, headless: argHeadless, apiUrl } = parseArgs();

const detectedKeys = [];
if (cliKey) {
  // CLI --key: build único com chave explícita
  detectedKeys.push({ index: 1, key: cliKey });
} else {
  // Auto-detecção: todas as ROBOT_API_KEY_* do .env.dev / .env
  detectedKeys.push(...resolveAllKeys(rootEnv));
  // Fallback: ROBOT_KEY / ROBOT_API_KEY (sem sufixo numérico)
  if (detectedKeys.length === 0) {
    const fallback = process.env.ROBOT_KEY || process.env.ROBOT_API_KEY || rootEnv.ROBOT_KEY || rootEnv.ROBOT_API_KEY || "";
    if (fallback) detectedKeys.push({ index: 1, key: fallback });
  }
}

if (detectedKeys.length === 0) {
  console.error("==================================================");
  console.error(" [ERRO] Nenhuma chave do robô encontrada.");
  console.error(" Configure ROBOT_API_KEY_1, ROBOT_API_KEY_2, ... no .env.dev");
  console.error(" ou use --key \"rf_sec_sua_chave\" na linha de comando.");
  console.error("==================================================");
  process.exit(1);
}

// URL de produção (comum a todos os builds)
const targetApiUrl = (apiUrl || process.env.API_URL || rootEnv.API_URL || rootEnv.URI_PROD || "http://localhost:3111").replace(/\/$/, "");

// Headless resolvido (comum a todos os builds)
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
console.log(` Chaves detectadas:          ${detectedKeys.length}`);
for (const dk of detectedKeys) {
  console.log(`   [${dk.index}] ${dk.key.substring(0, 10)}...`);
}
console.log(` Modo Headless:              ${isHeadless}`);
console.log("==================================================");

for (const dir of [DIST_DIR, BUNDLE_DIR, OBF_DIR, JSC_DIR]) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Pipeline de build para uma única chave.
 */
async function buildForOneKey({ buildKey, index, total }) {
  const tag = total > 1 ? `-${index}` : "";
  const bundleBase = `robot-docusigner${tag}`;
  const outDir = path.join(DIST_DIR, bundleBase);
  fs.mkdirSync(outDir, { recursive: true });
  const entryFile = path.join(ROOT_DIR, "src", "main.js");

  console.log(`\n--- [${index}/${total}] Build para chave ${buildKey.substring(0, 10)}... ---`);

  // ── Etapa 1: Bundle com esbuild ──
  console.log(` 1/4 Empacotando com esbuild (ESM -> CJS + Defines)...`);
  const bundleOut = path.join(BUNDLE_DIR, `main-${bundleBase}.cjs`);

  const defineArgs = [
    `--define:process.env.API_URL='"${targetApiUrl}"'`,
    `--define:process.env.ROBOT_KEY='"${buildKey}"'`,
    `--define:process.env.HEADLESS="${isHeadless}"`,
  ].join(" ");

  execSync(
    `npx esbuild "${entryFile}" --bundle --platform=node --format=cjs --target=node18 --external:playwright --external:bytenode ${defineArgs} --outfile="${bundleOut}"`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  // ── Etapa 2: Ofuscação ──
  console.log(` 2/4 Ofuscando código-fonte...`);
  const obfOut = path.join(OBF_DIR, `main-${bundleBase}.cjs`);

  execSync(
    `npx javascript-obfuscator "${bundleOut}" --output "${obfOut}" --compact true --control-flow-flattening true --dead-code-injection false --string-array true --string-array-encoding base64`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  // ── Etapa 3: Bytecode V8 ──
  console.log(` 3/4 Compilando para Bytecode V8 (.jsc)...`);
  const jscOut = path.join(JSC_DIR, `main-${bundleBase}.jsc`);

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

const jscFilename = 'main-${bundleBase}.jsc';
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
  const loaderFile = path.join(JSC_DIR, `index-${bundleBase}.cjs`);
  fs.writeFileSync(loaderFile, loaderContent, "utf-8");

  // ── Etapa 4: Gerar executável com @yao-pkg/pkg ──
  console.log(` 4/4 Empacotando binário .exe...`);

  const exeOut = path.join(outDir, `${bundleBase}.exe`);
  fs.copyFileSync(jscOut, path.join(outDir, `main-${bundleBase}.jsc`));

  execSync(
    `npx @yao-pkg/pkg "${loaderFile}" --target node18-win-x64 --output "${exeOut}"`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  console.log(` -> OK: ${exeOut}`);
  return { exe: exeOut, jsc: path.join(outDir, `main-${bundleBase}.jsc`) };
}

// ── Execução ──
async function main() {
  const results = [];

  for (const dk of detectedKeys) {
    try {
      const r = await buildForOneKey({ buildKey: dk.key, index: dk.index, total: detectedKeys.length });
      results.push({ ...dk, ...r, ok: true });
    } catch (error) {
      console.error(`\n [ERRO] Build falhou para chave ${dk.index} (${dk.key.substring(0, 10)}...):`, error.message);
      results.push({ ...dk, ok: false, error: error.message });
    }
  }

  // ── Resumo ──
  console.log("\n==================================================");
  console.log(` Build concluído. Arquivos em ${DIST_DIR}:`);
  const okCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;
  for (const r of results) {
    const status = r.ok ? "OK" : "FALHA";
    const folder = r.ok ? path.basename(path.dirname(r.exe)) : "";
    console.log(`   [${status}] ${r.index}) ${r.ok ? `${folder}/` : r.error}`);
  }
  console.log(`\n Sucesso: ${okCount}/${results.length}`);
  if (failCount > 0) console.log(` Falhas:  ${failCount}/${results.length}`);
  console.log("==================================================");

  if (failCount > 0) process.exit(1);
}

main();
