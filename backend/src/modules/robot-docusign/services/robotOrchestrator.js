import path from "node:path";
import { EventEmitter } from "node:events";
import RobotJob from "../models/RobotJob.js";
import SystemConfig from "../../../models/SystemConfig.js";
import robotBrowser from "./robotBrowser.js";
import robotSession from "./robotSession.js";
import docusignService from "../../../services/docusignService.js";
import Contract from "../../../models/Contract.js";
import { decryptText } from "../../../utils/crypto.js";
import gestorApiClient from "../../../services/gestorApiClient.js";

/**
 * Atualiza o status do contrato de forma desacoplada via GestorApiClient com fallback para Mongoose.
 * @param {string} contractId
 * @param {string} status
 * @param {Object} [extraPayload={}]
 */
async function syncContractStatus(contractId, status, extraPayload = {}) {
  if (!contractId) return;

  // 1. Tenta atualizar via GestorApiClient (HTTP desacoplado)
  if (process.env.ROBOT_API_KEY) {
    try {
      await gestorApiClient.updateContractStatus(contractId, {
        status,
        ...extraPayload,
      });
      return;
    } catch (apiErr) {
      console.warn(`[robotOrchestrator] Falha ao atualizar contrato ${contractId} via GestorApiClient: ${apiErr.message}. Tentando fallback direto Mongoose.`);
    }
  }

  // 2. Fallback direto via Mongoose caso o cliente HTTP não esteja configurado ou falhe
  try {
    const c = await Contract.findById(contractId);
    if (c) {
      c.status = status;
      if (extraPayload.envelopeId) c.envelopeId = extraPayload.envelopeId;
      await c.save();
    }
  } catch (cErr) {
    console.error(`[robotOrchestrator] Erro ao atualizar status do contrato para ${status} via Mongoose:`, cErr.message);
  }
}

/**
 * Instância global do EventEmitter para o Robô DocuSign emitir progresso dos jobs.
 */
export const robotEvents = new EventEmitter();

/**
 * Emite evento de progresso do job.
 * @param {Object} job - Instância do RobotJob.
 */
function emitProgress(job) {
  if (!job) return;
  robotEvents.emit("job:progress", {
    jobId: job._id ? job._id.toString() : String(job.id || job.contract_id),
    status: job.status,
    steps: job.steps,
    result: job.result,
    error: job.error,
  });
}


/**
 * Configuração padrão fallback para o Robô DocuSign.
 */
export const DEFAULT_ROBOT_DOCUSIGN_CONFIG = {
  enabled: false,
  mode: "api",
  limits: {
    max_concurrent: 1,
  },
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
  },
  credentials: {
    email: "",
    password: "",
  },
  token_notification_email: {
    email: "",
    password: "",
    host: "unitynordeste.com.br",
    port: 993,
    tls: true,
  },
};

/**
 * Busca e retorna as configurações salvas do Robô DocuSign no banco de dados,
 * mesclando-as com a estrutura de dados padrão.
 *
 * @returns {Promise<Object>} Objeto com a configuração mesclada do robô.
 */
export async function getRobotConfig() {
  const doc = await SystemConfig.findOne({ key: "robot_docusign" }).lean();
  const savedValue = doc?.value || {};

  const config = {
    ...DEFAULT_ROBOT_DOCUSIGN_CONFIG,
    ...savedValue,
    limits: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.limits,
      ...(savedValue.limits || {}),
    },
    retry: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.retry,
      ...(savedValue.retry || {}),
    },
    credentials: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.credentials,
      ...(savedValue.credentials || {}),
    },
    token_notification_email: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.token_notification_email,
      ...(savedValue.token_notification_email || {}),
    },
  };

  if (config.credentials?.password) {
    config.credentials.password = decryptText(config.credentials.password);
  }

  if (config.token_notification_email?.password) {
    config.token_notification_email.password = decryptText(config.token_notification_email.password);
  }

  return config;
}

