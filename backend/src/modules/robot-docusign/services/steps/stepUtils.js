import robotSelectors, { getSelectors } from "../robotSelectors.js";
import robotSession from "../robotSession.js";

/**
 * Obtém os seletores atualizados do robô DocuSign.
 *
 * @returns {Object} Objeto com mapeamento dos seletores CSS/XPath.
 */
export function resolveSelectors() {
  if (typeof robotSelectors === "object" && robotSelectors !== null) {
    return robotSelectors;
  }
  return getSelectors();
}

/**
 * Executa uma ação Playwright e detecta se houve redirecionamento para OAuth/login durante a execução.
 * Em caso de redirect, invalida a sessão e lança erro descritivo.
 *
 * @param {Function} action - Função assíncrona da ação Playwright a executar.
 * @param {Object} page - Instância da página do Playwright.
 * @param {string} [email] - E-mail para invalidação da sessão caso ocorra redirecionamento.
 * @returns {Promise<void>}
 * @throws {Error} Lança erro caso a ação falhe ou redirecione para autenticação.
 */
export async function guardedAction(action, page, email) {
  try {
    await action();
  } catch (err) {
    const url = typeof page.url === "function" ? page.url() : "";
    if (url.includes("account.docusign.com") || url.includes("/oauth/") || url.includes("/login")) {
      if (email) {
        await robotSession.invalidateSession(email).catch(() => {});
      }
      throw new Error(
        `Redirecionado para OAuth durante interação com a página de envio (${url}). Sessão invalidada — o robô realizará novo login na próxima tentativa.`
      );
    }
    throw err;
  }
}
