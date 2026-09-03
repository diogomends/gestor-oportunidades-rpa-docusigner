import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Diretórios candidatos para resolução do Playwright (deduplicados).
 * Cobre execução via `node`, `.exe` do pkg (`dirname(execPath)`) e checkout local.
 * @returns {string[]} Diretórios únicos na ordem de tentativa.
 */
export function resolveCandidateDirs() {
  return [
    ...new Set([
      path.dirname(process.execPath),
      process.cwd(),
      path.resolve(path.dirname(process.execPath), ".."),
    ]),
  ];
}

/**
 * Carrega o Playwright dinamicamente a partir do diretório do executável (.exe)
 * ou do ambiente de execução atual, garantindo compatibilidade com o snapshot virtual do @yao-pkg/pkg.
 * @returns {any} Módulo Playwright resolvido (playwright ou playwright-core).
 */
export function resolvePlaywright() {
  for (const dir of resolveCandidateDirs()) {
    for (const sub of ["playwright-core", "playwright"]) {
      const idx = path.join(dir, "node_modules", sub, "index.js");
      if (!fs.existsSync(idx)) continue;
      try {
        const extRequire = createRequire(path.join(dir, "package.json"));
        return extRequire(idx);
      } catch (e) {
        console.warn(`[PlaywrightResolver] Warning: failed requiring ${idx}:`, e.message);
      }
    }
  }

  try {
    const extRequire = createRequire(path.join(process.cwd(), "package.json"));
    return extRequire("playwright-core");
  } catch (_) {
    try {
      const extRequire = createRequire(path.join(process.cwd(), "package.json"));
      return extRequire("playwright");
    } catch (err) {
      console.error("[PlaywrightResolver] Fatal: failed to resolve 'playwright' or 'playwright-core' module.", err);
      throw err;
    }
  }
}

/**
 * Obtém a instância Chromium do Playwright resolvido.
 * @param {any} [playwrightModule] - Módulo Playwright (resolve via resolvePlaywright() quando omitido).
 * @returns {import('playwright').Chromium} Objeto chromium para launch.
 */
export function getChromium(playwrightModule) {
  const mod = playwrightModule || resolvePlaywright();
  return mod.chromium || mod.default?.chromium || mod;
}

/**
 * Resolve o caminho do executável Chromium do Playwright.
 * @param {() => any} [resolveFn=getChromium] - Fábrica do objeto chromium (injeção para teste).
 * @returns {string|null} Caminho do binário ou null se não resolvível.
 */
export function resolveChromiumExecutablePath(resolveFn = getChromium) {
  try {
    const chromium = resolveFn();
    if (chromium && typeof chromium.executablePath === "function") {
      return chromium.executablePath();
    }
  } catch (_) {}
  return null;
}

/**
 * Valida presença do Chromium antes do boot; fail-fast com orientação ao operador.
 * @param {object} [deps={}] - Dependências injetáveis (teste).
 * @param {() => (string|null)} [deps.resolveFn] - Função que resolve o caminho do binário.
 * @param {(p: string) => boolean} [deps.existsSync] - Checagem de existência (default fs.existsSync).
 * @returns {string} Caminho do binário validado.
 * @throws {Error} Quando o binário não existe.
 */
export function assertChromiumInstalled(deps = {}) {
  const resolveFn = deps.resolveFn || (() => resolveChromiumExecutablePath());
  const existsSync = deps.existsSync || fs.existsSync;
  let exePath = null;
  try {
    exePath = resolveFn();
  } catch (_) {}
  if (exePath && existsSync(exePath)) return exePath;
  const hint =
    `Chromium não encontrado${exePath ? ` em: ${exePath}` : " (Playwright)"}. ` +
    `Execute setup.bat na pasta do robô para instalar o navegador em %LOCALAPPDATA%\\ms-playwright ` +
    `ou verifique a conexão/proxy. Se o problema persistir, consulte setup.log.`;
  throw new Error(hint);
}
