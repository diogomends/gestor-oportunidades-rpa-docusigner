import { guardedAction } from "./stepUtils.js";

/**
 * Aciona o clique no botão de envio do envelope no DocuSign.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} sendSel - Seletores da tela de envio.
 * @param {string} [email] - E-mail de autenticação para controle de sessão.
 * @returns {Promise<void>}
 */
export async function submitEnvelope(page, sendSel = {}, email) {
  if (sendSel.send_button && typeof page.click === "function") {
    await guardedAction(() => page.click(sendSel.send_button), page, email);
  }
}