/**
 * Avalia se o Robô Playwright deve ser utilizado para a operação ou se deve recorrer à API oficial.
 *
 * @param {Object|string} contract - Objeto do contrato ou ID de referência.
 * @param {Object} [options={}] - Opções para forçar o modo de execução ou desconsiderar limites.
 * @returns {Promise<boolean>} Retorna true para modo Robô e false para modo API.
 */
export async function shouldUseRobot(contract, options = {}) {
  if (options?.forceMode === "api" || options?.mode === "api") {
    return false;
  }
  if (options?.forceMode === "robot" || options?.mode === "robot" || options?.forceRobot) {
    return true;
  }

  const config = await getRobotConfig();
  if (!config.enabled || config.mode === "api") {
    return false;
  }

  const pendingJobs = await RobotJob.countDocuments({
    status: { $in: ["processing", "running"] },
  });
  const maxConcurrent = config.limits?.max_concurrent || 1;
  if (pendingJobs >= maxConcurrent) {
    return false;
  }

  return true;
}

/**
 * Calcula o tempo de atraso (delay) em milissegundos para a tentativa usando algoritmo exponencial.
 *
 * @param {number} attempt - Número da tentativa (1-indexed).
 * @param {number} [baseDelayMs=1000] - Delay base em milissegundos.
 * @returns {number} Tempo de delay calculated.
 */
export function calculateRetryDelay(attempt, baseDelayMs = 1000) {
  const base = typeof baseDelayMs === "number" && baseDelayMs > 0 ? baseDelayMs : 1000;
  const exp = Math.max(0, attempt - 1);
  return base * Math.pow(2, exp);
}

/**
 * Calcula a data/hora para o agendamento da próxima tentativa (next_retry_at).
 *
 * @param {number} attempt - Número da tentativa (1-indexed).
 * @param {number} [baseDelayMs=1000] - Delay base em milissegundos.
 * @returns {Date} Instância de Date com a hora futura.
 */
export function calculateNextRetryAt(attempt, baseDelayMs = 1000) {
  const delayMs = calculateRetryDelay(attempt, baseDelayMs);
  return new Date(Date.now() + delayMs);
}

/**
 * Executa uma ação utilizando o serviço de API do DocuSign.
 *
 * @param {string} action - Ação solicitada ('send', 'status', 'download', 'resend').
 * @param {Object} [contract] - Dados do contrato.
 * @param {Object} [options={}] - Parâmetros adicionais.
 * @returns {Promise<*>} Retorno do serviço oficial de API.
 */
async function executeApiAction(action, contract, options = {}) {
  const envelopeId = options.envelopeId || contract?.envelopeId || contract?.docusign_envelope_id;
  const signer = options.signer || {
    name: options.recipientName || contract?.client?.representante?.nome || contract?.signer?.name || contract?.name || contract?.clientName,
    email: options.recipientEmail || contract?.client?.representante?.email || contract?.signer?.email || contract?.email || contract?.clientEmail,
    cpf: options.cpf || contract?.client?.representante?.cpf || contract?.signer?.cpf || contract?.cpf,
  };
  const pdfFiles = options.pdfFiles || options.files || [];
  const callbackUrl = options.callbackUrl;

  switch (action) {
    case "send":
      if (typeof docusignService.sendEnvelope === "function") {
        return await docusignService.sendEnvelope(signer, pdfFiles, callbackUrl);
      }
      break;
    case "status":
      if (typeof docusignService.getEnvelopeStatus === "function") {
        return await docusignService.getEnvelopeStatus(envelopeId);
      }
      break;
    case "download":
      if (typeof docusignService.getSignedDocuments === "function") {
        return await docusignService.getSignedDocuments(envelopeId);
      }
      break;
    case "resend":
      if (typeof docusignService.resendEnvelope === "function") {
        return await docusignService.resendEnvelope(envelopeId);
      }
      break;
  }

  if (typeof docusignService[action] === "function") {
    return await docusignService[action](envelopeId || signer, options);
  }

  throw new Error(`Ação '${action}' não é suportada pelo docusignService.`);
}

