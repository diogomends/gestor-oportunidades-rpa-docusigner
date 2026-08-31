import robotSession from "../robotSession.js";

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
  if (typeof page.goto === "function") {
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
  }

  let currentUrl = typeof page.url === "function" ? page.url() : "";
  if (currentUrl.includes("account.docusign.com") || currentUrl.includes("/oauth/") || currentUrl.includes("/login")) {
    const creds = envelopeData.credentials;
    if (creds?.email && creds?.password) {
      const ctx = typeof page.context === "function" ? page.context() : null;
      await robotSession.loginAndSaveSession(page, ctx, creds, selectors.login || {});
      if (typeof page.goto === "function") {
        await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
      }
      currentUrl = typeof page.url === "function" ? page.url() : "";
      if (
        currentUrl.includes("account.docusign.com") ||
        currentUrl.includes("/oauth/") ||
        currentUrl.includes("/login") ||
        currentUrl.includes("/password")
      ) {
        await robotSession.captureDebugScreenshot(page, "login-failed");
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
