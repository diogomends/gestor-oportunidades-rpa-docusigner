import { assertPage, fillIfPresent } from "./stepUtils.js";

/**
 * Preenche o assunto e a mensagem personalizada do e-mail no formulário DocuSign.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [sendSel={}] - Seletores da tela de envio.
 * @param {Object} [messageData={}] - Dados da mensagem.
 * @param {string} [messageData.subject] - Assunto do e-mail/envelope.
 * @param {string} [messageData.message] - Conteúdo/corpo da mensagem.
 * @param {string} [email] - E-mail de autenticação para controle de sessão.
 * @returns {Promise<void>}
 */
export async function fillMessage(page, sendSel = {}, messageData = {}, email) {
  assertPage(page);

  const { subject, message } = messageData;

  if (subject) {
    const sanitizedSubject = String(subject).slice(0, 200);
    await fillIfPresent(page, sendSel?.subject_input, sanitizedSubject, email);
  }

  if (message) {
    await fillIfPresent(page, sendSel?.message_textarea, message, email);
  }
}
