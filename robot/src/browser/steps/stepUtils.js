import fs from "node:fs";
import path from "node:path";
import logger from "../../utils/logger.js";

/**
 * Aguarda um período de tempo aleatório em milissegundos.
 * @async
 * @param {number} min - Tempo mínimo em ms.
 * @param {number} max - Tempo máximo em ms.
 * @returns {Promise<void>}
 */
export async function randomDelay(min = 500, max = 1500) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Captura screenshot de depuração no contexto da página.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {string} prefix - Prefixo do nome do arquivo.
 * @returns {Promise<string|null>} Caminho da screenshot salva ou null.
 */
export async function captureDebugScreenshot(page, prefix = "debug") {
  try {
    if (!page || page.isClosed()) return null;
    const dir = path.resolve(process.cwd(), "storage", "screenshots");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filename = `${prefix}_${Date.now()}.png`;
    const filePath = path.join(dir, filename);
    await page.screenshot({ path: filePath, fullPage: true }).catch(() => {});
    logger.info("Browser", `Screenshot de depuração capturada em: ${filePath}`);
    return filePath;
  } catch (err) {
    logger.warn("Browser", `Não foi possível salvar screenshot: ${err.message}`);
    return null;
  }
}

/**
 * Aguarda até que a contagem de elementos do locator atinja o valor esperado.
 * @async
 * @param {import('playwright').Locator} locator - Locator dos elementos.
 * @param {number} expectedCount - Quantidade esperada de elementos.
 * @param {number} [timeoutMs=15000] - Tempo limite em ms.
 * @returns {Promise<boolean>} True se atingiu a contagem esperada.
 */
export async function waitForElementCount(locator, expectedCount, timeoutMs = 15000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const currentCount = await locator.count().catch(() => 0);
    if (currentCount >= expectedCount) {
      return true;
    }
    await randomDelay(200, 400);
  }
  return false;
}

/**
 * Regex estrita de UUID de 36 caracteres (Envelope ID DocuSign).
 * @constant
 * @type {RegExp}
 */
export const UUID_REGEX = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

/**
 * Extrai um Envelope ID de uma URL (padrões /envelopes/<id>, details/<id>, /documents/<id>, envelopeId=<id>).
 * @param {string} url - URL a inspecionar.
 * @returns {string|null} ID extraído ou null.
 */
export function extractEnvelopeIdFromUrl(url) {
  if (typeof url !== "string" || url.length === 0) return null;
  if (!url.includes("/envelopes/") && !url.includes("envelopeId=") && !url.includes("details/") && !url.includes("/documents/")) return null;
  const match = url.match(/\/envelopes\/([a-f0-9-]{36})/i)
    || url.match(/details\/([a-f0-9-]{36})/i)
    || url.match(/\/documents\/([a-f0-9-]{36})/i)
    || url.match(/envelopeId=([a-f0-9-]{36})/i);
  if (match && match[1] && UUID_REGEX.test(match[1])) return match[1];
  return null;
}

/**
 * Anexa interceptadores de rede para capturar o ID de envelope trafegado durante o envio com desanexação segura.
 * Escuta URLs de navegação (request) e o corpo JSON do POST de criação (`/restapi/.../envelopes` → `{ envelopeId }`).
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @returns {{ getInterceptedId: () => string|null, cleanup: () => void }} Objeto com getter do ID interceptado e função de cleanup.
 */
export function attachNetworkEnvelopeInterceptor(page) {
  let interceptedEnvelopeId = null;

  const onRequest = (request) => {
    try {
      const url = typeof request?.url === "function" ? request.url() : "";
      const id = extractEnvelopeIdFromUrl(url);
      if (id) interceptedEnvelopeId = id;
    } catch (_) {}
  };

  const onResponse = async (response) => {
    try {
      const url = typeof response?.url === "function" ? response.url() : "";
      const idFromUrl = extractEnvelopeIdFromUrl(url);
      if (idFromUrl) {
        interceptedEnvelopeId = idFromUrl;
        return;
      }
      // Caso principal: POST de criação retorna o ID no corpo JSON, com URL sem ID (…/envelopes)
      const req = typeof response?.request === "function" ? response.request() : null;
      const method = typeof req?.method === "function" ? req.method() : "";
      if (url.includes("/restapi/") && url.includes("/envelopes") && method === "POST" && typeof response?.json === "function") {
        const body = await response.json().catch(() => null);
        const candidate = body?.envelopeId;
        if (typeof candidate === "string" && UUID_REGEX.test(candidate.trim())) {
          interceptedEnvelopeId = candidate.trim();
        }
      }
    } catch (_) {}
  };

  if (page && typeof page.on === "function") {
    page.on("request", onRequest);
    page.on("response", onResponse);
  }

  return {
    getInterceptedId: () => interceptedEnvelopeId,
    cleanup: () => {
      try {
        if (page && typeof page.off === "function") {
          page.off("request", onRequest);
          page.off("response", onResponse);
        }
      } catch (_) {}
    },
  };
}
