import fs from "node:fs";
import path from "node:path";
import selectors from "./selectors.js";
import { fetchMfaCodeFromRoundcube } from "./roundcube.js";
import { fetchMfaCodeViaImap } from "./imapClient.js";
import logger from "../utils/logger.js";

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
 * Garante que a página do Playwright está autenticada na DocuSign.
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {Object} credentials - Credenciais DocuSign ({ email, password, token_notification_email }).
 * @param {string} credentials.email - E-mail de login DocuSign.
 * @param {string} credentials.password - Senha de login DocuSign.
 * @param {Object} [options={}] - Opções adicionais de autenticação e sessão.
 * @param {string} [options.sessionPath] - Caminho do arquivo storageState para persistência da sessão.
 * @returns {Promise<void>} Resolve quando a autenticação (incluindo MFA) for concluída.
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
  const isLoginPage =
    currentUrl.includes("account.docusign.com") ||
    currentUrl.includes("/oauth/") ||
    currentUrl.includes("/login") ||
    currentUrl.includes("identity.");

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

    // Aguarda potencial tela de MFA ou redirecionamento direto
    await randomDelay(2500, 4000);

    const mfaSel = selectors.mfa || {};

    // Verifica se a tela de MFA está presente pelo texto ou seletor específico
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
      logger.step("Browser", "🔍 Tela de verificação (MFA/2FA) da DocuSign localizada! Iniciando resolução de código...");
      let mfaTriggerTime = Date.now();
      const mailCreds = credentials.token_notification_email || credentials;
      const testedCodes = [];
      const MAX_MFA_ATTEMPTS = 3;
      let authenticated = false;

      for (let attempt = 1; attempt <= MAX_MFA_ATTEMPTS; attempt++) {
        logger.step("Browser", `Tentativa de verificação MFA ${attempt}/${MAX_MFA_ATTEMPTS}...`);
        let otpCode = null;

        // 1. Consulta prioritária rápida e headless via protocolo IMAP nativo
        if (mailCreds?.email && mailCreds?.password) {
          try {
            logger.step("Browser", "Iniciando consulta ao servidor de e-mail via IMAP nativo...");
            otpCode = await fetchMfaCodeViaImap(mailCreds, {
              maxWaitMs: 90000,
              excludedCodes: testedCodes,
              mfaTriggerTime,
            });
          } catch (imapErr) {
            logger.warn("Browser", `Consulta IMAP retornou erro: ${imapErr.message}`);
          }
        }

        // 2. Fallback visual para Roundcube Webmail caso IMAP não encontre ou falhe
        if (!otpCode) {
          logger.step("Browser", "IMAP não retornou código. Executando fallback via Webmail Roundcube...");
          otpCode = await fetchMfaCodeFromRoundcube(page.context(), mailCreds, {
            maxWaitMs: 90000,
            mfaTriggerTime,
            excludedCodes: testedCodes,
          });
          if (otpCode && testedCodes.includes(otpCode)) {
            logger.warn("Browser", `Código obtido via Roundcube (${otpCode}) já foi rejeitado anteriormente.`);
            otpCode = null;
          }
        }

        if (!otpCode) {
          const err = new Error(`DocuSign solicitou código MFA (tentativa ${attempt}), mas não foi possível extrair um novo código de segurança do e-mail.`);
          logger.error("Browser", err.message);
          throw err;
        }

        testedCodes.push(otpCode);
        logger.success("Browser", `Código de verificação obtido: ${otpCode}. Preenchendo campo na tela DocuSign...`);

        // Limpa o campo antes de preencher
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

        // Aguarda resposta da tela
        await randomDelay(2000, 3500);

        const afterUrl = page.url();
        const stillInAuth =
          afterUrl.includes("account.docusign.com") ||
          afterUrl.includes("/oauth/") ||
          afterUrl.includes("/login") ||
          afterUrl.includes("identity.");

        // Detecta se a mensagem de código inválido apareceu
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
          // Aguarda redirecionamento caso não haja erro imediato
          await page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
          const postCheckUrl = page.url();
          const isStillLogin =
            postCheckUrl.includes("account.docusign.com") ||
            postCheckUrl.includes("/oauth/") ||
            postCheckUrl.includes("/login") ||
            postCheckUrl.includes("identity.");
          if (!isStillLogin) {
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
 * Envia um envelope de contrato para assinatura na UI DocuSign.
 * @param {import('playwright').Page} page - Instância da página Playwright autenticada.
 * @param {Object} envelopeData - Dados do envelope.
 * @param {string} envelopeData.recipientName - Nome do destinatário.
 * @param {string} envelopeData.recipientEmail - E-mail do destinatário.
 * @param {string} [envelopeData.subject] - Assunto do e-mail.
 * @param {string} [envelopeData.message] - Mensagem do e-mail.
 * @param {string} envelopeData.pdfPath - Caminho local do PDF do contrato.
 * @param {Object} envelopeData.credentials - Credenciais DocuSign para autenticação.
 * @param {string} [envelopeData.sessionPath] - Caminho opcional do arquivo storageState de sessão.
 * @returns {Promise<{envelopeId: string, recipientName: string, recipientEmail: string, status: string, sentAt: string}>} Resultado do envio.
 */
export async function sendEnvelope(page, envelopeData) {
  const { recipientName, recipientEmail, subject, message, pdfPath, credentials, sessionPath } = envelopeData;

  await ensureAuthenticated(page, credentials, { sessionPath });

  logger.step("Browser", `Iniciando envio de contrato para ${recipientName} (${recipientEmail})...`);
  const sendSel = selectors.send;

  await page.goto(sendSel.url, { waitUntil: "networkidle", timeout: 45000 });
  await randomDelay(1500, 3000);

  const postNavUrl = page.url();
  if (
    postNavUrl.includes("account.docusign.com") ||
    postNavUrl.includes("/oauth/") ||
    postNavUrl.includes("/login") ||
    postNavUrl.includes("identity.")
  ) {
    logger.warn("Browser", `Redirecionamento para login detectado durante navegação para envio (${postNavUrl}). Reautenticando...`);
    await ensureAuthenticated(page, credentials, { sessionPath });
    await page.goto(sendSel.url, { waitUntil: "networkidle", timeout: 45000 });
    const secondNavUrl = page.url();
    if (
      secondNavUrl.includes("account.docusign.com") ||
      secondNavUrl.includes("/oauth/") ||
      secondNavUrl.includes("/login") ||
      secondNavUrl.includes("identity.")
    ) {
      const err = new Error(`Falha de autenticação persistente na navegação de envio (${secondNavUrl}).`);
      logger.error("Browser", err.message);
      throw err;
    }
  }

  // 1. Upload do Arquivo PDF
  if (pdfPath && fs.existsSync(pdfPath)) {
    logger.step("Browser", `Anexando arquivo PDF do contrato: ${pdfPath}`);
    await page.setInputFiles(sendSel.file_input, pdfPath);
    await randomDelay(3000, 5000);
    logger.success("Browser", "Arquivo PDF anexado com sucesso na DocuSign.");
  } else {
    const err = new Error(`Arquivo PDF do contrato não encontrado localmente: ${pdfPath}`);
    logger.error("Browser", err.message);
    throw err;
  }

  // 2. Preenchimento de Destinatário
  if (recipientName) {
    logger.step("Browser", `Preenchendo nome do destinatário: ${recipientName}`);
    await page.fill(sendSel.recipient_name, recipientName);
    await randomDelay(500, 1000);
  }

  if (recipientEmail) {
    logger.step("Browser", `Preenchendo e-mail do destinatário: ${recipientEmail}`);
    await page.fill(sendSel.recipient_email, recipientEmail);
    await randomDelay(500, 1000);
  }

  // 3. Assunto e Mensagem
  if (subject) {
    await page.fill(sendSel.subject_input, subject);
    await randomDelay(500, 1000);
  }

  if (message) {
    await page.fill(sendSel.message_textarea, message);
    await randomDelay(500, 1000);
  }

  // 4. Disparo do Envio
  logger.step("Browser", "Clicando no botão de envio do envelope...");
  await page.click(sendSel.send_button);
  await randomDelay(3000, 6000);

  // 5. Captura do Envelope ID
  const finalUrl = page.url();
  const match = finalUrl.match(/\/envelopes\/([a-zA-Z0-9-]+)/i);
  const envelopeId = match ? match[1] : `env-${Date.now()}`;

  // Persiste cookies atualizados após envio bem-sucedido
  await saveSessionState(page, sessionPath);

  logger.success("Browser", `Contrato enviado com sucesso! Envelope ID: ${envelopeId}`);
  return {
    envelopeId,
    recipientName,
    recipientEmail,
    status: "sent",
    sentAt: new Date().toISOString(),
  };
}

/**
 * Consulta o status de um envelope existente.
 * @param {import('playwright').Page} page - Instância da página Playwright autenticada.
 * @param {string} envelopeId - Identificador do envelope DocuSign.
 * @param {Object} credentials - Credenciais DocuSign para autenticação.
 * @param {Object} [options={}] - Opções adicionais de consulta.
 * @param {string} [options.sessionPath] - Caminho opcional do arquivo storageState de sessão.
 * @returns {Promise<{envelopeId: string, status: string, checkedAt: string}>} Status atual do envelope.
 */
export async function checkEnvelopeStatus(page, envelopeId, credentials, options = {}) {
  const sessionPath = options.sessionPath || options.sessionFilePath;
  await ensureAuthenticated(page, credentials, { sessionPath });
  const targetUrl = `${selectors.baseUrl}/documents/${envelopeId}`;
  logger.step("Browser", `Consultando status do envelope: ${envelopeId}...`);
  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });

  const postNavUrl = page.url();
  if (
    postNavUrl.includes("account.docusign.com") ||
    postNavUrl.includes("/oauth/") ||
    postNavUrl.includes("/login") ||
    postNavUrl.includes("identity.")
  ) {
    logger.warn("Browser", `Redirecionamento para login detectado durante consulta de status (${postNavUrl}). Reautenticando...`);
    await ensureAuthenticated(page, credentials, { sessionPath });
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
    const secondNavUrl = page.url();
    if (
      secondNavUrl.includes("account.docusign.com") ||
      secondNavUrl.includes("/oauth/") ||
      secondNavUrl.includes("/login") ||
      secondNavUrl.includes("identity.")
    ) {
      const err = new Error(`Falha de autenticação persistente na consulta de status (${secondNavUrl}).`);
      logger.error("Browser", err.message);
      throw err;
    }
  }

  const badgeEl = await page.$(selectors.status.status_badge);
  const statusText = badgeEl ? (await badgeEl.innerText()).trim().toLowerCase() : "unknown";

  // Persiste cookies atualizados após consulta de status
  await saveSessionState(page, sessionPath);

  logger.success("Browser", `Status do envelope ${envelopeId}: ${statusText}`);
  return {
    envelopeId,
    status: statusText,
    checkedAt: new Date().toISOString(),
  };
}

export default {
  ensureAuthenticated,
  saveSessionState,
  sendEnvelope,
  checkEnvelopeStatus,
};

