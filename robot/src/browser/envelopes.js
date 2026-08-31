import fs from "node:fs";
import selectors from "./selectors.js";
import { ensureAuthenticated, saveSessionState, randomDelay, isAuthenticationUrl } from "./auth.js";
import logger from "../utils/logger.js";

/**
 * Garante que a página não foi redirecionada para a tela de autenticação durante uma navegação.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {string} targetUrl - URL de destino pretendida.
 * @param {Object} credentials - Credenciais DocuSign.
 * @param {string} [sessionPath] - Caminho da sessão.
 * @param {string} operationName - Nome da operação para logging.
 * @returns {Promise<void>}
 * @throws {Error} Caso a autenticação persista falhando.
 */
async function ensureNotRedirectedToLogin(page, targetUrl, credentials, sessionPath, operationName) {
  const currentUrl = page.url();
  if (isAuthenticationUrl(currentUrl)) {
    logger.warn("Browser", `Redirecionamento para login detectado durante ${operationName} (${currentUrl}). Reautenticando...`);
    await ensureAuthenticated(page, credentials, { sessionPath });
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 45000 });
    const postReauthUrl = page.url();
    if (isAuthenticationUrl(postReauthUrl)) {
      const err = new Error(`Falha de autenticação persistente na navegação de ${operationName} (${postReauthUrl}).`);
      logger.error("Browser", err.message);
      throw err;
    }
  }
}

/**
 * Envia um envelope de contrato para assinatura na UI DocuSign.
 * @async
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
 * @throws {Error} Caso arquivo PDF inexista ou ocorra falha de navegação.
 */
export async function sendEnvelope(page, envelopeData) {
  const { recipientName, recipientEmail, subject, message, pdfPath, credentials, sessionPath } = envelopeData;

  await ensureAuthenticated(page, credentials, { sessionPath });

  logger.step("Browser", `Iniciando envio de contrato para ${recipientName} (${recipientEmail})...`);
  const sendSel = selectors.send;

  await page.goto(sendSel.url, { waitUntil: "networkidle", timeout: 45000 });
  await randomDelay(1500, 3000);

  await ensureNotRedirectedToLogin(page, sendSel.url, credentials, sessionPath, "envio");

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
 * Consulta o status de um envelope existente na interface DocuSign.
 * @async
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

  await ensureNotRedirectedToLogin(page, targetUrl, credentials, sessionPath, "consulta de status");

  const badgeEl = await page.$(selectors.status.status_badge);
  const statusText = badgeEl ? (await badgeEl.innerText()).trim().toLowerCase() : "unknown";

  await saveSessionState(page, sessionPath);

  logger.success("Browser", `Status do envelope ${envelopeId}: ${statusText}`);
  return {
    envelopeId,
    status: statusText,
    checkedAt: new Date().toISOString(),
  };
}

export default {
  sendEnvelope,
  checkEnvelopeStatus,
};
