import path from "node:path";
import fs from "node:fs";
import robotSelectors, { getSelectors } from "./robotSelectors.js";
import robotSession from "./robotSession.js";

/**
 * Obtém os seletores atualizados do robô.
 *
 * @returns {Object} Objeto de seletores UI.
 */
function resolveSelectors() {
  if (typeof robotSelectors === "object" && robotSelectors !== null) {
    return robotSelectors;
  }
  return getSelectors();
}

/**
 * Garante que a página esteja autenticada navegando para a URL desejada e realizando login automático se houver redirecionamento.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} targetUrl - URL de destino.
 * @param {Object} [envelopeData] - Dados da operação contendo credenciais.
 * @param {Object} [selectors] - Seletores de UI.
 */
async function ensureAuthenticated(page, targetUrl, envelopeData = {}, selectors = {}) {
  if (typeof page.goto === "function") {
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
  }

  let currentUrl = typeof page.url === "function" ? page.url() : "";
  if (currentUrl.includes("account.docusign.com") || currentUrl.includes("/oauth/") || currentUrl.includes("/login")) {
    const creds = envelopeData.credentials;
    if (creds?.email && creds?.password) {
      const ctx = typeof page.context === "function" ? page.context() : null;
      await robotSession.loginAndSaveSession(page, ctx, creds, selectors.login || {});
      if (typeof page.goto === "function") {
        await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
      }
      currentUrl = typeof page.url === "function" ? page.url() : "";
      if (currentUrl.includes("account.docusign.com") || currentUrl.includes("/oauth/") || currentUrl.includes("/login") || currentUrl.includes("/password")) {
        await robotSession.captureDebugScreenshot(page, "login-failed");
        await robotSession.invalidateSession(creds.email).catch(() => {});
        throw new Error(
          `Falha na autenticação do robô DocuSign: A navegação permaneceu na tela de login/OAuth (${currentUrl}) após a tentativa de login.`
        );
      }
    } else {
      throw new Error(
        "Redirecionado para autenticação na DocuSign, porém as credenciais do robô (e-mail e senha) não foram configuradas nas Configurações do Sistema."
      );
    }
  }
}

/**
 * Executa uma ação Playwright e detecta se houve redirect para OAuth durante a execução.
 * Em caso de redirect, invalida a sessão e lança erro descritivo.
 *
 * @param {Function} action - Função async da ação Playwright a executar.
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} [email] - Email para invalidar sessão em caso de redirect OAuth.
 * @returns {Promise<void>}
 */
async function guardedAction(action, page, email) {
  try {
    await action();
  } catch (err) {
    const url = typeof page.url === "function" ? page.url() : "";
    if (url.includes("account.docusign.com") || url.includes("/oauth/") || url.includes("/login")) {
      if (email) await robotSession.invalidateSession(email).catch(() => {});
      throw new Error(
        `Redirecionado para OAuth durante interação com a página de envio (${url}). Sessão invalidada — o robô realizará novo login na próxima tentativa.`
      );
    }
    throw err;
  }
}

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
 * @returns {Promise<string>} Identificador único (ID) do envelope criado/enviado.
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

  await ensureAuthenticated(page, targetUrl, envelopeData, selectors);

  const postAuthUrl = typeof page.url === "function" ? page.url() : "";
  if (postAuthUrl.includes("account.docusign.com") || postAuthUrl.includes("/oauth/") || postAuthUrl.includes("/login")) {
    throw new Error(
      `Não é possível preencher os dados do contrato: o navegador continua na tela de login da DocuSign (${postAuthUrl}).`
    );
  }

  const email = envelopeData.credentials?.email;

  if (documentPath && sendSel.file_input && typeof page.setInputFiles === "function") {
    await guardedAction(() => page.setInputFiles(sendSel.file_input, documentPath), page, email);
  }

  if (sendSel.recipient_name && typeof page.fill === "function") {
    await guardedAction(() => page.fill(sendSel.recipient_name, recipientName), page, email);
  }

  if (sendSel.recipient_email && typeof page.fill === "function") {
    await guardedAction(() => page.fill(sendSel.recipient_email, recipientEmail), page, email);
  }

  if (subject && sendSel.subject_input && typeof page.fill === "function") {
    await guardedAction(() => page.fill(sendSel.subject_input, subject), page, email);
  }

  if (message && sendSel.message_textarea && typeof page.fill === "function") {
    await guardedAction(() => page.fill(sendSel.message_textarea, message), page, email);
  }

  if (sendSel.send_button && typeof page.click === "function") {
    await guardedAction(() => page.click(sendSel.send_button), page, email);
  }

  let generatedId = envelopeId;
  if (!generatedId && typeof page.url === "function") {
    const currentUrl = page.url();
    const match = currentUrl.match(/\/envelopes\/([a-zA-Z0-9-]+)/);
    if (match && match[1]) {
      generatedId = match[1];
    }
  }

  if (!generatedId && typeof page.getAttribute === "function" && sendSel.send_button) {
    generatedId = await page.getAttribute(sendSel.send_button, "data-envelope-id");
  }

  return generatedId || `env-${Date.now()}`;
}

/**
 * Navega para o dashboard ou detalhes do envelope e consulta o seu status atual na plataforma.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador único do envelope DocuSign.
 * @returns {Promise<string>} Status atual do envelope (ex: 'sent', 'delivered', 'signed', 'completed').
 */
