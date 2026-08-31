/**
 * @file Orquestra o passo a passo sequencial de envio de envelope no DocuSign.
 * Segue o padrão de pipeline: nenhuma lógica de negócio vive aqui — apenas chamadas de função em ordem.
 */

// Atomic Imports
import { resolveSelectors, assertPage } from "./stepUtils.js";
import { ensureAuthenticated } from "./authStep.js";
import { uploadDocument } from "./uploadDocumentStep.js";
import { fillRecipient } from "./fillRecipientStep.js";
import { fillMessage } from "./fillMessageStep.js";
import { submitEnvelope } from "./submitEnvelopeStep.js";
import { extractEnvelopeId } from "./extractEnvelopeIdStep.js";
import robotSession from "../robotSession.js";

/**
 * Envia um envelope DocuSign orquestrando os steps de navegação em sequência.
 * Nenhuma lógica de negócio vive aqui — apenas chamadas de função em ordem.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} envelopeData - Dados do envelope.
 * @param {string} envelopeData.recipientName - Nome do destinatário.
 * @param {string} envelopeData.recipientEmail - E-mail do destinatário.
 * @param {string} [envelopeData.message] - Mensagem do envelope.
 * @param {string} [envelopeData.subject] - Assunto do envelope.
 * @param {string} [envelopeData.documentPath] - Caminho do arquivo PDF.
 * @param {string} [envelopeData.envelopeId] - ID existente ou fallback.
 * @param {Object} [envelopeData.credentials] - Credenciais do robô (email/senha).
 * @returns {Promise<string>} ID do envelope enviado.
 * @throws {Error} Lança erro caso a validação ou alguma etapa falhe.
 * @async
 */
const sendEnvelope = async (page, envelopeData = {}) => {
  assertPage(page);

  const { recipientName, recipientEmail, message, subject, documentPath, envelopeId } = envelopeData;
  if (!recipientName || !recipientEmail) {
    throw new Error("recipientName and recipientEmail are required for send operation");
  }

  // Passo 1: Resolver seletores e URL de destino
  const selectors = resolveSelectors();
  const sendSel = selectors.send || {};
  const targetUrl = sendSel.url || `${selectors.baseUrl || "https://app.docusign.com"}/send`;
  const email = envelopeData.credentials?.email;

  try {
    // Passo 2: Garantir autenticação
    await ensureAuthenticated(page, targetUrl, envelopeData, selectors);

    // Passo 3: Upload do documento
    await uploadDocument(page, sendSel, documentPath, email);

    // Passo 4: Preencher destinatário
    await fillRecipient(page, sendSel, { recipientName, recipientEmail }, email);

    // Passo 5: Preencher mensagem e assunto
    await fillMessage(page, sendSel, { subject, message }, email);

    // Passo 6: Submeter envelope
    await submitEnvelope(page, sendSel, email);

    // Passo 7: Extrair e retornar ID do envelope
    return await extractEnvelopeId(page, sendSel, envelopeId);
  } catch (err) {
    await robotSession.captureDebugScreenshot(page, "send-failure").catch(() => {});
    throw err;
  }
};

export { sendEnvelope };
