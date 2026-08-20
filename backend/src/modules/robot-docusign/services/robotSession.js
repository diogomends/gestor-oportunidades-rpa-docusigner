import path from "node:path";
import fs from "node:fs";
import RobotSession from "../models/RobotSession.js";

/**
 * Captura um screenshot de depuração e salva em tmp/robot-debug/.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} [label="debug"] - Rótulo descritivo para o nome do arquivo.
 * @returns {Promise<string|null>} Caminho do arquivo salvo ou null em caso de falha.
 */
export async function captureDebugScreenshot(page, label = "debug") {
  try {
    const dir = path.resolve(process.cwd(), "tmp/robot-debug");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const timestamp = Date.now();
    const filePath = path.join(dir, `${label}-${timestamp}.png`);
    if (typeof page?.screenshot === "function") {
      await page.screenshot({ path: filePath, fullPage: true });
      return filePath;
    }
  } catch {
    // Falha silenciosa — screenshot de debug não deve interromper o fluxo principal
  }
  return null;
}


/**
 * Salva ou atualiza a sessão de um usuário no MongoDB (upsert).
 *
 * @param {string} email - Email da conta DocuSign.
 * @param {Array<Object>} cookies - Lista de cookies obtidos via context.cookies().
 * @param {Object} [options] - Opções adicionais (localStorage, userAgent, expiresAt).
 * @returns {Promise<Object>} Documento RobotSession atualizado.
 */
