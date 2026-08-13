import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT_DIR = path.resolve(process.cwd(), "robot-standalone");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const BUNDLE_DIR = path.join(ROOT_DIR, "dist-bundle");
const OBF_DIR = path.join(ROOT_DIR, "dist-obf");
const JSC_DIR = path.join(ROOT_DIR, "dist-jsc");

console.log("==================================================");
console.log("🔨 Iniciando Pipeline de Build Protegido do Robô");
console.log("==================================================");

// 1. Limpeza de pastas anteriores
for (const dir of [DIST_DIR, BUNDLE_DIR, OBF_DIR, JSC_DIR]) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

try {
  // 2. Etapa 1: Bundle com esbuild (converte ESM para CommonJS bundle com dependências)
  console.log("\n📦 [1/4] Empacotando com esbuild (ESM -> CJS)...");
  const entryFile = path.join(ROOT_DIR, "src", "main.js");
  const bundleOut = path.join(BUNDLE_DIR, "main.cjs");

  execSync(
    `npx esbuild "${entryFile}" --bundle --platform=node --format=cjs --target=node18 --external:playwright --external:bytenode --outfile="${bundleOut}"`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  // 3. Etapa 2: Ofuscação com javascript-obfuscator
  console.log("\n🛡️ [2/4] Ofuscando código-fonte com javascript-obfuscator...");
  const obfOut = path.join(OBF_DIR, "main.cjs");

  execSync(
    `npx javascript-obfuscator "${bundleOut}" --output "${obfOut}" --compact true --control-flow-flattening true --dead-code-injection false --string-array true --string-array-encoding base64`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  // 4. Etapa 3: Compilação para Bytecode V8 com bytenode
  console.log("\n⚡ [3/4] Compilando para Bytecode V8 (.jsc) com bytenode...");
  const jscOut = path.join(JSC_DIR, "main.jsc");

  execSync(`npx bytenode -c "${obfOut}" -o "${jscOut}"`, {
    stdio: "inherit",
    cwd: ROOT_DIR,
  });

  // Criar o loader CommonJS que carrega o .jsc
  const loaderContent = `
const bytenode = require('bytenode');
const path = require('path');
const fs = require('fs');

const jscPath = path.join(__dirname, 'main.jsc');
if (fs.existsSync(jscPath)) {
  require(jscPath);
} else {
  console.error('[Loader] Arquivo bytecode main.jsc não encontrado!');
  process.exit(1);
}
`;
  const loaderFile = path.join(JSC_DIR, "index.cjs");
  fs.writeFileSync(loaderFile, loaderContent, "utf-8");

  // Copiar config.json.example para dist
  fs.copyFileSync(
    path.join(ROOT_DIR, "config.json.example"),
    path.join(DIST_DIR, "config.json.example")
  );

  // 5. Etapa 4: Empacotamento em executável Windows .exe com @yao-pkg/pkg
  console.log("\n🚀 [4/4] Gerando Executável .exe com @yao-pkg/pkg...");
  const exeOut = path.join(DIST_DIR, "robot-docusigner.exe");

  execSync(
    `npx @yao-pkg/pkg "${loaderFile}" --target node18-win-x64 --output "${exeOut}"`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  console.log("\n==================================================");
  console.log("✅ Build protegido concluído com sucesso!");
  console.log(`📁 Executável gerado em: ${exeOut}`);
  console.log("==================================================");
} catch (error) {
  console.error("\n❌ Erro durante o pipeline de build:", error.message);
  process.exit(1);
}
