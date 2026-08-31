import { assertPage, fillIfPresent } from "./stepUtils.js";

/**
 * Preenche o nome e o e-mail do destinatário nos campos do formulário DocuSign.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [sendSel={}] - Seletores da tela de envio.
 * @param {Object} [recipientData={}] - Dados do destinatário.
 * @param {string} [recipientData.recipientName] - Nome completo do destinatário.
 * @param {string} recipientData.recipientEmail - E-mail do destinatário.
 * @param {string} [email] - E-mail de autenticação para controle de sessão.
 * @returns {Promise<void>}
 * @throws {Error} Lança erro caso o e-mail seja inválido ou o seletor obrigatório não exista.
 */
export async function fillRecipient(page, sendSel = {}, recipientData = {}, email) {
  assertPage(page);

  const { recipientName, recipientEmail } = recipientData;

  if (recipientName) {
    await fillIfPresent(page, sendSel?.recipient_name, recipientName, email, true);
  }

  if (recipientEmail) {
    const normalizedEmail = String(recipientEmail).trim().toLowerCase();
    await fillIfPresent(page, sendSel?.recipient_email, normalizedEmail, email, true);
  }
}
