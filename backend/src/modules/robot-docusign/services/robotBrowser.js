/**
 * @file Orquestrador e fachada principal das operações de automação de navegador do DocuSign via Playwright.
 * Importa e executa cada etapa (steps) de forma modular, linear e desacoplada.
 */

import { resolveSelectors } from "./steps/stepUtils.js";
import { ensureAuthenticated } from "./steps/authStep.js";
import { uploadDocument } from "./steps/uploadDocumentStep.js";
import { fillRecipient } from "./steps/fillRecipientStep.js";
import { fillMessage } from "./steps/fillMessageStep.js";
import { submitEnvelope } from "./steps/submitEnvelopeStep.js";
import { extractEnvelopeId } from "./steps/extractEnvelopeIdStep.js";
import { checkStatus } from "./steps/statusStep.js";
import { downloadDocument } from "./steps/downloadStep.js";
import { resendEnvelope } from "./steps/resendStep.js";
import { extractReports } from "./steps/reportsStep.js";
import { withRetry } from "./steps/retryStep.js";
import { fetchAgreementsByRepresentative } from "./agreementsService.js";
import robotSession from "./robotSession.js";

/**
 * Navega para a página de envio, preenche os dados do destinatário e mensagem, realiza o envio e retorna o ID do envelope.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} envelopeData - Objeto contendo os dados para criação do envelope.
 * @param {string} envelopeData.recipientName - Nome completo do destinatário.
 * @param {string} envelopeData.recipientEmail - E-mail do destinatário.
 * @param {string} [envelopeData.message] - Mensagem personalizada para o e-mail.
 * @param {string} [envelopeData.subject] - Assunto do e-mail/envelope.
 * @param {string} [envelopeData.documentPath] - Caminho local do arquivo PDF a ser anexado.
 * @param {string} [envelopeData.envelopeId] - ID pré-existente ou fallback.
 * @param {Object} [envelopeData.credentials] - Credenciais do robô (email/senha).
 * @returns {Promise<string>} Identificador único (ID) do envelope criado/enviado.
 * @throws {Error} Lança erro se a página ou dados obrigatórios forem inválidos.
 */
export async function send(page, envelopeData = {}) {
  if (!page) {
    throw new Error("Page instance is required for send operation");
  }
  const { recipientName, recipientEmail, message, subject, documentPath, envelopeId } = envelopeData;

  if (!recipientName || !recipientEmail) {
    throw new Error("recipientName and recipientEmail are required for send operation");
  }

  const selectors = resolveSelectors();
  const sendSel = selectors.send || {};
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  const targetUrl = sendSel.url || `${baseUrl}/send`;

  try {
    await ensureAuthenticated(page, targetUrl, envelopeData, selectors);

    const email = envelopeData.credentials?.email;

    await uploadDocument(page, sendSel, documentPath, email);
    await fillRecipient(page, sendSel, { recipientName, recipientEmail }, email);
    await fillMessage(page, sendSel, { subject, message }, email);
    await submitEnvelope(page, sendSel, email);

    return await extractEnvelopeId(page, sendSel, envelopeId);
  } catch (err) {
    await robotSession.captureDebugScreenshot(page, "send-failure").catch(() => {});
    throw err;
  }
}

/**
 * Navega para o dashboard ou detalhes do envelope e consulta o seu status atual na plataforma.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador único do envelope DocuSign.
 * @returns {Promise<string>} Status atual do envelope (ex: 'sent', 'delivered', 'signed', 'completed', 'unknown').
 */
export async function status(page, envelopeId) {
  const selectors = resolveSelectors();
  return await checkStatus(page, envelopeId, selectors);
}

/**
 * Navega para a página do envelope concluído, aciona o evento de download e salva o arquivo PDF em disco.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador do envelope a ser baixado.
 * @param {string} downloadDir - Caminho do diretório de destino para salvar o arquivo PDF.
 * @param {string} [fileName] - Nome customizado do arquivo.
 * @returns {Promise<string>} Caminho completo do arquivo PDF salvo localmente.
 */
export async function download(page, envelopeId, downloadDir, fileName) {
  const selectors = resolveSelectors();
  return await downloadDocument(page, envelopeId, downloadDir, fileName, selectors);
}

