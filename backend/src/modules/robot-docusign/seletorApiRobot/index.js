/**
 * @file Orquestrador e seletor principal de execução de jobs do DocuSign (seletorApiRobot).
 * Aplica os princípios SOLID e PonyTail: despacha para browserrobot ou apiActionService de forma modular.
 */

import RobotJob from "../models/RobotJob.js";
import Contract from "../../../models/Contract.js";
import browserrobot from "../browserrobot/index.js";
import { executeApiAction } from "./apiActionService.js";
import {
  DEFAULT_ROBOT_DOCUSIGN_CONFIG,
  getRobotConfig,
  shouldUseRobot,
  calculateRetryDelay,
  calculateNextRetryAt,
} from "./orchestratorConfig.js";
import { robotEvents, emitProgress } from "./orchestratorEvents.js";
import { syncContractStatus, buildDownloadPath } from "./contractSyncService.js";
import statusSyncScheduler, { syncAllContractsStatus, isStatusSyncRunning } from "./statusSyncScheduler.js";

export {
  DEFAULT_ROBOT_DOCUSIGN_CONFIG,
  getRobotConfig,
  shouldUseRobot,
  calculateRetryDelay,
  calculateNextRetryAt,
  robotEvents,
  emitProgress,
  executeApiAction,
  syncContractStatus,
  buildDownloadPath,
  statusSyncScheduler,
  syncAllContractsStatus,
  isStatusSyncRunning,
};

/**
 * Executa um Job criando o histórico no MongoDB e despachando para browserrobot ou apiActionService.
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

  const useRobot = await shouldUseRobot(contractObj || contractId, { action, ...options });
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
          return await browserrobot.executeWithBrowser(action, {
            credentials: config.credentials,
            contract: contractObj,
            ...options,
          });
        } catch (err) {
          err._attemptStart = attemptStart;
          throw err;
        }
      };

      result = await browserrobot.withRetry(execFn, {
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
  emitProgress,
  executeApiAction,
  syncContractStatus,
  buildDownloadPath,
  statusSyncScheduler,
  syncAllContractsStatus,
  isStatusSyncRunning,
};