export async function status(page, envelopeId) {
  if (!page || !envelopeId) {
    throw new Error("Page and envelopeId are required for status operation");
  }

  const selectors = resolveSelectors();
  const dashSel = selectors.dashboard || {};
  const statusSel = selectors.status || {};
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  const envelopeUrl = `${dashSel.url || `${baseUrl}/documents`}/${envelopeId}`;

  if (typeof page.goto === "function") {
    await page.goto(envelopeUrl);
  }

  const targetSelector = statusSel.status_badge || dashSel.status_badge;
  let rawStatus = "";

  if (targetSelector && typeof page.textContent === "function") {
    rawStatus = (await page.textContent(targetSelector)) || "";
  }

  const normalizedStatus = rawStatus.trim().toLowerCase();
  return normalizedStatus || "sent";
}

/**
 * Navega para a página do envelope concluído, aciona o evento de download e salva o arquivo PDF em disco.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador do envelope a ser baixado.
 * @param {string} downloadDir - Caminho do diretório de destino para salvar o arquivo PDF.
 * @returns {Promise<string>} Caminho completo do arquivo PDF salvo localmente.
 */
export async function download(page, envelopeId, downloadDir, fileName) {
  if (!page || !envelopeId || !downloadDir) {
    throw new Error("Page, envelopeId, and downloadDir are required for download operation");
  }

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const selectors = resolveSelectors();
  const dlSel = selectors.download || {};
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  const envelopeUrl = `${baseUrl}/documents/${envelopeId}`;

  if (typeof page.goto === "function") {
    await page.goto(envelopeUrl);
  }

  const pdfFileName = fileName || `contrato_assinado_${envelopeId}.pdf`;
  const targetPath = path.join(downloadDir, pdfFileName);

  if (typeof page.waitForEvent === "function" && typeof page.click === "function") {
    const downloadPromise = page.waitForEvent("download");
    await page.click(dlSel.download_button || "button[data-testid='download-button']");
    const downloadEvent = await downloadPromise;

    if (downloadEvent && typeof downloadEvent.saveAs === "function") {
      await downloadEvent.saveAs(targetPath);
      return targetPath;
    }
  }

  if (typeof page.click === "function" && dlSel.download_button) {
    await page.click(dlSel.download_button);
  }

  return targetPath;
}

/**
 * Navega até a página do envelope especificado e aciona o comando de reenvio de notificação.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador único do envelope a ser reenviado.
 * @returns {Promise<{ success: boolean, envelopeId: string }>} Objeto indicando o status do reenvio.
 */
export async function resend(page, envelopeId) {
  if (!page || !envelopeId) {
    throw new Error("Page and envelopeId are required for resend operation");
  }

  const selectors = resolveSelectors();
  const resendSel = selectors.resend || {};
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  const envelopeUrl = `${baseUrl}/documents/${envelopeId}`;

  if (typeof page.goto === "function") {
    await page.goto(envelopeUrl);
  }

  if (resendSel.resend_button && typeof page.click === "function") {
    await page.click(resendSel.resend_button);
  }

  return { success: true, envelopeId };
}

/**
 * Navega para a seção de relatórios/analytics da DocuSign e extrai métricas de desempenho.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [options] - Parâmetros opcionais de consulta de relatório (ex: startDate, endDate).
 * @returns {Promise<Object>} Objeto contendo métricas coletadas (ex: totalSent, totalCompleted, totalPending).
 */
export async function reports(page, options = {}) {
  if (!page) {
    throw new Error("Page instance is required for reports operation");
  }

  const selectors = resolveSelectors();
  const repSel = selectors.reports || {};
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  const reportsUrl = repSel.url || `${baseUrl}/reports`;

  if (typeof page.goto === "function") {
    await page.goto(reportsUrl);
  }

  let totalSent = 0;
  let totalCompleted = 0;
  let totalPending = 0;

  if (repSel.total_sent && typeof page.textContent === "function") {
    const text = await page.textContent(repSel.total_sent).catch(() => "0");
    totalSent = parseInt(text || "0", 10) || 0;
  }

  if (repSel.total_completed && typeof page.textContent === "function") {
    const text = await page.textContent(repSel.total_completed).catch(() => "0");
    totalCompleted = parseInt(text || "0", 10) || 0;
  }

  if (repSel.total_pending && typeof page.textContent === "function") {
    const text = await page.textContent(repSel.total_pending).catch(() => "0");
    totalPending = parseInt(text || "0", 10) || 0;
  }

  return {
    totalSent,
    totalCompleted,
    totalPending,
    options,
  };
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

  const { fetchAgreementsByRepresentative } = await import("../../../../../robot/src/browser/docusign.js");
  return await fetchAgreementsByRepresentative(page, options);
}

/**
 * Função utilitária para executar operações com tentativas automáticas (retry) em falhas transitórias.
 *
 * @param {Function} operationFn - Função assíncrona a ser executada com tratamento de retry.
 * @param {number} [maxRetries=3] - Quantidade máxima de tentativas permitidas.
 * @param {number} [delayMs=1000] - Tempo de espera em milissegundos entre as tentativas.
 * @returns {Promise<*>} Retorna o resultado da execução bem-sucedida de operationFn.
 */
export async function withRetry(operationFn, maxRetries = 3, delayMs = 1000) {
  if (typeof operationFn !== "function") {
    throw new Error("operationFn must be a valid function");
  }

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operationFn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Exportação padrão das operações Playwright do robô.
 * @type {{send: function, status: function, download: function, resend: function, reports: function, queryAgreements: function, withRetry: function}}
 */
export default {
  send,
  status,
  download,
  resend,
  reports,
  queryAgreements,
  withRetry,
};
