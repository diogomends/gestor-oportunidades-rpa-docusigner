import { assertPage, isLoginUrl } from "./stepUtils.js";

/**
 * Extrai ou resolve o identificador único do envelope após a submissão.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [sendSel={}] - Seletores da tela de envio.
 * @param {string} [fallbackEnvelopeId] - ID pré-existente fornecido ou fallback.
 * @returns {Promise<string>} Identificador do envelope extraído.
 * @throws {Error} Lança erro descritivo se não for possível extrair o ID do envelope.
 */
export async function extractEnvelopeId(page, sendSel = {}, fallbackEnvelopeId) {
  if (typeof fallbackEnvelopeId === "string" && fallbackEnvelopeId.trim().length >= 10) {
    return fallbackEnvelopeId.trim();
  }

  assertPage(page);

  const currentUrl = page.url();
  if (isLoginUrl(currentUrl)) {
    throw new Error(`Não foi possível extrair envelopeId: o navegador foi redirecionado para a tela de autenticação (${currentUrl}).`);
  }

  // Nível 1: Extração via URL atual pós-redirecionamento com múltiplos padrões
  let extractedId = null;
  const match = currentUrl.match(/\/envelopes\/([0-9a-fA-F-]{20,}|[0-9a-fA-F-]{36})/i) ||
                currentUrl.match(/details\/([0-9a-fA-F-]{36})/i) ||
                currentUrl.match(/envelopeId=([0-9a-fA-F-]{36})/i) ||
                currentUrl.match(/documents\/([0-9a-fA-F-]{36})/i);

  if (match && match[1]) {
    extractedId = match[1];
  }

  // Nível 2: Leitura da 1ª linha da tabela de documentos na UI
  if (!extractedId && typeof page.locator === "function") {
    try {
      const firstRowLink = page.locator("tbody tr a[href*='details/'], [data-qa='manage-envelopes-list.table'] tr a").first();
      const isVisible = await firstRowLink.isVisible({ timeout: 4000 }).catch(() => false);
      if (isVisible) {
        const href = await firstRowLink.getAttribute("href").catch(() => "");
        const tableMatch = href.match(/details\/([a-f0-9-]{36})/i) || href.match(/([a-f0-9-]{36})/i);
        if (tableMatch && tableMatch[1]) {
          extractedId = tableMatch[1];
        }
      }
    } catch {
      // Falha silenciosa no Nível 2
    }
  }

  if (!extractedId || typeof extractedId !== "string" || !extractedId.trim()) {
    throw new Error(
      "Não foi possível extrair o envelopeId após a submissão do contrato no DocuSign. Verifique se o envelope foi criado corretamente."
    );
  }

  return extractedId.trim();
}