/**
 * Executa uma ação de automação do Robô DocuSign via Playwright.
 *
 * @param {string} action - Ação a ser executada ('send', 'status', 'download', 'resend', 'reports').
 * @param {Object} page - Página ativa do Playwright.
 * @param {Object} [contract] - Dados do contrato.
 * @param {Object} [options={}] - Configurações extras de automação.
 * @returns {Promise<*>} Resultado da operação do navegador.
 */
async function executeRobotAction(action, page, contract, options = {}) {
  const envelopeId = options.envelopeId || contract?.envelopeId || contract?.docusign_envelope_id;
  const envelopeData = {
    recipientName: options.recipientName || contract?.client?.representante?.nome || contract?.signer?.name || contract?.name || contract?.clientName,
    recipientEmail: options.recipientEmail || contract?.client?.representante?.email || contract?.signer?.email || contract?.email || contract?.clientEmail,
    subject: options.subject,
    message: options.message,
    documentPath: options.documentPath || options.pdfPath,
    envelopeId,
    ...options.envelopeData,
    ...options,
  };

  switch (action) {
    case "send":
      return await robotBrowser.send(page, envelopeData);
    case "status":
      return await robotBrowser.status(page, envelopeId);
    case "download":
      return await robotBrowser.download(page, envelopeId, options.downloadDir || "./downloads", options.fileName);
    case "resend":
      return await robotBrowser.resend(page, envelopeId);
    case "reports":
      return await robotBrowser.reports(page, options);
    default:
      if (typeof robotBrowser[action] === "function") {
        return await robotBrowser[action](page, envelopeData);
      }
      throw new Error(`Ação '${action}' não é suportada pelo robotBrowser.`);
  }
}

/**
 * Executa um Job criando o histórico no MongoDB, controlando retries exponenciais e fallback de navegador/API.
 *
 * @param {Object|string} contractOrId - Objeto do contrato ou identificador ObjectId.
 * @param {string} [action="send"] - Ação desejada ('send', 'status', 'download', 'resend', 'reports').
 * @param {Object} [options={}] - Parâmetros e opções contextuais.
 * @returns {Promise<{ success: boolean, mode: string, result?: *, error?: string, jobId: string }>} Resultado estruturado da execução.
 */
