import fs from "node:fs";
import path from "node:path";
import selectors from "./selectors.js";
import { fetchMfaCodeFromRoundcube } from "./roundcube.js";
import { fetchMfaCodeViaImap, DEFAULT_MFA_MAX_WAIT_MS, DEFAULT_MFA_MAX_AGE_MS } from "./imapClient.js";
import logger from "../utils/logger.js";

/**
 * Quantidade máxima de tentativas para resolução de MFA.
 * @constant
 * @type {number}
 */
const MAX_MFA_ATTEMPTS = 3;

/**
 * URLs conhecidas que indicam que a página atual é de autenticação.
 * @constant
 * @type {string[]}
 */
const AUTH_URL_INDICATORS = ["account.docusign.com", "/oauth/", "/login", "identity."];

/**
 * Aplica um delay randômico entre ações para anti-detecção de bots.
 * @param {number} [minMs=800] - Tempo mínimo em milissegundos.
 * @param {number} [maxMs=2000] - Tempo máximo em milissegundos.
 * @returns {Promise<void>} Promise resolvida após o delay.
 */
export async function randomDelay(minMs = 800, maxMs = 2000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verifica se a URL atual corresponde a uma página de login/autenticação.
 * @param {string} url - URL atual da página.
 * @returns {boolean} True se a página for de login.
 */
export function isAuthenticationUrl(url) {
  if (!url || typeof url !== "string") return false;
  return AUTH_URL_INDICATORS.some((indicator) => url.includes(indicator));
}

/**
 * Salva o estado atual de autenticação (storageState) no caminho especificado de forma segura.
 * Cria diretórios pai se não existirem e aplica restrição de permissão 0o600.
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {string} sessionPath - Caminho de destino do arquivo storageState.
 * @returns {Promise<void>}
 */
export async function saveSessionState(page, sessionPath) {
  if (!sessionPath || typeof page?.context !== "function") return;
  try {
    const ctx = page.context();
    if (ctx && typeof ctx.storageState === "function") {
      const dir = path.dirname(sessionPath);
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      logger.step("Browser", `Salvando estado de autenticação (storageState) em: ${sessionPath}...`);
      await ctx.storageState({ path: sessionPath });
      try {
        fs.chmodSync(sessionPath, 0o600);
      } catch (_) {}
      logger.success("Browser", `Sessão persistida com sucesso em: ${sessionPath}`);
    }
  } catch (saveErr) {
    logger.warn("Browser", `Falha ao persistir storageState: ${saveErr.message}`);
  }
}

/**
 * Resolve o código de MFA consultando primeiro via IMAP nativo e fallback para Roundcube Webmail.
 * @async
 * @param {import('playwright').BrowserContext} context - Contexto do navegador Playwright.
 * @param {Object} mailCreds - Credenciais do e-mail de notificação.
 * @param {Object} options - Parâmetros de busca do MFA.
 * @param {number} options.mfaMaxWaitMs - Tempo máximo de espera em ms.
 * @param {number} options.mfaMaxAgeMs - Idade máxima do e-mail em ms.
 * @param {number} options.mfaTriggerTime - Timestamp de disparo da solicitação.
 * @param {string[]} options.testedCodes - Lista de códigos já tentados e rejeitados.
 * @returns {Promise<string|null>} Código de 6 dígitos encontrado ou null.
 */
async function resolveMfaCode(context, mailCreds, { mfaMaxWaitMs, mfaMaxAgeMs, mfaTriggerTime, testedCodes }) {
  let otpCode = null;

  // 1. Consulta prioritária via IMAP nativo
  if (mailCreds?.email && mailCreds?.password) {
    try {
      logger.step("Browser", "Iniciando consulta ao servidor de e-mail via IMAP nativo...");
      otpCode = await fetchMfaCodeViaImap(mailCreds, {
        maxWaitMs: mfaMaxWaitMs,
        mfaMaxAgeMs,
        excludedCodes: testedCodes,
        mfaTriggerTime,
      });
    } catch (imapErr) {
      logger.warn("Browser", `Consulta IMAP retornou erro: ${imapErr.message}`);
    }
  }

  // 2. Fallback visual para Roundcube Webmail
  if (!otpCode && context) {
    logger.step("Browser", "IMAP não retornou código. Executando fallback via Webmail Roundcube...");
    otpCode = await fetchMfaCodeFromRoundcube(context, mailCreds, {
      maxWaitMs: mfaMaxWaitMs,
      mfaMaxAgeMs,
      mfaTriggerTime,
      excludedCodes: testedCodes,
    });
    if (otpCode && testedCodes.includes(otpCode)) {
      logger.warn("Browser", `Código obtido via Roundcube (${otpCode}) já foi rejeitado anteriormente.`);
      otpCode = null;
    }
  }

  return otpCode;
}

/**
 * Trata o fluxo interativo de autenticação MFA/2FA na DocuSign.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {Object} credentials - Credenciais DocuSign e de e-mail.
 * @returns {Promise<void>}
 * @throws {Error} Quando o código MFA não puder ser validado.
 */
async function handleMfaFlow(page, credentials) {
  logger.step("Browser", "🔍 Tela de verificação (MFA/2FA) da DocuSign localizada! Iniciando resolução de código...");
  let mfaTriggerTime = Date.now();
  const mailCreds = credentials.token_notification_email || credentials;
  const mfaSel = selectors.mfa || {};

  const mfaMaxAgeMs = Number(credentials?.mfa?.maxAgeMs || mailCreds?.mfaMaxAgeMs || process.env.MFA_MAX_AGE_MS || DEFAULT_MFA_MAX_AGE_MS);
  const mfaMaxWaitMs = Number(credentials?.mfa?.maxWaitMs || mailCreds?.mfaMaxWaitMs || process.env.MFA_MAX_WAIT_MS || DEFAULT_MFA_MAX_WAIT_MS);
  const testedCodes = [];
  let authenticated = false;

  for (let attempt = 1; attempt <= MAX_MFA_ATTEMPTS; attempt++) {
    logger.step("Browser", `Tentativa de verificação MFA ${attempt}/${MAX_MFA_ATTEMPTS}...`);

    const otpCode = await resolveMfaCode(page.context(), mailCreds, {
      mfaMaxWaitMs,
      mfaMaxAgeMs,
      mfaTriggerTime,
      testedCodes,
    });

    if (!otpCode) {
      const err = new Error(`DocuSign solicitou código MFA (tentativa ${attempt}), mas não foi possível extrair um novo código de segurança do e-mail.`);
      logger.error("Browser", err.message);
      throw err;
    }

    testedCodes.push(otpCode);
    logger.success("Browser", `Código de verificação obtido: ${otpCode}. Preenchendo campo na tela DocuSign...`);

    await page.fill(mfaSel.input || "input[type='tel']", "").catch(() => {});
    await randomDelay(200, 400);
    await page.fill(mfaSel.input || "input[type='tel']", otpCode);
    await randomDelay(500, 1000);

    const verifyBtn = await page.$(mfaSel.verify_button).catch(() => null);
    if (verifyBtn) {
      logger.step("Browser", "Clicando no botão de verificação/confirmação...");
      await verifyBtn.click();
    } else {
      logger.step("Browser", "Submetendo verificação via teclado (Enter)...");
      await page.keyboard.press("Enter");
    }

    await randomDelay(2000, 3500);

    const afterUrl = page.url();
    const stillInAuth = isAuthenticationUrl(afterUrl);

    const invalidErrorLocator = page.locator("text=/The code entered is invalid/i").first();
    const hasInvalidError = await invalidErrorLocator.isVisible().catch(() => false);

    if (!stillInAuth) {
      logger.success("Browser", "Código de verificação aceito! Navegação pós-login bem-sucedida.");
      authenticated = true;
      break;
    }

    if (hasInvalidError) {
      logger.warn("Browser", `⚠️ DocuSign rejeitou o código ${otpCode} ('The code entered is invalid. Please try again.').`);
      if (attempt < MAX_MFA_ATTEMPTS) {
        logger.step("Browser", "Limpando campo de código e aguardando chegada do novo e-mail da DocuSign...");
        await page.fill(mfaSel.input || "input[type='tel']", "").catch(() => {});
        mfaTriggerTime = Date.now();
        await randomDelay(3000, 5000);
        continue;
      }
    } else {
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
      const postCheckUrl = page.url();
      if (!isAuthenticationUrl(postCheckUrl)) {
        logger.success("Browser", "Código de verificação aceito e login concluído!");
        authenticated = true;
        break;
      }
    }
  }

  if (!authenticated) {
    const err = new Error("Falha na validação do código MFA da DocuSign após múltiplas tentativas.");
    logger.error("Browser", err.message);
    throw err;
  }
}

/**
 * Garante que a página do Playwright está autenticada na DocuSign.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {Object} credentials - Credenciais DocuSign ({ email, password, token_notification_email }).
 * @param {string} credentials.email - E-mail de login DocuSign.
 * @param {string} credentials.password - Senha de login DocuSign.
 * @param {Object} [options={}] - Opções adicionais de autenticação e sessão.
 * @param {string} [options.sessionPath] - Caminho do arquivo storageState para persistência da sessão.
 * @returns {Promise<void>} Resolve quando a autenticação (incluindo MFA) for concluída.
 * @throws {Error} Caso credenciais estejam ausentes ou autenticação falhe.
 */
export async function ensureAuthenticated(page, credentials, options = {}) {
  const sessionPath =
    options.sessionPath ||
    options.sessionFilePath ||
    process.env.DOCUSIGN_SESSION_PATH ||
    path.resolve(process.cwd(), "session-docusign.json");

  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  logger.step("Browser", `Navegando para DocuSign: ${baseUrl}...`);

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 45000 });
  await randomDelay(1000, 2000);

  const currentUrl = page.url();
  const isLoginPage = isAuthenticationUrl(currentUrl);

  if (isLoginPage) {
    if (sessionPath && fs.existsSync(sessionPath)) {
      logger.step("Browser", "Sessão anterior expirada ou inválida. Limpando arquivo de sessão local...");
      try {
        fs.unlinkSync(sessionPath);
      } catch (unlinkErr) {
        logger.warn("Browser", `Falha ao remover arquivo de sessão expirado: ${unlinkErr.message}`);
      }
    }

    logger.step("Browser", `Tela de autenticação identificada (${currentUrl}). Preenchendo credenciais...`);

    const loginSel = selectors.login;
    const email = credentials?.email;
    const password = credentials?.password;

    if (!email || !password) {
      const err = new Error("Credenciais da DocuSign não fornecidas pela API central.");
      logger.error("Browser", err.message);
      throw err;
    }

    // Preenche e submete e-mail
    logger.step("Browser", `Inserindo e-mail DocuSign: ${email}...`);
    await page.fill(loginSel.email_input, email);
    await randomDelay(500, 1000);
    await page.keyboard.press("Enter");
    await randomDelay(1500, 3000);

    // Aguarda campo de senha
    await page.waitForSelector(loginSel.password_input, { timeout: 15000 });
    logger.step("Browser", "Inserindo senha DocuSign...");
    await page.fill(loginSel.password_input, password);
    await randomDelay(500, 1000);
    await page.keyboard.press("Enter");

    await randomDelay(2500, 4000);

    const mfaSel = selectors.mfa || {};
    const textLocator = page.locator("text=/Get Code From Your Email/i").first();
    const hasTextTrigger = await textLocator.isVisible().catch(() => false);

    if (hasTextTrigger) {
      logger.step("Browser", "🔍 Detectada indicação de MFA com texto 'Get Code From Your Email'.");
      const emailOptionBtn = page.locator(mfaSel.email_option_btn || "text=/Get Code From Your Email/i").first();
      if (await emailOptionBtn.isVisible().catch(() => false)) {
        logger.step("Browser", "Clicando na opção 'Get Code From Your Email' para solicitar código...");
        await emailOptionBtn.click().catch(() => {});
        await randomDelay(1500, 2500);
      }
    }

    let mfaInput = await page.$(mfaSel.input || "input[name='security_code'], input[placeholder='Enter code'], input[type='tel']").catch(() => null);

    if (!mfaInput && hasTextTrigger) {
      logger.step("Browser", "Aguardando campo de código MFA renderizar na tela...");
      mfaInput = await page.waitForSelector(mfaSel.input, { timeout: 10000 }).catch(() => null);
    }

    if (mfaInput) {
      await handleMfaFlow(page, credentials);
    } else {
      logger.step("Browser", "Nenhuma tela de verificação (MFA) exigida nesta sessão. Aguardando redirecionamento...");
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      await randomDelay(2000, 4000);
    }

    logger.success("Browser", "Autenticação na DocuSign concluída com sucesso.");
    await saveSessionState(page, sessionPath);
  } else {
    logger.success("Browser", `Sessão ativa detectada na DocuSign (${currentUrl}).`);
    await saveSessionState(page, sessionPath);
  }
}

export default {
  randomDelay,
  isAuthenticationUrl,
  saveSessionState,
  ensureAuthenticated,
};
