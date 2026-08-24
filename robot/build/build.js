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
  const candidatePaths = [
    path.resolve(ROOT_DIR, "..", ".env.dev"),
    path.resolve(ROOT_DIR, "..", ".env"),
    path.resolve(ROOT_DIR, "..", "backend", ".env.dev"),
    path.resolve(ROOT_DIR, "..", "backend", ".env"),
  ];
  const pathToLoad = candidatePaths.find((p) => fs.existsSync(p)) || null;
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

// URL de produção (comum a todos os builds) com sanitização de barras e porta
const rawApiUrl = (apiUrl || process.env.API_URL || rootEnv.API_URL || rootEnv.URI_PROD || "http://localhost:3111").trim();
const targetApiUrl = rawApiUrl.replace(/\/:(\d+)/, ":$1").replace(/\/+$/, "");

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
    `npx esbuild "${entryFile}" --bundle --platform=node --format=cjs --target=node18 --external:playwright --external:playwright-core --external:bytenode ${defineArgs} --outfile="${bundleOut}"`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  // ── Etapa 2: Ofuscação ──
  console.log(` 2/4 Ofuscando código-fonte...`);
  const obfOut = path.join(OBF_DIR, `main-${bundleBase}.cjs`);

  execSync(
    `npx javascript-obfuscator "${bundleOut}" --output "${obfOut}" --compact true --control-flow-flattening true --dead-code-injection false --string-array true --string-array-encoding base64`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  // ── Etapa 3: Gerar executável direto com @yao-pkg/pkg ──
  console.log(` 3/4 Empacotando binário autônomo .exe com @yao-pkg/pkg...`);

  const exeOut = path.join(outDir, `${bundleBase}.exe`);

  execSync(
    `npx @yao-pkg/pkg "${obfOut}" --target node20-win-x64 --output "${exeOut}"`,
    { stdio: "inherit", cwd: ROOT_DIR }
  );

  // ── Etapa 4: Copiar dependências do Playwright e scripts auxiliares ──
  console.log(` 4/4 Copiando dependências do Playwright e setup.bat...`);
  const nodeModulesDest = path.join(outDir, "node_modules");
  fs.mkdirSync(nodeModulesDest, { recursive: true });

  const playwrightSrc = path.join(ROOT_DIR, "node_modules", "playwright");
  const playwrightCoreSrc = path.join(ROOT_DIR, "node_modules", "playwright-core");

  if (fs.existsSync(playwrightSrc)) {
    fs.cpSync(playwrightSrc, path.join(nodeModulesDest, "playwright"), { recursive: true });
  }
  if (fs.existsSync(playwrightCoreSrc)) {
    fs.cpSync(playwrightCoreSrc, path.join(nodeModulesDest, "playwright-core"), { recursive: true });
  }

  // Patch no coreBundle.js para contornar ERR_INSPECTOR_NOT_AVAILABLE no runtime do @yao-pkg/pkg
  const bundleFile = path.join(nodeModulesDest, "playwright-core", "lib", "coreBundle.js");
  if (fs.existsSync(bundleFile)) {
    let content = fs.readFileSync(bundleFile, "utf-8");
    content = content.replace(
      'inspector = __toESM(require("inspector"));',
      'inspector = { default: { Session: class { connect(){} post(e,cb){ if(cb) cb(); } on(){} }, url: () => undefined }, url: () => undefined };'
    );
    fs.writeFileSync(bundleFile, content, "utf-8");
  }

  // Copiar setup.bat
  const setupBatSrc = path.join(ROOT_DIR, "scripts", "setup.bat");
  if (fs.existsSync(setupBatSrc)) {
    fs.copyFileSync(setupBatSrc, path.join(outDir, "setup.bat"));
  }

  // Script auxiliar run.bat para facilitar execução com logs visíveis
  const batContent = `@echo off\r\ntitle ${bundleBase}\r\necho ==================================================\r\necho Iniciando ${bundleBase}...\r\necho ==================================================\r\n"${bundleBase}.exe"\r\npause\r\n`;
  fs.writeFileSync(path.join(outDir, "run.bat"), batContent, "utf-8");

  // Documentação README.txt com instruções e quadro explicativo
  const readmeContent = [
    "================================================================================",
    `           ROBO RPA DOCUSIGN - INSTRUCOES DE INSTALACAO E EXECUCAO`,
    "================================================================================",
    "",
    "Este pacote contem o robo autonomo e protegido para automacao do DocuSign.",
    "Sua chave de autenticacao e comunicacao com o servidor ja estao embutidas.",
    "",
    "--------------------------------------------------------------------------------",
    "ESTRUTURA DESTE DIRETORIO:",
    "--------------------------------------------------------------------------------",
    "Arquivo / Diretorio        Finalidade",
    "-----------------------    -----------------------------------------------------",
    `${bundleBase}.exe`.padEnd(27) + "Binario Windows autonomo com runtime Node.js, codigo",
    "                           ofuscado e chave de autenticacao embutida.",
    "",
    "run.bat                    Script auxiliar para inicializacao com janela de",
    "                           terminal visivel e logs em tempo real (Recomendado).",
    "",
    "setup.bat                  Script para instalacao inicial do navegador Chromium",
    "                           na maquina alvo (apenas na 1a vez).",
    "",
    "node_modules/              Modulos locais do Playwright (playwright e",
    "                           playwright-core) necessarios para automacao.",
    "",
    "--------------------------------------------------------------------------------",
    "PASSO A PASSO PARA INSTALACAO E USO:",
    "--------------------------------------------------------------------------------",
    "",
    "1. COPIAR A PASTA:",
    "   Copie esta pasta completa para a maquina do agente/vendedor onde o robo",
    "   ira operar.",
    "",
    "2. INSTALACAO DO NAVEGADOR (Apenas na 1a vez na maquina):",
    '   De dois cliques no arquivo "setup.bat" para baixar e configurar o navegador',
    "   Chromium do Playwright automaticamente.",
    "",
    "   Ou, se preferir via PowerShell / Terminal:",
    "   npx playwright install chromium",
    "",
    "3. INICIAR O ROBO:",
    `   De dois cliques no arquivo "run.bat" (ou execute "${bundleBase}.exe").`,
    "",
    "   O robo se conectara automaticamente ao servidor central via API Key,",
    "   registrara a sessao da maquina e comecara a consumir e processar as",
    "   tarefas da fila da DocuSign.",
    "",
    "================================================================================",
  ].join("\r\n");
  fs.writeFileSync(path.join(outDir, "README.txt"), readmeContent, "utf-8");

  console.log(` -> OK: ${exeOut}`);
  return { exe: exeOut };
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