export async function executeJob(contractOrId, action = "send", options = {}) {
  let contractId = null;
  let contractObj = null;

  if (typeof contractOrId === "object" && contractOrId !== null) {
    contractObj = contractOrId;
    contractId = contractOrId._id || contractOrId.id || contractOrId.contract_id || contractOrId.contractId;
  } else {
    contractId = contractOrId;
  }

  if (contractId && !contractObj) {
    try {
      contractObj = await Contract.findById(contractId).lean();
    } catch (err) {
      // Ignora erro de busca
    }
  }

  if (action === "download") {
    const cnpj = (contractObj?.client?.cnpj || "").replace(/\D/g, "");
    const razao = (contractObj?.client?.razaoSocial || "empresa").replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );
    const envelopeId = options.envelopeId || contractObj?.envelopeId || contractObj?.docusign_envelope_id || "doc";
    const downloadDir = path.join("uploads", `${cnpj}_${razao}`).replace(/\\/g, "/");
    const fileName = `contrato_assinado_${envelopeId}.pdf`;
    options = {
      downloadDir,
      fileName,
      ...options,
    };
  }

  const useRobot = await shouldUseRobot(contractObj || contractId, options);
  const modeUsed = useRobot ? "robot" : "api";

  const config = await getRobotConfig();
  const maxAttempts = options.maxAttempts || config.retry?.maxAttempts || 3;
  const baseDelayMs = options.baseDelayMs || config.retry?.baseDelayMs || 1000;

  const job = new RobotJob({
    contract_id: contractId,
    contractId: contractId,
    action,
    status: "processing",
    mode: modeUsed,
    robot_mode: useRobot,
    attempts: 1,
    retryCount: 1,
    max_attempts: maxAttempts,
    startedAt: new Date(),
    steps: [
      {
        name: "init",
        status: "success",
        timestamp: new Date(),
        duration: 0,
      },
    ],
    created_by: options.userId || options.created_by || null,
  });

  await job.save();
  emitProgress(job);

  if (modeUsed === "api") {
    try {
      const stepStart = Date.now();
      const result = await executeApiAction(action, contractObj, options);

      job.status = "completed";
      job.completedAt = new Date();
      job.result = result;

      if (result && typeof result === "object") {
        if (result.envelopeId) job.envelopeId = result.envelopeId;
        if (result.signedDocPath) job.signedDocPath = result.signedDocPath;
      } else if (typeof result === "string" && action === "send") {
        job.envelopeId = result;
      }

      if (action === "send" && contractId) {
        await syncContractStatus(contractId, "enviado", { envelopeId: job.envelopeId });
      } else if (action === "download" && contractId) {
        await syncContractStatus(contractId, "assinado");
        const cnpj = (contractObj?.client?.cnpj || "").replace(/\D/g, "");
        const razao = (contractObj?.client?.razaoSocial || "empresa").replace(/[^a-zA-Z0-9]/g, "_");
        const envId = job.envelopeId || options.envelopeId || contractObj?.envelopeId || contractObj?.docusign_envelope_id || "doc";
        job.signedDocPath = `uploads/${cnpj}_${razao}/contrato_assinado_${envId}.pdf`;
      }

      job.steps.push({
        name: `api_${action}`,
        status: "success",
        timestamp: new Date(),
        duration: Date.now() - stepStart,
      });

      await job.save();
      emitProgress(job);

      return {
        success: true,
        mode: "api",
        result,
        jobId: job._id,
      };
    } catch (apiErr) {
      const errorMsg = apiErr?.message || String(apiErr);
      job.status = "failed";
      job.completedAt = new Date();
      job.error = errorMsg;
      job.lastError = errorMsg;
      job.steps.push({
        name: `api_${action}`,
        status: "failed",
        timestamp: new Date(),
        duration: 0,
        error: errorMsg,
      });
      await job.save();
      emitProgress(job);

      return {
        success: false,
        mode: "api",
        error: errorMsg,
        jobId: job._id,
      };
    }
  }

  // Modo Robô (Playwright)
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

    if (config.credentials?.email && config.credentials?.password) {
      try {
        await robotSession.getOrRefreshSession(page, context, config.credentials);
      } catch (sessErr) {
        console.warn(`[robotOrchestrator] Aviso ao carregar sessão: ${sessErr.message}`);
      }
    }

    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const stepStart = Date.now();
      job.attempts = attempt;
      job.retryCount = attempt;

      try {
        const actionOptions = { credentials: config.credentials, ...options };
        const result = await executeRobotAction(action, page, contractObj, actionOptions);

        job.status = "completed";
        job.completedAt = new Date();
        job.result = result;

        if (result && typeof result === "object") {
          if (result.envelopeId) job.envelopeId = result.envelopeId;
          if (result.signedDocPath) job.signedDocPath = result.signedDocPath;
        } else if (typeof result === "string") {
          if (action === "send") job.envelopeId = result;
          if (action === "download") job.signedDocPath = result;
        }

        if (action === "send" && contractId) {
          await syncContractStatus(contractId, "enviado", { envelopeId: job.envelopeId });
        } else if (action === "download" && contractId) {
          await syncContractStatus(contractId, "assinado");
          const cnpj = (contractObj?.client?.cnpj || "").replace(/\D/g, "");
          const razao = (contractObj?.client?.razaoSocial || "empresa").replace(/[^a-zA-Z0-9]/g, "_");
          const envId = job.envelopeId || options.envelopeId || contractObj?.envelopeId || contractObj?.docusign_envelope_id || "doc";
          job.signedDocPath = `uploads/${cnpj}_${razao}/contrato_assinado_${envId}.pdf`;
        }

        job.steps.push({
          name: `robot_${action}_attempt_${attempt}`,
          status: "success",
          timestamp: new Date(),
          duration: Date.now() - stepStart,
        });

        await job.save();
        emitProgress(job);


        return {
          success: true,
          mode: "robot",
          result,
          jobId: job._id,
        };
      } catch (attemptErr) {
        lastError = attemptErr;
        const errorMsg = attemptErr?.message || String(attemptErr);
        const isLastAttempt = attempt >= maxAttempts;

        if (!isLastAttempt) {
          const delayMs = calculateRetryDelay(attempt, baseDelayMs);
          const nextRetryAt = calculateNextRetryAt(attempt, baseDelayMs);

          job.status = "retrying";
          job.next_retry_at = nextRetryAt;
          job.error = errorMsg;
          job.lastError = errorMsg;
          job.steps.push({
            name: `robot_${action}_attempt_${attempt}`,
            status: "failed",
            timestamp: new Date(),
            duration: Date.now() - stepStart,
            error: errorMsg,
          });

          await job.save();
          emitProgress(job);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          job.status = "failed";
          job.completedAt = new Date();
          job.error = errorMsg;
          job.lastError = errorMsg;
          job.steps.push({
            name: `robot_${action}_attempt_${attempt}`,
            status: "failed",
            timestamp: new Date(),
            duration: Date.now() - stepStart,
            error: errorMsg,
          });

          await job.save();
          emitProgress(job);

          return {
            success: false,
            mode: "robot",
            error: errorMsg,
            jobId: job._id,
          };
        }
      }
    }
  } catch (globalRobotErr) {
    const errorMsg = globalRobotErr?.message || String(globalRobotErr);
    job.status = "failed";
    job.completedAt = new Date();
    job.error = errorMsg;
    job.lastError = errorMsg;
    job.steps.push({
      name: `robot_${action}_global_error`,
      status: "failed",
      timestamp: new Date(),
      duration: 0,
      error: errorMsg,
    });
    await job.save();
    emitProgress(job);

    return {
      success: false,
      mode: "robot",
      error: errorMsg,
      jobId: job._id,
    };
  } finally {
    if (launchedBrowser && browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn(`[robotOrchestrator] Erro ao fechar o navegador: ${closeErr.message}`);
      }
    }
  }
}

/**
 * Gatilho de convenção para o disparo de execuções via orquestrador (Alias de executeJob).
 *
 * @param {Object|string} contractOrId - Objeto do contrato ou ID ObjectId.
 * @param {string} [action="send"] - Ação solicitada ('send', 'status', 'download', 'resend', 'reports').
 * @param {Object} [options={}] - Opções e contexto de execução.
 * @returns {Promise<{ success: boolean, mode: string, result?: *, error?: string, jobId: string }>} Objeto do resultado da execução.
 */
export async function trigger(contractOrId, action = "send", options = {}) {
  return await executeJob(contractOrId, action, options);
}

/**
 * Exportação padrão do orquestrador do robô.
 * @type {{DEFAULT_ROBOT_DOCUSIGN_CONFIG: object, getRobotConfig: function, shouldUseRobot: function, calculateRetryDelay: function, calculateNextRetryAt: function, executeJob: function, trigger: function, robotEvents: import("events").EventEmitter}}
 */
export default {
  DEFAULT_ROBOT_DOCUSIGN_CONFIG,
  getRobotConfig,
  shouldUseRobot,
  calculateRetryDelay,
  calculateNextRetryAt,
  executeJob,
  trigger,
  robotEvents,
};
