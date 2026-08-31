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

  let extractedId = null;

  const currentUrl = page.url();
  if (isLoginUrl(currentUrl)) {
    throw new Error(`Não foi possível extrair envelopeId: o navegador foi redirecionado para a tela de autenticação (${currentUrl}).`);
  }

  const match = currentUrl.match(/\/envelopes\/([0-9a-fA-F-]{20,}|[0-9a-fA-F-]{36})/i);
  if (match && match[1]) {
    extractedId = match[1];
  }

  if (!extractedId || typeof extractedId !== "string" || !extractedId.trim()) {
    throw new Error(
      "Não foi possível extrair o envelopeId após a submissão do contrato no DocuSign. Verifique se o envelope foi criado corretamente."
    );
  }

  return extractedId.trim();
}
