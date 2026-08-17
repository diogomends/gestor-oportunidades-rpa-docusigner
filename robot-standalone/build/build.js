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
 * Lê o arquivo .env na raiz do projeto.
 */
function loadRootEnv() {
  const envPath = path.resolve(ROOT_DIR, "..", ".env");
  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
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
    ids: [],
    emails: [],
    passwords: [],
    email: "",
    pass: "",
    headless: true,
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

    if (arg === "--ids" && nextVal) {
      result.ids = nextVal.split(",").map((s) => s.trim()).filter(Boolean);
    } else if ((arg === "--emails" || arg === "--email" || arg === "--ROBOT_EMAIL") && nextVal) {
      if (nextVal.includes(",")) {
        result.emails = nextVal.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        result.email = nextVal;
        result.emails.push(nextVal);
      }
    } else if ((arg === "--passwords" || arg === "--pass" || arg === "--password" || arg === "--ROBOT_PASS") && nextVal) {
      if (nextVal.includes(",")) {
        result.passwords = nextVal.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        result.pass = nextVal;
        result.passwords.push(nextVal);
      }
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
const { ids, emails, passwords, email, pass, headless, apiUrl } = parseArgs();
const multiBuild = ids.length > 0;

// URL de produção obtida do .env raiz ou parâmetro
const targetApiUrl = (apiUrl || process.env.API_URL || rootEnv.URI_PROD || "http://localhost:3111").replace(/\/$/, "");

// Monta lista de alvos de build
const targets = multiBuild
  ? ids.map((id, index) => ({
      id,
      email: emails[index] || emails[0] || email || "robot@gestordeoportunidades.com.br",
      pass: passwords[index] || passwords[0] || pass || "",
      headless,
    }))
  : [
      {
        id: "robot-docusigner",
        email: email || emails[0] || "robot@gestordeoportunidades.com.br",
        pass: pass || passwords[0] || "",
        headless,
      },
    ];

// ── Limpeza ──
console.log("==================================================");
console.log(" Iniciando Pipeline de Build Protegido do Robo");
console.log(` Servidor Central (API_URL): ${targetApiUrl}`);
if (multiBuild) {
  console.log(` Modo: MULTI-ROBOT | Qtd: ${targets.length} | Headless: ${headless}`);
  targets.forEach((t, i) => console.log(`   [${i + 1}] ID: ${t.id} | Email: ${t.email}`));
} else {
  console.log(` Modo: SINGLE-ROBOT | Email: ${targets[0].email} | Headless: ${headless}`);
}
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

    for (let idx = 0; idx < targets.length; idx++) {
      const target = targets[idx];
      const prefix = `[${idx + 1}/${targets.length}] (${target.id})`;

      console.log(`\n--- ${prefix} Compilando executavel embutido ---`);

      // ── Etapa 1: Bundle com esbuild (Injeção de Defines em tempo de compilação) ──
      console.log(` ${prefix} 1/4 Empacotando com esbuild (ESM -> CJS + Defines)...`);
      const bundleOut = path.join(BUNDLE_DIR, `main-${target.id}.cjs`);

      const defineArgs = [
        `--define:process.env.API_URL='"${targetApiUrl}"'`,
        `--define:process.env.ROBOT_ID='"${target.id}"'`,
        `--define:process.env.ROBOT_EMAIL='"${target.email}"'`,
        `--define:process.env.ROBOT_PASS='"${target.pass}"'`,
        `--define:process.env.HEADLESS="${target.headless}"`,
      ].join(" ");

      execSync(
        `npx esbuild "${entryFile}" --bundle --platform=node --format=cjs --target=node18 --external:playwright --external:bytenode ${defineArgs} --outfile="${bundleOut}"`,
        { stdio: "inherit", cwd: ROOT_DIR }
      );

      // ── Etapa 2: Ofuscação ──
      console.log(` ${prefix} 2/4 Ofuscando codigo-fonte...`);
      const obfOut = path.join(OBF_DIR, `main-${target.id}.cjs`);

      execSync(
        `npx javascript-obfuscator "${bundleOut}" --output "${obfOut}" --compact true --control-flow-flattening true --dead-code-injection false --string-array true --string-array-encoding base64`,
        { stdio: "inherit", cwd: ROOT_DIR }
      );

      // ── Etapa 3: Bytecode V8 ──
      console.log(` ${prefix} 3/4 Compilando para Bytecode V8 (.jsc)...`);
      const jscOut = path.join(JSC_DIR, `main-${target.id}.jsc`);

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

const jscFilename = 'main-${target.id}.jsc';
const localJsc = path.join(__dirname, jscFilename);
const externalJsc = path.join(path.dirname(process.execPath), jscFilename);
const jscPath = fs.existsSync(localJsc) ? localJsc : externalJsc;

if (fs.existsSync(jscPath)) {
  require(jscPath);
} else {
  console.error('[Loader] Arquivo bytecode ' + jscFilename + ' nao encontrado!');
  process.exit(1);
}
`;
      const loaderFile = path.join(JSC_DIR, `index-${target.id}.cjs`);
      fs.writeFileSync(loaderFile, loaderContent, "utf-8");

      // ── Etapa 4: Gerar executavel com @yao-pkg/pkg ──
      console.log(` ${prefix} 4/4 Empacotando binario .exe...`);

      let targetDir = DIST_DIR;
      let exeOut = path.join(DIST_DIR, "robot-docusigner.exe");

      if (multiBuild) {
        targetDir = path.join(DIST_DIR, target.id);
        fs.mkdirSync(targetDir, { recursive: true });
        exeOut = path.join(targetDir, `robot-${target.id}.exe`);
      }

      // Copia o arquivo .jsc para a pasta de distribuicao ao lado do .exe
      fs.copyFileSync(jscOut, path.join(targetDir, `main-${target.id}.jsc`));

      execSync(
        `npx @yao-pkg/pkg "${loaderFile}" --target node18-win-x64 --output "${exeOut}"`,
        { stdio: "inherit", cwd: ROOT_DIR }
      );

      console.log(` -> OK: ${exeOut}`);
    }

    console.log("\n==================================================");
    console.log(` Build concluido com sucesso! ${targets.length} executavel(is) gerado(s) em ${DIST_DIR}`);
    if (multiBuild) {
      for (const target of targets) {
        console.log(`   - ${target.id}/robot-${target.id}.exe (Credenciais embutidas)`);
      }
    } else {
      console.log(`   - robot-docusigner.exe (Credenciais embutidas)`);
    }
    console.log(" Zero arquivos json expostos no disco de distribuicao.");
    console.log("==================================================");
  } catch (error) {
    console.error("\n Erro durante o pipeline de build:", error.message);
    process.exit(1);
  }
}

runBuild();


