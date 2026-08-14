import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT_DIR = path.resolve(process.cwd(), "robot-standalone");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const BUNDLE_DIR = path.join(ROOT_DIR, "dist-bundle");
const OBF_DIR = path.join(ROOT_DIR, "dist-obf");
const JSC_DIR = path.join(ROOT_DIR, "dist-jsc");

// ── Parse CLI args: --ids "id1,id2,id3" --headless true/false ──
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { ids: [], headless: true };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ids" && args[i + 1]) {
      const raw = args[++i].trim();
      if (raw) {
        result.ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    if (args[i] === "--headless" && args[i + 1]) {
      const raw = args[++i].trim();
      if (raw) {
        result.headless = raw === "true" || raw === "1";
      }
    }
  }
  return result;
}

const { ids, headless } = parseArgs();
const multiBuild = ids.length > 0;

// ── Limpeza ──
console.log("==================================================");
console.log(" Iniciando Pipeline de Build Protegido do Robo");
if (multiBuild) {
  console.log(` Modo: MULTI-ROBOT | IDs: [${ids.join(", ")}] | Headless: ${headless}`);
} else {
  console.log(" Modo: SINGLE-ROBOT (sem --ids)");
}
console.log("==================================================");

for (const dir of [DIST_DIR, BUNDLE_DIR, OBF_DIR, JSC_DIR]) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

try {
  // ── Etapa 1: Bundle com esbuild ──
  console.log("\n [1/4] Empacotando com esbuild (ESM -> CJS)...");
  const entryFile = path.join(ROOT_DIR, "src", "main.js");
  const bundleOut = path.join(BUNDLE_DIR, "main.cjs");

  execSync(
    `npx esbuild "${entryFile}" --bundle --platform=node --format=cjs --target=node18 --external:playwright --external:bytenode --outfile="${bundleOut}"`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  // ── Etapa 2: Ofuscacao ──
  console.log("\n [2/4] Ofuscando codigo-fonte...");
  const obfOut = path.join(OBF_DIR, "main.cjs");

  execSync(
    `npx javascript-obfuscator "${bundleOut}" --output "${obfOut}" --compact true --control-flow-flattening true --dead-code-injection false --string-array true --string-array-encoding base64`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  // ── Etapa 3: Bytecode V8 ──
  console.log("\n [3/4] Compilando para Bytecode V8 (.jsc)...");
  const jscOut = path.join(JSC_DIR, "main.jsc");

  execSync(`npx bytenode -c "${obfOut}" -o "${jscOut}"`, {
    stdio: "inherit",
    cwd: ROOT_DIR,
  });

  // Loader que carrega o .jsc
  const loaderContent = `
const bytenode = require('bytenode');
const path = require('path');
const fs = require('fs');

const jscPath = path.join(__dirname, 'main.jsc');
if (fs.existsSync(jscPath)) {
  require(jscPath);
} else {
  console.error('[Loader] Arquivo bytecode main.jsc nao encontrado!');
  process.exit(1);
}
`;
  const loaderFile = path.join(JSC_DIR, "index.cjs");
  fs.writeFileSync(loaderFile, loaderContent, "utf-8");

  // ── Etapa 4: Gerar executavel(is) ──
  if (multiBuild) {
    // Modo multi-robot: um .exe + config.json por ID
    console.log(`\n [4/4] Gerando ${ids.length} executavel(is)...`);

    for (const robotId of ids) {
      const robotDist = path.join(DIST_DIR, robotId);
      fs.mkdirSync(robotDist, { recursive: true });

      // Config.json para este robot
      const configObj = {
        API_URL: "http://localhost:3111",
        ROBOT_ID: robotId,
        ROBOT_EMAIL: "robot@gestordeoportunidades.com.br",
        ROBOT_PASS: "SUA_SENHA_AQUI",
        HEADLESS: headless,
        POLL_INTERVAL_SECONDS: 15,
      };
      fs.writeFileSync(path.join(robotDist, "config.json"), JSON.stringify(configObj, null, 2), "utf-8");

      // Gerar .exe
      const exeOut = path.join(robotDist, `robot-${robotId}.exe`);
      console.log(`\n  -> Build: ${robotId} (headless=${headless})`);

      execSync(
        `npx @yao-pkg/pkg "${loaderFile}" --target node18-win-x64 --output "${exeOut}"`,
        { stdio: "inherit", cwd: ROOT_DIR }
      );

      console.log(`  -> OK: ${exeOut}`);
    }

    console.log("\n==================================================");
    console.log(` Build concluido: ${ids.length} executavel(is) em ${DIST_DIR}`);
    for (const robotId of ids) {
      console.log(`   - ${robotId}/robot-${robotId}.exe + config.json`);
    }
    console.log("==================================================");
  } else {
    // Modo single (comportamento original)
    console.log("\n [4/4] Gerando Executavel .exe com @yao-pkg/pkg...");
    const exeOut = path.join(DIST_DIR, "robot-docusigner.exe");

    // Copiar config.json.example para dist
    fs.copyFileSync(
      path.join(ROOT_DIR, "config.json.example"),
      path.join(DIST_DIR, "config.json.example")
    );

    execSync(
      `npx @yao-pkg/pkg "${loaderFile}" --target node18-win-x64 --output "${exeOut}"`,
      { stdio: "inherit", cwd: ROOT_DIR }
    );

    console.log("\n==================================================");
    console.log(" Build protegido concluido com sucesso!");
    console.log(` Executavel gerado em: ${exeOut}`);
    console.log("==================================================");
  }
} catch (error) {
  console.error("\n Erro durante o pipeline de build:", error.message);
  process.exit(1);
}
