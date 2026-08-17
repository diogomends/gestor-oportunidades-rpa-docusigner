import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
 * Parse CLI args: --ids "id1,id2" --emails "e1,e2" --passwords "p1,p2" --email "e" --pass "p" --headless true/false
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    ids: [],
    emails: [],
    passwords: [],
    email: "",
    pass: "",
    headless: true,
    apiUrl: "",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const val = args[i + 1] ? args[++i].trim() : "";
    if (arg === "--ids" && val) {
      result.ids = val.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--emails" && val) {
      result.emails = val.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--passwords" && val) {
      result.passwords = val.split(",").map((s) => s.trim()).filter(Boolean);
    } else if ((arg === "--email" || arg === "--ROBOT_EMAIL") && val) {
      result.email = val;
    } else if ((arg === "--pass" || arg === "--password" || arg === "--ROBOT_PASS") && val) {
      result.pass = val;
    } else if (arg === "--headless" && val) {
      result.headless = val === "true" || val === "1";
    } else if ((arg === "--api-url" || arg === "--uri-prod") && val) {
      result.apiUrl = val;
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

    execSync(`npx bytenode -c "${obfOut}" -o "${jscOut}"`, {
      stdio: "inherit",
      cwd: ROOT_DIR,
    });

    // Loader que carrega o .jsc
    const loaderContent = `
const bytenode = require('bytenode');
const path = require('path');
const fs = require('fs');

const jscPath = path.join(__dirname, 'main-${target.id}.jsc');
if (fs.existsSync(jscPath)) {
  require(jscPath);
} else {
  console.error('[Loader] Arquivo bytecode main-${target.id}.jsc nao encontrado!');
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

