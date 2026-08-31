import robotSession from "../robotSession.js";
import { assertPage, isLoginUrl } from "./stepUtils.js";

/**
 * Garante que a página esteja autenticada navegando para a URL desejada e realizando login automático se houver redirecionamento.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} targetUrl - URL de destino da navegação.
 * @param {Object} [envelopeData={}] - Dados da operação contendo credenciais.
 * @param {Object} [selectors={}] - Seletores de UI.
 * @returns {Promise<void>}
 * @throws {Error} Lança erro caso o login falhe ou credenciais não estejam configuradas.
 */
export async function ensureAuthenticated(page, targetUrl, envelopeData = {}, selectors = {}) {
  assertPage(page);

  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      const isAllowedHost = parsed.hostname.endsWith("docusign.com") || parsed.hostname.endsWith("docusign.net");
      if (!isAllowedHost) {
        throw new Error(`URL de destino fora do domínio permitido da DocuSign: "${targetUrl}".`);
      }
    } catch (urlErr) {
      if (!urlErr.message.includes("domínio permitido")) {
        throw new Error(`URL de destino inválida: "${targetUrl}".`);
      }
      throw urlErr;
    }
  }

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (navErr) {
    await robotSession.captureDebugScreenshot(page, "auth-nav-error").catch(() => {});
    throw navErr;
  }

  let currentUrl = typeof page.url === "function" ? page.url() : "";
  if (isLoginUrl(currentUrl)) {
    const creds = envelopeData.credentials;
    if (creds?.email && creds?.password) {
      const ctx = typeof page.context === "function" ? page.context() : null;
      await robotSession.loginAndSaveSession(page, ctx, creds, selectors.login || {});
      if (typeof page.goto === "function") {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      }
      currentUrl = typeof page.url === "function" ? page.url() : "";
      if (isLoginUrl(currentUrl)) {
        await robotSession.captureDebugScreenshot(page, "login-failed").catch(() => {});
        await robotSession.invalidateSession(creds.email).catch(() => {});
        throw new Error(
          `Falha na autenticação do robô DocuSign: A navegação permaneceu na tela de login/OAuth (${currentUrl}) após a tentativa de login.`
        );
      }
    } else {
      throw new Error(
        "Redirecionado para autenticação na DocuSign, porém as credenciais do robô (e-mail e senha) não foram configuradas nas Configurações do Sistema."
      );
    }
  }
}
