/**
 * Extrai ou resolve o identificador único do envelope após a submissão.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} sendSel - Seletores da tela de envio.
 * @param {string} [fallbackEnvelopeId] - ID pré-existente fornecido ou fallback.
 * @returns {Promise<string>} Identificador do envelope extraído ou gerado.
 */
export async function extractEnvelopeId(page, sendSel = {}, fallbackEnvelopeId) {
  let generatedId = fallbackEnvelopeId;

  if (!generatedId && typeof page.url === "function") {
    const currentUrl = page.url();
    const match = currentUrl.match(/\/envelopes\/([a-zA-Z0-9-]+)/);
    if (match && match[1]) {
      generatedId = match[1];
    }
  }

  if (!generatedId && typeof page.getAttribute === "function" && sendSel.send_button) {
    generatedId = await page.getAttribute(sendSel.send_button, "data-envelope-id");
  }

  return generatedId || `env-${Date.now()}`;
}
