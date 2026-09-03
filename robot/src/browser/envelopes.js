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

import {
  executeUploadStep,
  executeFillRecipientsStep,
  executeAdvancePrepareStep,
  executeSubmitEnvelopeStep,
  executeExtractEnvelopeIdStep,
} from "./steps/index.js";

/**
 * Envia um envelope de contrato para assinatura na UI DocuSign orquestrando os steps modulares.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright autenticada.
 * @param {Object} envelopeData - Dados do envelope.
 * @param {string} [envelopeData.recipientName] - Nome do destinatário principal (legado).
 * @param {string} [envelopeData.recipientEmail] - E-mail do destinatário principal (legado).
 * @param {Array<{name: string, email: string}>} [envelopeData.recipients] - Lista de destinatários.
 * @param {string} envelopeData.pdfPath - Caminho local do PDF do contrato.
 * @param {Object} envelopeData.credentials - Credenciais DocuSign para autenticação.
 * @param {string} [envelopeData.sessionPath] - Caminho opcional do arquivo storageState de sessão.
 * @param {string} [envelopeData.envelopeId] - ID prévio do envelope.
 * @returns {Promise<{envelopeId: string, recipientName: string, recipientEmail: string, status: string, sentAt: string}>} Resultado do envio.
 * @throws {Error} Caso arquivo PDF inexista ou ocorra falha de navegação.
 */
export async function sendEnvelope(page, envelopeData) {
  const { recipientName, recipientEmail, recipients, pdfPath, credentials, sessionPath, envelopeId: existingEnvelopeId } = envelopeData;

  await ensureAuthenticated(page, credentials, { sessionPath });

  const primaryName = recipientName || recipients?.[0]?.name || "Destinatário";
  const primaryEmail = recipientEmail || recipients?.[0]?.email || "";
  logger.step("Browser", `Iniciando pipeline de envio de envelope para ${primaryName} (${primaryEmail})...`);

  const sendSel = selectors.send;

  // Passo 1: Upload do documento PDF
  await executeUploadStep(page, pdfPath, sendSel);

  // Passos 2 a 5: Preenchimento de destinatários (loop com isolamento posicional .nth(i) e checkbox de entrega)
  const recipientsList = recipients && recipients.length > 0
    ? recipients
    : [{ name: recipientName, email: recipientEmail }];
  await executeFillRecipientsStep(page, recipientsList, sendSel);

  // Passo 6: Avançar na tela de preparação
  await executeAdvancePrepareStep(page, sendSel);

  // Passos 7 e 8: Enviar envelope e confirmar modal "Enviar sem campos" (espera 15s)
  await executeSubmitEnvelopeStep(page, sendSel);

  // Captura do Envelope ID em cascata de 3 níveis (null = falha explícita, anti-phantom AD-046)
  const extractedEnvelopeId = await executeExtractEnvelopeIdStep(page, existingEnvelopeId);
  if (!extractedEnvelopeId) {
    throw new Error("Envelope enviado mas Envelope ID não capturado via URL, listagem ou fallback do job.");
  }

  // Persiste cookies atualizados após envio bem-sucedido
  await saveSessionState(page, sessionPath);

  logger.success("Browser", `Contrato enviado com sucesso! Envelope ID: ${extractedEnvelopeId}`);
  return {
    envelopeId: extractedEnvelopeId,
    recipientName: primaryName,
    recipientEmail: primaryEmail,
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
