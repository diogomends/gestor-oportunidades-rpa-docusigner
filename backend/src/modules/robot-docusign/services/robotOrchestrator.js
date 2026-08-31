/**
 * @file Orquestrador enxuto e desacoplado para execução de jobs no DocuSign via Robô (Playwright) ou API oficial.
 * Aplica os princípios SOLID e PonyTail, delegando browser para robotBrowser e sincronização para contractSyncService.
 */

import { EventEmitter } from "node:events";
import RobotJob from "../models/RobotJob.js";
import SystemConfig from "../../../models/SystemConfig.js";
import Contract from "../../../models/Contract.js";
import robotBrowser, { withRetry } from "./robotBrowser.js";
import docusignService from "../../../services/docusignService.js";
import { decryptText } from "../../../utils/crypto.js";
import { syncContractStatus, buildDownloadPath } from "./contractSyncService.js";

/**
 * Instância global do EventEmitter para emissão de progresso dos jobs.
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
  mode: "robot",
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
  mfa: {
    maxWaitMs: 90000,
    maxAgeMs: 10 * 60 * 1000,
  },
};

/**
 * Busca e retorna as configurações salvas do Robô DocuSign no banco de dados.
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
    mfa: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.mfa,
      ...(savedValue.mfa || {}),
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
 * Avalia se o modo Robô deve ser utilizado para a operação.
 *
 * @param {Object|string} contract - Objeto do contrato ou ID de referência.
 * @param {Object} [options={}] - Opções fornecidas pelo chamador.
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
  if (config.enabled === false || config.mode === "api") {
    return false;
  }

  return true;
}

/**
 * Calcula o tempo de atraso (delay) em milissegundos para a tentativa usando algoritmo exponencial.
 *
 * @param {number} attempt - Número da tentativa (1-indexed).
 * @param {number} [baseDelayMs=1000] - Delay base em milissegundos.
 * @returns {number} Tempo de delay calculado.
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
 * Executa uma ação utilizando o serviço de API oficial do DocuSign.
 *
 * @param {string} action - Ação solicitada ('send', 'status', 'download', 'resend').
 * @param {Object} [contract] - Dados do contrato.
 * @param {Object} [options={}] - Parâmetros adicionais.
 * @returns {Promise<*>} Retorno do serviço de API.
 */
async function executeApiAction(action, contract, options = {}) {
  const envelopeId = options.envelopeId || contract?.envelopeId || contract?.docusign_envelope_id;
  const signer = options.signer || {
    name:
      options.recipientName ||
      contract?.client?.representante?.nome ||
      contract?.signer?.name ||
      contract?.name ||
      contract?.clientName,
    email:
      options.recipientEmail ||
      contract?.client?.representante?.email ||
      contract?.signer?.email ||
      contract?.email ||
      contract?.clientEmail,
    cpf:
      options.cpf ||
      contract?.client?.representante?.cpf ||
      contract?.signer?.cpf ||
      contract?.cpf,
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

  throw new Error("Ação '" + action + "' não é suportada pelo docusignService.");
}

/**
 * Executa um Job criando o histórico no MongoDB e despachando para robotBrowser ou docusignService.
 *
 * @param {Object|string} contractOrId - Objeto do contrato ou identificador ObjectId.
 * @param {string} [action="send"] - Ação desejada ('send', 'status', 'download', 'resend', 'reports', 'query_agreements').
 * @param {Object} [options={}] - Parâmetros e opções contextuais.
 * @returns {Promise<{ success: boolean, mode: string, result?: *, error?: string, jobId: string }>} Resultado estruturado.
 */
export async function executeJob(contractOrId, action = "send", options = {}) {
  let contractId = null;
  let contractObj = null;

  if (typeof contractOrId === "object" && contractOrId !== null) {
    contractObj = contractOrId;
    contractId =
      contractOrId._id ||
      contractOrId.id ||
      contractOrId.contract_id ||
      contractOrId.contractId;
  } else {
    contractId = contractOrId;
  }

  if (contractId && !contractObj) {
    try {
      contractObj = await Contract.findById(contractId).lean();
    } catch {
      // Ignora erro de busca inicial
    }
  }

  if (action === "download" && !options.downloadDir) {
    const paths = buildDownloadPath(contractObj, options.envelopeId);
    options = { downloadDir: paths.downloadDir, fileName: paths.fileName, ...options };
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

  const stepStart = Date.now();

  try {
    let result;

    if (modeUsed === "api") {
      result = await executeApiAction(action, contractObj, options);
    } else {
      const execFn = async (attempt) => {
        job.attempts = attempt;
        job.retryCount = attempt;
        const attemptStart = Date.now();
        try {
          return await robotBrowser.executeWithBrowser(action, {
            credentials: config.credentials,
            contract: contractObj,
            ...options,
          });
        } catch (err) {
          err._attemptStart = attemptStart;
          throw err;
        }
      };

      result = await withRetry(execFn, {
        maxRetries: maxAttempts,
        delayMs: baseDelayMs,
        onRetry: async (err, attempt) => {
          const nextRetryAt = calculateNextRetryAt(attempt, baseDelayMs);
          job.status = "retrying";
          job.next_retry_at = nextRetryAt;
          const msg = err?.message || String(err);
          job.error = msg;
          job.lastError = msg;
          job.steps.push({
            name: "robot_" + action + "_attempt_" + attempt,
            status: "failed",
            timestamp: new Date(),
            duration: err?._attemptStart ? Date.now() - err._attemptStart : 0,
            error: msg,
          });
          await job.save().catch(() => {});
          emitProgress(job);
        },
      });
    }

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
      const paths = buildDownloadPath(contractObj, job.envelopeId || options.envelopeId);
      job.signedDocPath = paths.relativePath;
    }

    job.steps.push({
      name: modeUsed + "_" + action,
      status: "success",
      timestamp: new Date(),
      duration: Date.now() - stepStart,
    });

    await job.save();
    emitProgress(job);

    return {
      success: true,
      mode: modeUsed,
      result,
      jobId: job._id,
    };
  } catch (err) {
    const errorMsg = err?.message || String(err);
    job.status = "failed";
    job.completedAt = new Date();
    job.error = errorMsg;
    job.lastError = errorMsg;
    job.steps.push({
      name: modeUsed + "_" + action,
      status: "failed",
      timestamp: new Date(),
      duration: Date.now() - stepStart,
      error: errorMsg,
    });

    await job.save();
    emitProgress(job);

    return {
      success: false,
      mode: modeUsed,
      error: errorMsg,
      jobId: job._id,
    };
  }
}

/**
 * Gatilho de convenção para o disparo de execuções via orquestrador (Alias de executeJob).
 *
 * @param {Object|string} contractOrId - Objeto do contrato ou ID ObjectId.
 * @param {string} [action="send"] - Ação solicitada ('send', 'status', 'download', 'resend', 'reports', 'query_agreements').
 * @param {Object} [options={}] - Opções e contexto de execução.
 * @returns {Promise<{ success: boolean, mode: string, result?: *, error?: string, jobId: string }>} Objeto do resultado.
 */
export async function trigger(contractOrId, action = "send", options = {}) {
  return await executeJob(contractOrId, action, options);
}

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
