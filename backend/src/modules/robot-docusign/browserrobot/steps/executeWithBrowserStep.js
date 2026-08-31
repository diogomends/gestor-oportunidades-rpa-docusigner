/**
 * @file Gerencia o ciclo de vida do navegador Playwright e despacha para o step da ação solicitada.
 * Segue o padrão de pipeline: nenhuma lógica de negócio vive aqui — apenas chamadas de função em ordem.
 */

// Atomic Imports
import robotSession from "../robotSession.js";
import { sendEnvelope } from "./sendStep.js";
import { checkStatus } from "./statusStep.js";
import { downloadDocument } from "./downloadStep.js";
import { resendEnvelope } from "./resendStep.js";
import { extractReports } from "./reportsStep.js";
import { fetchAgreementsByRepresentative } from "../agreementsService.js";

/**
 * Gerencia o ciclo de vida do Playwright e despacha para o step da ação solicitada.
 * Nenhuma lógica de negócio vive aqui — apenas chamadas de função em ordem.
 *
 * @param {string} action - Ação a executar ('send', 'status', 'download', 'resend', 'reports', 'query_agreements').
 * @param {Object} [options={}] - Dados, credenciais e contrato.
 * @param {Object} [options.browser] - Instância de browser existente (opcional).
 * @param {Object} [options.context] - Contexto de browser existente (opcional).
 * @param {Object} [options.page] - Instância de page existente (opcional).
 * @param {boolean} [options.headless] - Modo headless do Chromium.
 * @param {Object} [options.credentials] - Credenciais do robô (email/password).
 * @param {Object} [options.contract] - Objeto do contrato com dados do destinatário.
 * @param {string} [options.envelopeId] - ID do envelope.
 * @param {string} [options.downloadDir] - Diretório de download.
 * @param {string} [options.fileName] - Nome do arquivo de download.
 * @returns {Promise<*>} Resultado da ação executada.
 * @throws {Error} Lança erro caso a ação falhe ou não seja suportada.
 * @async
 */
const executeWithBrowser = async (action, options = {}) => {
  let browser = options.browser || null;
  let context = options.context || null;
  let page = options.page || null;
  let launchedBrowser = false;

  try {
    // Passo 1: Inicializar navegador se necessário
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

    // Passo 2: Carregar sessão existente
    if (options.credentials?.email && options.credentials?.password) {
      await robotSession.getOrRefreshSession(page, context, options.credentials).catch((e) =>
        console.warn(`[browserrobot] Aviso ao carregar sessão: ${e.message}`)
      );
    }

    // Passo 3: Resolver identificadores do contrato
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

    // Passo 4: Despachar para o step da ação solicitada
    switch (action) {
      case "send":             return await sendEnvelope(page, envelopeData);
      case "status":           return await checkStatus(page, envelopeId);
      case "download":         return await downloadDocument(page, envelopeId, options.downloadDir || "./downloads", options.fileName);
      case "resend":           return await resendEnvelope(page, envelopeId);
      case "reports":          return await extractReports(page, options);
      case "query_agreements":
      case "queryAgreements":  return await fetchAgreementsByRepresentative(page, options);
      default:                 throw new Error(`Ação '${action}' não é suportada pelo browserrobot.`);
    }
  } finally {
    // Passo 5: Fechar navegador se foi iniciado aqui
    if (launchedBrowser && browser) {
      await browser.close().catch((e) =>
        console.warn(`[browserrobot] Erro ao fechar navegador: ${e.message}`)
      );
    }
  }
};

export { executeWithBrowser };
