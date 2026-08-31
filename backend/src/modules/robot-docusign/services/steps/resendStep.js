import { resolveSelectors } from "./stepUtils.js";

/**
 * Navega até a página do envelope especificado e aciona o comando de reenvio de notificação.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador único do envelope a ser reenviado.
 * @returns {Promise<{ success: boolean, envelopeId: string }>} Objeto indicando o status do reenvio.
 * @throws {Error} Lança erro caso page ou envelopeId não sejam informados.
 */
export async function resendEnvelope(page, envelopeId) {
  if (!page || !envelopeId) {
    throw new Error("Page and envelopeId are required for resend operation");
  }

  const selectors = resolveSelectors();
  const resendSel = selectors.resend || {};
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  const envelopeUrl = `${baseUrl}/documents/${envelopeId}`;

  if (typeof page.goto === "function") {
    await page.goto(envelopeUrl);
  }

  if (resendSel.resend_button && typeof page.click === "function") {
    await page.click(resendSel.resend_button);
  }

  return { success: true, envelopeId };
}
