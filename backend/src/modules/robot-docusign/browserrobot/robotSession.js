import path from "node:path";
import fs from "node:fs";
import RobotSession from "../models/RobotSession.js";
import { getSelectors as _getMfaSelectors } from "./robotSelectors.js";
import { isLoginUrl } from "./loginUrl.js";
import { fetchMfaCodeViaImap } from "../utils/imapClient.js";

/**
 * Timeout estendido (90s) para a etapa MFA/2FA — DocuSign demora mais para
 * concluir o login quando exige código de segurança temporário.
 */
export const MFA_TIMEOUT = 90000;

/** Seletor CSS composto para campo de código MFA/OTP — fonte canônica em robotSelectors.js:mfa.input (ponytail: evita duplicação). @type {string} */
const DEFAULT_MFA_SELECTOR = _getMfaSelectors().mfa.input;

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
 * Cria erro de domínio com código identificador (ex.: MFA_REQUIRED, OTP_INVALID).
 *
 * @param {string} code - Código do erro.
 * @param {string} message - Mensagem em pt-BR.
 * @returns {Error} Erro com propriedade `code`.
 */
function createAuthError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}



/**
 * Detecta se a tela de MFA/2FA apareceu após a submissão da senha.
 * Usa Promise.race entre o input MFA (com suporte a detecção por texto) e a navegação para fora do login,
 * evitando esperar o timeout completo (MFA_TIMEOUT) em logins sem MFA.
 *
 * @param {Object} page - Página do Playwright.
 * @param {string} mfaSelector - Seletor CSS do input de código MFA.
 * @returns {Promise<boolean>} True se o input MFA aparecer.
 */
async function detectMfaScreen(page, mfaSelector) {
  let settled = false;
  const navPromise = new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (settled) {
        clearInterval(timer);
        return;
      }
      const currentUrl =
        typeof page.url === "function" ? String(page.url()) : "";
      if (!isLoginUrl(currentUrl)) {
        settled = true;
        clearInterval(timer);
        resolve("navigated");
      } else if (Date.now() - startedAt > MFA_TIMEOUT) {
        settled = true;
        clearInterval(timer);
        resolve("timeout");
      }
    }, 500);
    if (typeof timer.unref === "function") timer.unref();
  });

  const selectorPromise = (async () => {
    try {
      if (typeof page.locator === "function") {
        const mfaOptionSelector = selectors.mfa?.email_option_btn || selectors.mfa?.text_trigger || "text=/Get Code From Your Email/i";
        const textOption = page.locator(mfaOptionSelector).first();
        if (await textOption.isVisible().catch(() => false)) {
          if (typeof textOption.click === "function") {
            await textOption.click().catch(() => {});
          }
        }
      }
      if (typeof page.waitForSelector === "function") {
        const el = await page
          .waitForSelector(mfaSelector, { timeout: MFA_TIMEOUT })
          .catch(() => null);
        return el ? "mfa" : "none";
      }
    } catch {
      return "none";
    }
    return "none";
  })();

  const outcome = await Promise.race([selectorPromise, navPromise]);
  settled = true;
  return outcome === "mfa";
}

