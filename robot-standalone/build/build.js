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
    ids: [],
    keys: [],
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

    if (arg === "--ids" && nextVal) {
      result.ids = nextVal.split(",").map((s) => s.trim()).filter(Boolean);
    } else if ((arg === "--keys" || arg === "--key" || arg === "--robot-key" || arg === "--robot-keys" || arg === "--ROBOT_KEY") && nextVal) {
      if (nextVal.includes(",")) {
        result.keys = nextVal.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        result.key = nextVal;
        result.keys.push(nextVal);
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
const { ids, keys, key, headless: argHeadless, apiUrl } = parseArgs();

// URL de produção obtida do .env.dev / .env raiz ou parâmetro
const targetApiUrl = (apiUrl || process.env.API_URL || rootEnv.API_URL || rootEnv.URI_PROD || "http://localhost:3111").replace(/\/$/, "");

// Headless resolvido com fallback para rootEnv.HEADLESS ou true
const isHeadless = argHeadless !== null
  ? argHeadless
  : (process.env.HEADLESS !== undefined
      ? !(process.env.HEADLESS === "false" || process.env.HEADLESS === "0")
      : (rootEnv.HEADLESS !== undefined
          ? !(rootEnv.HEADLESS === "false" || rootEnv.HEADLESS === "0")
          : true));

// Coleta lista de chaves disponíveis (CLI > ROBOT_API_KEYS > [ROBOT_API_KEY_1, 2, 3] > ROBOT_API_KEY)
let resolvedKeys = [];
if (keys.length > 0) {
  resolvedKeys = keys;
} else if (key) {
  resolvedKeys = [key];
} else if (rootEnv.ROBOT_API_KEYS || process.env.ROBOT_API_KEYS) {
  resolvedKeys = (rootEnv.ROBOT_API_KEYS || process.env.ROBOT_API_KEYS).split(",").map((s) => s.trim()).filter(Boolean);
} else {
  const envKey1 = process.env.ROBOT_API_KEY_1 || rootEnv.ROBOT_API_KEY_1 || process.env.ROBOT_API_KEY || rootEnv.ROBOT_API_KEY || "";
  const envKey2 = process.env.ROBOT_API_KEY_2 || rootEnv.ROBOT_API_KEY_2 || "";
  const envKey3 = process.env.ROBOT_API_KEY_3 || rootEnv.ROBOT_API_KEY_3 || "";

  resolvedKeys = [envKey1, envKey2, envKey3].filter(Boolean);
}

// Se nenhuma chave foi encontrada, mantém placeholder vazio para single build
if (resolvedKeys.length === 0) {
  resolvedKeys = [""];
}

// Determina se é multi-build (mais de 1 ID ou mais de 1 chave)
const multiBuild = ids.length > 1 || (ids.length === 0 && resolvedKeys.length > 1);

// Monta lista de alvos de build
let targets = [];
if (ids.length > 0) {
  targets = ids.map((id, index) => ({
    id,
    key: resolvedKeys[index] || resolvedKeys[0] || "",
    headless: isHeadless,
  }));
} else if (resolvedKeys.length > 1) {
  targets = resolvedKeys.map((k, index) => ({
    id: `robot-0${index + 1}`,
    key: k,
    headless: isHeadless,
  }));
} else {
  targets = [
    {
      id: "robot-docusigner",
      key: resolvedKeys[0] || "",
      headless: isHeadless,
    },
  ];
}

// ── Limpeza ──
console.log("==================================================");
console.log(" Iniciando Pipeline de Build Protegido do Robo");
console.log(` Servidor Central (API_URL): ${targetApiUrl}`);
if (targets.length > 1) {
  console.log(` Modo: MULTI-ROBOT | Qtd: ${targets.length} | Headless: ${isHeadless}`);
  targets.forEach((t, i) => console.log(`   [${i + 1}] ID: ${t.id} | Key: ${t.key ? t.key.substring(0, 10) + "..." : "(não informada)"}`));
} else {
  console.log(` Modo: SINGLE-ROBOT | ID: ${targets[0].id} | Key: ${targets[0].key ? targets[0].key.substring(0, 10) + "..." : "(não informada)"} | Headless: ${isHeadless}`);
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
        `--define:process.env.ROBOT_KEY='"${target.key || ""}"'`,
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
        console.log(`   - ${target.id}/robot-${target.id}.exe (Chave de acesso embutida)`);
      }
    } else {
      console.log(`   - robot-docusigner.exe (Chave de acesso embutida)`);
    }
    console.log(" Zero arquivos json expostos no disco de distribuicao.");
    console.log("==================================================");
  } catch (error) {
    console.error("\n Erro durante o pipeline de build:", error.message);
    process.exit(1);
  }
}

runBuild();


