import fs from "node:fs";
import path from "node:path";
import selectors from "./selectors.js";
import { fetchMfaCodeFromRoundcube } from "./roundcube.js";

/**
 * Aplica um delay randômico entre ações para anti-detecção de bots.
 */
export async function randomDelay(minMs = 800, maxMs = 2000) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Garante que a página do Playwright está autenticada na DocuSign.
 */
export async function ensureAuthenticated(page, credentials) {
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  console.log(`[Browser] Acessando DocuSign: ${baseUrl}...`);

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 45000 });
  await randomDelay(1000, 2000);

  const currentUrl = page.url();
  const isLoginPage =
    currentUrl.includes("account.docusign.com") ||
    currentUrl.includes("/oauth/") ||
    currentUrl.includes("/login") ||
    currentUrl.includes("identity.");

  if (isLoginPage) {
    console.log(`[Browser] Tela de autenticação detectada (${currentUrl}). Preenchendo credenciais...`);

    const loginSel = selectors.login;
    const email = credentials?.email;
    const password = credentials?.password;

    if (!email || !password) {
      throw new Error("Credenciais da DocuSign não fornecidas pela API central.");
    }

    // Preenche e submete e-mail
    await page.fill(loginSel.email_input, email);
    await randomDelay(500, 1000);
    await page.keyboard.press("Enter");
    await randomDelay(1500, 3000);

    // Aguarda campo de senha
    await page.waitForSelector(loginSel.password_input, { timeout: 15000 });
    await page.fill(loginSel.password_input, password);
    await randomDelay(500, 1000);
    await page.keyboard.press("Enter");

    // Aguarda potencial tela de MFA ou redirecionamento direto
    await randomDelay(2000, 3500);

    const mfaSel = selectors.mfa || {};
    const mfaInput = await page.$(mfaSel.input || "input[type='tel']").catch(() => null);

    if (mfaInput) {
      console.log("[Browser] Tela de MFA/2FA detectada. Buscando código no Webmail Roundcube...");
      const mailCreds = credentials.token_notification_email || credentials;
      const otpCode = await fetchMfaCodeFromRoundcube(page.context(), mailCreds);

      if (!otpCode) {
        throw new Error("DocuSign solicitou código MFA, mas não foi possível extrair o código de segurança do Webmail.");
      }

      console.log(`[Browser] Preenchendo código MFA: ${otpCode}...`);
      await page.fill(mfaSel.input || "input[type='tel']", otpCode);
      await randomDelay(500, 1000);

      const verifyBtn = await page.$(mfaSel.verify_button).catch(() => null);
      if (verifyBtn) {
        await verifyBtn.click();
      } else {
        await page.keyboard.press("Enter");
      }

      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
      await randomDelay(2000, 4000);
    } else {
      // Aguarda redirecionamento normal pós-login
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      await randomDelay(2000, 4000);
    }

    console.log("[Browser] Login efetuado com sucesso.");
  }
}

/**
 * Envia um envelope de contrato para assinatura na UI DocuSign.
 */
export async function sendEnvelope(page, envelopeData) {
  const { recipientName, recipientEmail, subject, message, pdfPath, credentials } = envelopeData;

  await ensureAuthenticated(page, credentials);

  console.log(`[Browser] Iniciando envio de contrato para ${recipientName} (${recipientEmail})...`);
  const sendSel = selectors.send;

  await page.goto(sendSel.url, { waitUntil: "networkidle", timeout: 45000 });
  await randomDelay(1500, 3000);

  // 1. Upload do Arquivo PDF
  if (pdfPath && fs.existsSync(pdfPath)) {
    console.log(`[Browser] Anexando PDF: ${pdfPath}`);
    await page.setInputFiles(sendSel.file_input, pdfPath);
    await randomDelay(3000, 5000);
  } else {
    throw new Error(`Arquivo PDF do contrato não encontrado localmente: ${pdfPath}`);
  }

  // 2. Preenchimento de Destinatário
  if (recipientName) {
    await page.fill(sendSel.recipient_name, recipientName);
    await randomDelay(500, 1000);
  }

  if (recipientEmail) {
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
  console.log("[Browser] Clicando no botão de envio...");
  await page.click(sendSel.send_button);
  await randomDelay(3000, 6000);

  // 5. Captura do Envelope ID
  const finalUrl = page.url();
  const match = finalUrl.match(/\/envelopes\/([a-zA-Z0-9-]+)/i);
  const envelopeId = match ? match[1] : `env-${Date.now()}`;

  console.log(`[Browser] Contrato enviado com sucesso! Envelope ID: ${envelopeId}`);
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
 */
export async function checkEnvelopeStatus(page, envelopeId, credentials) {
  await ensureAuthenticated(page, credentials);
  const targetUrl = `${selectors.baseUrl}/documents/${envelopeId}`;
  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });

  const badgeEl = await page.$(selectors.status.status_badge);
  const statusText = badgeEl ? (await badgeEl.innerText()).trim().toLowerCase() : "unknown";

  return {
    envelopeId,
    status: statusText,
    checkedAt: new Date().toISOString(),
  };
}

export default {
  ensureAuthenticated,
  sendEnvelope,
  checkEnvelopeStatus,
};
