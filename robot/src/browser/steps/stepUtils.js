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
