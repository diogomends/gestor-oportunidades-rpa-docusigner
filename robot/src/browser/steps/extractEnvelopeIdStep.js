import logger from "../../utils/logger.js";

const UUID_REGEX = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

/**
 * Executa a extração do Envelope ID gerado em cascata de múltiplos níveis resilientes.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {string|null} [existingEnvelopeId=null] - ID prévio ou fallback.
 * @param {string|null} [interceptedEnvelopeId=null] - ID capturado via rede durante o fluxo.
 * @returns {Promise<string|null>} ID do envelope extraído ou null (anti-phantom AD-046).
 */
export async function executeExtractEnvelopeIdStep(page, existingEnvelopeId = null, interceptedEnvelopeId = null) {
  let envelopeId = null;

  // Nível 1: Extração via URL atual pós-redirecionamento
  try {
    const currentUrl = page.url();
    logger.step("Browser", `Tentando extrair Envelope ID via URL (Nível 1): ${currentUrl}`);
    const match = currentUrl.match(/\/envelopes\/([a-f0-9-]{36})/i) ||
                  currentUrl.match(/details\/([a-f0-9-]{36})/i) ||
                  currentUrl.match(/envelopeId=([a-f0-9-]{36})/i) ||
                  currentUrl.match(/documents\/([a-f0-9-]{36})/i) ||
                  currentUrl.match(UUID_REGEX);
    if (match && (match[1] || match[0])) {
      const candidate = (match[1] || match[0]).trim();
      if (UUID_REGEX.test(candidate)) {
        envelopeId = candidate;
        logger.success("Browser", `Envelope ID extraído da URL com sucesso: ${envelopeId}`);
        return envelopeId;
      }
    }
  } catch (err) {
    logger.warn("Browser", `Falha na extração de Envelope ID via URL: ${err.message}`);
  }

  // Nível 2: Utilização de ID interceptado via rede / URLs intermediárias durante o envio
  if (interceptedEnvelopeId && typeof interceptedEnvelopeId === "string" && UUID_REGEX.test(interceptedEnvelopeId.trim())) {
    envelopeId = interceptedEnvelopeId.trim();
    logger.success("Browser", `Envelope ID recuperado via interceptação de requisições de rede (Nível 2): ${envelopeId}`);
    return envelopeId;
  }

  // Nível 3: Leitura e busca ativa no DOM da tabela/listagem de documentos pós-redirecionamento
  try {
    logger.step("Browser", "Tentando extrair Envelope ID via tabela/listagem de documentos (Nível 3)...");

    // Aguarda ativamente os elementos da tabela renderizarem (até 10 segundos)
    await page.waitForSelector("tbody tr, [role='row'], [data-qa*='manage-envelopes'], [data-qa*='table'] tr, a[href*='details'], a[href*='documents']", { timeout: 10000 }).catch(() => {});

    const domExtractedId = await page.evaluate(() => {
      const regex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

      // 1. Links em linhas da tabela de acordos
      const rows = document.querySelectorAll("tbody tr, [role='row'], [data-qa*='manage-envelopes'] tr, [data-qa*='table'] tr, [data-qa*='envelope']");
      for (const row of rows) {
        const links = row.querySelectorAll("a");
        for (const link of links) {
          const href = link.getAttribute("href") || "";
          const m = href.match(regex);
          if (m) return m[0];
        }
        for (const attr of row.getAttributeNames()) {
          const val = row.getAttribute(attr);
          const m = val?.match(regex);
          if (m) return m[0];
        }
      }

      // 2. Links gerais na tela contendo referências a documentos/envelopes
      const allLinks = document.querySelectorAll("a[href*='details'], a[href*='documents'], a[href*='envelope']");
      for (const link of allLinks) {
        const href = link.getAttribute("href") || "";
        const m = href.match(regex);
        if (m) return m[0];
      }

      return null;
    }).catch(() => null);

    if (domExtractedId && UUID_REGEX.test(domExtractedId)) {
      envelopeId = domExtractedId.trim();
      logger.success("Browser", `Envelope ID extraído da listagem de documentos: ${envelopeId}`);
      return envelopeId;
    }
  } catch (err) {
    logger.warn("Browser", `Falha na extração de Envelope ID via listagem: ${err.message}`);
  }

  // Nível 4: Fallback para ID prévio do job (se fornecido)
  if (existingEnvelopeId && typeof existingEnvelopeId === "string" && UUID_REGEX.test(existingEnvelopeId.trim())) {
    logger.info("Browser", `Utilizando Envelope ID prévio do job (Nível 4): ${existingEnvelopeId}`);
    return existingEnvelopeId.trim();
  }

  logger.warn("Browser", "Envelope ID não capturado via URL, interceptação de rede, listagem nem ID prévio — retornando null.");
  return null;
}