/**
 * Navega até a página do envelope especificado e aciona o comando de reenvio de notificação.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador único do envelope a ser reenviado.
 * @returns {Promise<{ success: boolean, envelopeId: string }>} Objeto indicando o status do reenvio.
 */
export async function resend(page, envelopeId) {
  const selectors = resolveSelectors();
  return await resendEnvelope(page, envelopeId, selectors);
}

/**
 * Navega para a seção de relatórios/analytics da DocuSign e extrai métricas de desempenho.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [options={}] - Parâmetros opcionais de consulta de relatório.
 * @returns {Promise<{totalSent: number, totalCompleted: number, totalPending: number}>} Objeto contendo métricas coletadas.
 */
export async function reports(page, options = {}) {
  const selectors = resolveSelectors();
  return await extractReports(page, options, selectors);
}

/**
 * Consulta acordos e envelopes na DocuSign com paginação e filtro por representante.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [options={}] - Parâmetros da consulta (repName, daysBack, etc.).
 * @returns {Promise<Object>} Resultado consolidado da consulta com lista de envelopes e alertas.
 */
export async function queryAgreements(page, options = {}) {
  if (!page) {
    throw new Error("Page instance is required for queryAgreements operation");
  }

  return await fetchAgreementsByRepresentative(page, options);
}

/**
 * Executa uma ação do robô com gerenciamento completo do ciclo de vida do navegador Chromium.
 *
 * @param {string} action - Ação a ser executada ('send', 'status', 'download', 'resend', 'reports', 'query_agreements').
 * @param {Object} [options={}] - Parâmetros, dados do contrato e credenciais.
 * @returns {Promise<*>} Resultado da operação executada.
 * @throws {Error} Lança erro caso a ação falhe ou não seja suportada.
 */
export async function executeWithBrowser(action, options = {}) {
  let browser = options.browser || null;
  let context = options.context || null;
  let page = options.page || null;
  let launchedBrowser = false;

  try {
    if (!page) {
      const { chromium } = await import("playwright");
      const launchOptions = {
        headless: options.headless !== false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      };
      if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      }
      browser = await chromium.launch(launchOptions);
      context = await browser.newContext();
      page = await context.newPage();
      launchedBrowser = true;
    }

    if (options.credentials?.email && options.credentials?.password) {
      try {
        await robotSession.getOrRefreshSession(page, context, options.credentials);
      } catch (sessErr) {
        console.warn(`[robotBrowser] Aviso ao carregar sessão: ${sessErr.message}`);
      }
    }

    const envelopeId =
      options.envelopeId ||
      options.contract?.envelopeId ||
      options.contract?.docusign_envelope_id;

    const envelopeData = {
      recipientName:
        options.recipientName ||
        options.contract?.client?.representante?.nome ||
        options.contract?.signer?.name ||
        options.contract?.name ||
        options.contract?.clientName,
      recipientEmail:
        options.recipientEmail ||
        options.contract?.client?.representante?.email ||
        options.contract?.signer?.email ||
        options.contract?.email ||
        options.contract?.clientEmail,
      subject: options.subject,
      message: options.message,
      documentPath: options.documentPath || options.pdfPath,
      envelopeId,
      credentials: options.credentials,
      ...options.envelopeData,
      ...options,
    };

    switch (action) {
      case "send":
        return await send(page, envelopeData);
      case "status":
        return await status(page, envelopeId);
      case "download":
        return await download(page, envelopeId, options.downloadDir || "./downloads", options.fileName);
      case "resend":
        return await resend(page, envelopeId);
      case "reports":
        return await reports(page, options);
      case "query_agreements":
      case "queryAgreements":
        return await queryAgreements(page, options);
      default:
        throw new Error(`Ação '${action}' não é suportada pelo robotBrowser.`);
    }
  } finally {
    if (launchedBrowser && browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn(`[robotBrowser] Erro ao fechar navegador: ${closeErr.message}`);
      }
    }
  }
}

export { withRetry };

/**
 * Exportação padrão das operações Playwright do robô.
 * @type {{send: function, status: function, download: function, resend: function, reports: function, queryAgreements: function, executeWithBrowser: function, withRetry: function}}
 */
export default {
  send,
  status,
  download,
  resend,
  reports,
  queryAgreements,
  executeWithBrowser,
  withRetry,
};

