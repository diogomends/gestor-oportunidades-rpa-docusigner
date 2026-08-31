import { guardedAction } from "./stepUtils.js";

/**
 * Preenche o nome e o e-mail do destinatário nos campos do formulário DocuSign.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} sendSel - Seletores da tela de envio.
 * @param {Object} recipientData - Dados do destinatário.
 * @param {string} recipientData.recipientName - Nome completo do destinatário.
 * @param {string} recipientData.recipientEmail - E-mail do destinatário.
 * @param {string} [email] - E-mail de autenticação para controle de sessão.
 * @returns {Promise<void>}
 */
export async function fillRecipient(page, sendSel = {}, recipientData = {}, email) {
  const { recipientName, recipientEmail } = recipientData;

  if (recipientName && sendSel.recipient_name && typeof page.fill === "function") {
    await guardedAction(() => page.fill(sendSel.recipient_name, recipientName), page, email);
  }

  if (recipientEmail && sendSel.recipient_email && typeof page.fill === "function") {
    await guardedAction(() => page.fill(sendSel.recipient_email, recipientEmail), page, email);
  }
}
