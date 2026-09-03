import logger from "../../utils/logger.js";
import { randomDelay } from "./stepUtils.js";

/**
 * Executa a extração do Envelope ID gerado em cascata de 3 níveis.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {string|null} [existingEnvelopeId] - ID prévio ou fallback.
 * @returns {Promise<string|null>} ID do envelope extraído, prévio ou null (anti-phantom AD-046).
 */
export async function executeExtractEnvelopeIdStep(page, existingEnvelopeId = null) {
  await randomDelay(3000, 5000);
  let envelopeId = null;

  // Nível 1: Extração via URL atual pós-redirecionamento
  try {
    const currentUrl = page.url();
    logger.step("Browser", `Tentando extrair Envelope ID via URL (Nível 1): ${currentUrl}`);
    const match = currentUrl.match(/details\/([a-f0-9-]{36})/i) ||
                  currentUrl.match(/envelopeId=([a-f0-9-]{36})/i) ||
                  currentUrl.match(/documents\/([a-f0-9-]{36})/i);
    if (match && match[1]) {
      envelopeId = match[1];
      logger.success("Browser", `Envelope ID extraído da URL com sucesso: ${envelopeId}`);
      return envelopeId;
    }
  } catch (err) {
    logger.warn("Browser", `Falha na extração de Envelope ID via URL: ${err.message}`);
  }

  // Nível 2: Leitura da 1ª linha da tabela de documentos
  try {
    logger.step("Browser", "Tentando extrair Envelope ID via tabela de documentos (Nível 2)...");
    const firstRowLink = page.locator("tbody tr a[href*='details/'], [data-qa='manage-envelopes-list.table'] tr a").first();
    const isVisible = await firstRowLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      const href = await firstRowLink.getAttribute("href").catch(() => "");
      const match = href.match(/details\/([a-f0-9-]{36})/i) || href.match(/([a-f0-9-]{36})/i);
      if (match && match[1]) {
        envelopeId = match[1];
        logger.success("Browser", `Envelope ID extraído da listagem de documentos: ${envelopeId}`);
        return envelopeId;
      }
    }
  } catch (err) {
    logger.warn("Browser", `Falha na extração de Envelope ID via listagem: ${err.message}`);
  }

  // Nível 3: Fallback para ID prévio; sem phantom ID (AD-046) — caller decide falha
  if (existingEnvelopeId && typeof existingEnvelopeId === "string" && existingEnvelopeId.trim().length > 0) {
    logger.info("Browser", `Utilizando Envelope ID prévio do job (Nível 3): ${existingEnvelopeId}`);
    return existingEnvelopeId;
  }

  logger.warn("Browser", "Envelope ID não capturado via URL nem listagem e sem ID prévio — retornando null.");
  return null;
}
