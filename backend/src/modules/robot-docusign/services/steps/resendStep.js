import { assertPage, guardedAction, navigateToEnvelope, resolveSelectors } from "./stepUtils.js";

/**
 * Navega até a página do envelope especificado e aciona o comando de reenvio de notificação.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador único do envelope a ser reenviado.
 * @param {Object} [selectors] - Seletores pré-resolvidos opcionais.
 * @returns {Promise<{ success: boolean, envelopeId: string }>} Objeto indicando o status do reenvio.
 * @throws {Error} Lança erro caso page ou envelopeId não sejam válidos ou se o botão não estiver disponível.
 */
export async function resendEnvelope(page, envelopeId, selectors) {
  assertPage(page);

  const resolvedSelectors = selectors || resolveSelectors();
  const resendSel = resolvedSelectors.resend || {};

  await navigateToEnvelope(page, envelopeId, resolvedSelectors);

  const resendButton = resendSel.resend_button || "button[data-testid='resend-button'], button[data-action='resend']";

  if (typeof page.click === "function") {
    await guardedAction(() => page.click(resendButton), page);
    if (typeof page.waitForSelector === "function") {
      const toastOk = await page
        .waitForSelector("[data-testid='resend-success'], .toast-success, [data-qa='toast-message']", { timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (!toastOk) {
        throw new Error("Reenvio não confirmado pela interface — toast de sucesso não apareceu após clicar em reenviar.");
      }
    }
  }

  return { success: true, envelopeId: String(envelopeId).trim() };
}