/**
 * Realiza o fluxo de login no Playwright, captura cookies e salva no banco.
 *
 * @param {Object} page - Página do Playwright.
 * @param {Object} context - Contexto do Playwright Browser.
 * @param {Object} credentials - Objeto { email, password, otpCode? }.
 * @param {Object} [selectors] - Seletores de UI para a página de login (inclui `mfa`).
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
    "input[data-qa='username'], input[name='email'], input[type='email'], #email";
  const passwordSelector =
    selectors.password ||
    selectors.password_input ||
    "input[data-qa='password'], input[name='password'], input[type='password'], #password";
  const submitSelector =
    selectors.submitButton ||
    selectors.login_button ||
    "button[data-qa='submit-username'], button[data-testid='login-button'], button[type='submit'], button[data-qa='submit']";
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
        if (typeof page.waitForLoadState === "function") {
          await page.waitForLoadState("domcontentloaded").catch(() => {});
        }
        if (typeof page.waitForSelector === "function") {
          await page.waitForSelector(emailSelector, { timeout: 15000 });
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

      // Etapa opcional de MFA/2FA: se a tela de código aparecer, tenta obter via IMAP
      // ou consome otpCode pré-fornecido, usando loop de retry com descarte de códigos rejeitados.
      const mfaSelector = selectors.mfa?.input || selectors.mfa || DEFAULT_MFA_SELECTOR;
      const mfaRequired = await detectMfaScreen(page, mfaSelector);

      if (mfaRequired) {
        const mailCreds = credentials?.token_notification_email || credentials;
        const maxAttempts = 3;
        const testedCodes = [];
        let mfaTriggerTime = Date.now();
        const mfaStartedAt = Date.now();

        const preProvidedOtp = (credentials?.otpCode || "").trim();

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          let otpCode = preProvidedOtp && attempt === 1 ? preProvidedOtp : "";

          if (!otpCode) {
            if (mailCreds?.email && mailCreds?.password) {
              // ponytail: deadline compartilhado — evita 3×90s (=270s); budget total = MFA_TIMEOUT
              const elapsed = Date.now() - mfaStartedAt;
              const remainingMs = Math.max(0, MFA_TIMEOUT - elapsed);
              if (remainingMs <= 0) {
                console.warn(`[robotSession] Budget MFA esgotado antes da tentativa ${attempt}/${maxAttempts}.`);
                otpCode = null;
              } else {
                // mínimo 10s por tentativa para não abortar polling IMAP imediatamente
                const attemptBudget = Math.max(10000, Math.ceil(remainingMs / (maxAttempts - attempt + 1)));
                console.log(`[robotSession] Tentativa de resolução MFA ${attempt}/${maxAttempts} via IMAP (excluindo: [${testedCodes.join(", ")}], budget ${attemptBudget / 1000}s)...`);
                otpCode = await fetchMfaCodeViaImap(mailCreds, {
                  maxWaitMs: attemptBudget,
                  mfaMaxAgeMs: credentials?.mfa?.maxAgeMs,
                  mfaTriggerTime,
                  excludedCodes: testedCodes,
                });
              }
            }
          }

          if (!otpCode) {
            await captureDebugScreenshot(page, "login-mfa-required");
            throw createAuthError(
              "MFA_REQUIRED",
              `Login DocuSign exige código de segurança (MFA). Não foi possível extrair o código de segurança do e-mail na tentativa ${attempt}.`
            );
          }

          testedCodes.push(otpCode);

          if (typeof page.fill === "function") {
            await page.fill(mfaSelector, "").catch(() => {});
            await page.fill(mfaSelector, otpCode);
            if (typeof page.click === "function") {
              const mfaVerifySelector =
                selectors.mfa?.verify_button ||
                selectors.verify_button ||
                "button[data-qa='verify-code'], button:has-text('Verify'), [data-qa='verify-code'], button[data-testid='mfa-submit'], button[data-testid='verify-btn'], button[data-testid='submit-btn'], button[type='submit']";
              await page.click(mfaVerifySelector).catch(async () => {
                if (typeof page.keyboard?.press === "function") {
                  await page.keyboard.press("Enter").catch(() => {});
                } else {
                  await page.click(submitSelector).catch(() => {});
                }
              });
            }
          }

          if (typeof page.waitForURL === "function") {
            await page.waitForURL(
              (url) => !url.includes("account.docusign.com") && !url.includes("apps.docusign.com"),
              { timeout: 15000 }
            ).catch(() => {});
          }

          const currentUrlCheck = typeof page.url === "function" ? String(page.url()) : "";
          const isStillLogin = isLoginUrl(currentUrlCheck);

          if (!isStillLogin) {
            break;
          }

          // Ainda em login — verifica se input MFA persiste (código rejeitado)
          const mfaStillVisible =
            typeof page.waitForSelector === "function"
              ? await page
                  .waitForSelector(mfaSelector, { timeout: 3000 })
                  .then((el) => Boolean(el))
                  .catch(() => false)
              : false;

          if (mfaStillVisible) {
            console.warn(`[robotSession] DocuSign rejeitou código ${otpCode} na tentativa ${attempt}/${maxAttempts}.`);
            if (attempt < maxAttempts) {
              mfaTriggerTime = Date.now();
              await new Promise((resolve) => setTimeout(resolve, 3000));
              continue;
            } else {
              await captureDebugScreenshot(page, "login-otp-invalid");
              throw createAuthError(
                "OTP_INVALID",
                "Código temporário inválido ou expirado. Gere um novo código."
              );
            }
          } else {
            // Input MFA sumiu mas ainda em URL de login (ex.: interstitial DocuSign) — considera sucesso
            // e deixa validação final (finalUrl) decidir; evita falso OTP_INVALID
            console.log(`[robotSession] Input MFA não visível após tentativa ${attempt}, mas ainda em login URL — prosseguindo para validação final.`);
            break;
          }
        }
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

/**
 * Exportação padrão agregando utilitários de sessão do robô.
 * @type {{captureDebugScreenshot: function, saveSession: function, getSession: function, isSessionValid: function, applySessionToContext: function, loginAndSaveSession: function, getOrRefreshSession: function, invalidateSession: function}}
 */
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
