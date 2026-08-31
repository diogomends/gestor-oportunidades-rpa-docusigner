import { guardedAction } from "./stepUtils.js";

/**
 * Anexa o documento PDF na página de envio do DocuSign se o caminho for informado.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} sendSel - Seletores da tela de envio.
 * @param {string} [documentPath] - Caminho absoluto ou relativo do arquivo PDF.
 * @param {string} [email] - E-mail do usuário para controle de sessão em caso de redirecionamento.
 * @returns {Promise<void>}
 */
export async function uploadDocument(page, sendSel = {}, documentPath, email) {
  if (documentPath && sendSel.file_input && typeof page.setInputFiles === "function") {
    await guardedAction(() => page.setInputFiles(sendSel.file_input, documentPath), page, email);
  }
}