export async function saveSession(email, cookies, options = {}) {
  if (!email) {
    throw new Error("Email is required to save session");
  }
  const { localStorage = null, userAgent = "", expiresAt = null } = options;
  const calculatedExpiresAt = expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
  const lastUsedAt = new Date();

  const session = await RobotSession.findOneAndUpdate(
    { email },
    {
      email,
      cookies,
      localStorage,
      userAgent,
      user_agent: userAgent,
      expiresAt: calculatedExpiresAt,
      expires_at: calculatedExpiresAt,
      lastUsedAt,
      last_used_at: lastUsedAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return session;
}

/**
 * Busca a sessão de um usuário pelo email.
 *
 * @param {string} email - Email da conta.
 * @returns {Promise<Object|null>} Documento RobotSession ou null.
 */
export async function getSession(email) {
  if (!email) return null;
  return await RobotSession.findOne({ email });
}

/**
 * Verifica se uma sessão obtida é válida e não expirou.
 *
 * @param {Object} session - Documento RobotSession ou objeto de sessão.
 * @returns {boolean} True se a sessão for válida e não expirada.
 */
export function isSessionValid(session) {
  if (!session || !session.cookies || !Array.isArray(session.cookies) || session.cookies.length === 0) {
    return false;
  }
  const expiry = session.expiresAt || session.expires_at;
  if (!expiry) return false;
  const expiryDate = new Date(expiry);
  return expiryDate.getTime() > Date.now();
}

/**
 * Aplica os cookies salvos da sessão ao Playwright browser context.
 *
 * @param {Object} context - Contexto do Playwright Browser.
 * @param {Object} session - Documento RobotSession ou objeto de sessão.
 * @returns {Promise<boolean>} True se os cookies foram aplicados com sucesso.
 */
export async function applySessionToContext(context, session) {
  if (!context || typeof context.addCookies !== "function") {
    throw new Error("Invalid browser context provided");
  }
  if (!session || !session.cookies || !Array.isArray(session.cookies)) {
    return false;
  }
  await context.addCookies(session.cookies);
  return true;
}

/**
 * Realiza o fluxo de login no Playwright, captura cookies e salva no banco.
 *
 * @param {Object} page - Página do Playwright.
 * @param {Object} context - Contexto do Playwright Browser.
 * @param {Object} credentials - Objeto { email, password }.
 * @param {Object} [selectors] - Seletores de UI para a página de login.
 * @returns {Promise<Object>} Documento RobotSession salvo.
 */
export async function loginAndSaveSession(page, context, credentials, selectors = {}) {
  const { email, password } = credentials || {};
  if (!email || !password) {
    throw new Error("E-mail e senha da DocuSign são obrigatórios para efetuar o login do Robô");
  }

  const emailSelector =
    selectors.email ||
    selectors.email_input ||
    '#email, input[type="email"], input[name="username"], input[data-testid="username"]';
  const passwordSelector =
    selectors.password ||
    selectors.password_input ||
    '#password, input[type="password"], input[name="password"], input[data-testid="password"]';
  const submitSelector =
    selectors.submitButton ||
    selectors.login_button ||
    'button[data-testid="login-button"], button[type="submit"], button[data-testid="submit-btn"], button[data-testid="submit-username"]';
  const loginUrl = selectors.loginUrl || "https://account.docusign.com";

  try {
    const currentUrl = typeof page.url === "function" ? page.url() : "";
    if (!currentUrl.includes("account.docusign.com")) {
      if (typeof page.goto === "function") {
        await page.goto(loginUrl, { waitUntil: "networkidle", timeout: 30000 });
      }
    }

    try {
      if (typeof page.fill === "function") {
        if (typeof page.waitForSelector === "function") {
          await page.waitForSelector(emailSelector, { timeout: 10000 });
        }
        await page.fill(emailSelector, email);
      }

      if (typeof page.click === "function") {
        await page.click(submitSelector);
      }

      if (typeof page.fill === "function") {
        if (typeof page.waitForSelector === "function") {
          await page.waitForSelector(passwordSelector, { timeout: 10000 });
        }
        await page.fill(passwordSelector, password);
      }

      if (typeof page.click === "function") {
        await page.click(submitSelector);
      }

      if (typeof page.waitForURL === "function") {
        await page.waitForURL(
          (url) => !url.includes("account.docusign.com") && !url.includes("apps.docusign.com"),
          { timeout: 30000 }
        ).catch(() => {});
      }
    } catch (err) {
      await captureDebugScreenshot(page, "login-failed");
      throw err;
    }

    const finalUrl = typeof page.url === "function" ? page.url() : "";
    if (finalUrl.includes("account.docusign.com") || finalUrl.includes("/oauth/") || finalUrl.includes("/login")) {
      await captureDebugScreenshot(page, "login-failed");
      throw new Error(
        `Falha na autenticação do robô DocuSign: A navegação permaneceu na tela de login/OAuth (${finalUrl}) após a tentativa de login.`
      );
    }

    const activeContext = context || (typeof page.context === "function" ? page.context() : null);
    const cookies = activeContext && typeof activeContext.cookies === "function" ? await activeContext.cookies() : [];
    const userAgent = typeof page.evaluate === "function" ? await page.evaluate(() => navigator.userAgent).catch(() => "") : "";

    return await saveSession(email, cookies, { userAgent });
  } catch (err) {
    await captureDebugScreenshot(page, "login-exception");
    throw err;
  }
}

/**
 * Obtém uma sessão válida existente ou realiza o login e salva uma nova sessão.
 *
 * @param {Object} page - Página do Playwright.
 * @param {Object} context - Contexto do Playwright.
 * @param {Object} credentials - Objeto { email, password }.
 * @param {Object} [selectors] - Seletores de UI.
 * @returns {Promise<{ session: Object, refreshed: boolean }>} Objeto com a sessão e indicador se foi renovada.
 */
export async function getOrRefreshSession(page, context, credentials, selectors = {}) {
  const existingSession = await getSession(credentials?.email);
  if (existingSession && isSessionValid(existingSession)) {
    await applySessionToContext(context, existingSession);
    return { session: existingSession, refreshed: false };
  }

  const newSession = await loginAndSaveSession(page, context, credentials, selectors);
  await applySessionToContext(context, newSession);
  return { session: newSession, refreshed: true };
}

/**
 * Invalida/remove a sessão salva do banco de dados.
 *
 * @param {string} email - Email da conta a ter a sessão invalidada.
 * @returns {Promise<boolean>} True se removida com sucesso.
 */
export async function invalidateSession(email) {
  if (!email) return false;
  const result = await RobotSession.deleteOne({ email });
  return (result?.deletedCount ?? 0) > 0;
}

export default {
  captureDebugScreenshot,
  saveSession,
  getSession,
  isSessionValid,
  applySessionToContext,
  loginAndSaveSession,
  getOrRefreshSession,
  invalidateSession,
};
