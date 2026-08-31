import { guardedAction } from "./stepUtils.js";

/**
 * Preenche o assunto e a mensagem personalizada do e-mail no formulário DocuSign.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} sendSel - Seletores da tela de envio.
 * @param {Object} messageData - Dados da mensagem.
 * @param {string} [messageData.subject] - Assunto do e-mail/envelope.
 * @param {string} [messageData.message] - Conteúdo/corpo da mensagem.
 * @param {string} [email] - E-mail de autenticação para controle de sessão.
 * @returns {Promise<void>}
 */
export async function fillMessage(page, sendSel = {}, messageData = {}, email) {
  const { subject, message } = messageData;

  if (subject && sendSel.subject_input && typeof page.fill === "function") {
    await guardedAction(() => page.fill(sendSel.subject_input, subject), page, email);
  }

  if (message && sendSel.message_textarea && typeof page.fill === "function") {
    await guardedAction(() => page.fill(sendSel.message_textarea, message), page, email);
  }
}
