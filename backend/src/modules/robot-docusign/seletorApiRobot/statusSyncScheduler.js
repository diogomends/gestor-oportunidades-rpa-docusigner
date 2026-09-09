/**
 * @file Scheduler dedicado à sincronização periódica e consulta geral de status de contratos no DocuSign.
 * Varre contratos ativos (não-rascunho), consulta o painel da DocuSign, atualiza o banco e baixa PDFs assinados.
 * Aplica os princípios SOLID (SRP), PonyTail (simplicidade) e Anti-Phantom Success Hardening.
 */

import fs from "node:fs";
import path from "node:path";
import Contract from "../../../models/Contract.js";
import SystemConfig from "../../../models/SystemConfig.js";
import RobotJob from "../models/RobotJob.js";
import RobotInstance from "../models/RobotInstance.js";
import browserrobot from "../browserrobot/index.js";
import { getRobotConfig } from "./orchestratorConfig.js";
import { robotEvents } from "./orchestratorEvents.js";
import { syncContractStatus, buildDownloadPath } from "./contractSyncService.js";
import { isTimeAccessAllowed } from "../../../utils/timeRestrictionService.js";

/**
 * Normaliza strings para facilitar comparação insensível a maiúsculas e acentuação.
 *
 * @param {string} [str=""] - Texto original.
 * @returns {string} Texto normalizado.
 */
function normalizeString(str = "") {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Mapeia o status do envelope extraído da DocuSign para o status canônico do modelo Contract.
 * Retorna null se o status não for reconhecido, for vazio ou rascunho, prevenindo alterações arbitrárias de estado (Anti-Phantom Success).
 *
 * @param {string} [envelopeStatus=""] - Status do envelope na DocuSign.
 * @returns {string|null} Status correspondente no modelo Contract ('enviado', 'assinado', 'cancelado') ou null se não reconhecido.
 */
export function mapEnvelopeStatusToContractStatus(envelopeStatus = "") {
  const normalized = normalizeString(envelopeStatus);
  switch (normalized) {
    case "completed":
    case "assinado":
    case "signed":
    case "concluido":
      return "assinado";
    case "declined":
    case "voided":
    case "expired":
    case "recusado":
    case "anulado":
    case "cancelado":
      return "cancelado";
    case "sent":
    case "delivered":
    case "processing":
    case "enviado":
    case "entregue":
      return "enviado";
    default:
      return null;
  }
}

/** Flag indicando se uma varredura de status já está em andamento. @type {boolean} */
let isRunning = false;

/**
 * Retorna se o scheduler de status está em execução no momento.
 *
 * @returns {boolean} True se estiver rodando, false caso contrário.
 */
export function isStatusSyncRunning() {
  return isRunning;
}

/**
 * Valida os pré-requisitos de configuração e restrição de horário antes de prosseguir com a sincronização.
 *
 * @param {Record<string, any>} config - Configuração ativa do robô DocuSign.
 * @returns {Promise<{ allowed: boolean, reason?: string }>} Resultado da validação prévia.
 * @async
 */
async function validateExecutionPrerequisites(config) {
  if (config.mode !== "robot") {
    console.log("[statusSyncScheduler] Robô desabilitado ou em modo API. Pulando consulta de status.");
    return { allowed: false, reason: "robot_disabled" };
  }

  if (config.operations?.statusCheck === false) {
    console.log("[statusSyncScheduler] Operação 'statusCheck' desabilitada nas configurações. Pulando.");
    return { allowed: false, reason: "status_check_disabled" };
  }

  const accessConfig = await SystemConfig.findOne({ key: "access_restriction" }).lean();
  if (accessConfig?.value?.enabled) {
    const isAllowed = isTimeAccessAllowed(accessConfig.value);
    if (!isAllowed) {
      console.log("[statusSyncScheduler] Fora do horário de expediente permitido. Pulando consulta.");
      return { allowed: false, reason: "outside_working_hours" };
    }
  }

  return { allowed: true };
}

/**
 * Verifica se há robôs autônomos de consulta (query) ativos e delega o job query_agreements para execução distribuída.
 *
 * @returns {Promise<{ delegated: boolean, reason?: string }>} Indica se o job foi delegado ou já está pendente.
 * @async
 */
async function handleDualRobotDelegation() {
  try {
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState === 1) {
      const hasQueryRobot = await RobotInstance.exists({
        role: { $in: ["query", "all"] },
        last_heartbeat: { $gt: new Date(Date.now() - 60 * 1000) },
      });

      // Expira jobs stale com mais de 10 minutos
      await RobotJob.updateMany(
        {
          action: "query_agreements",
          status: { $in: ["pending", "processing"] },
          createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) },
        },
        { $set: { status: "failed", error: "auto-expired: TTL 10min" } }
      );

      const hasPendingQueryJob = await RobotJob.exists({
        action: "query_agreements",
        status: { $in: ["pending", "processing"] },
        createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) },
      });

      if (hasQueryRobot && !hasPendingQueryJob) {
        await RobotJob.create({ action: "query_agreements", status: "pending", mode: "robot" });
        console.log("[statusSyncScheduler] Query robot conectado — job query_agreements enfileirado para robô externo.");
        return { delegated: true, reason: "enqueued_query_robot" };
      }

      if (hasQueryRobot && hasPendingQueryJob) {
        console.log("[statusSyncScheduler] Query job já pendente/processando — aguardando robô externo.");
        return { delegated: true, reason: "query_job_pending" };
      }
    }
  } catch (e) {
    console.warn("[statusSyncScheduler] Dual-robot check ignorado (sem DB):", e.message);
  }

  return { delegated: false };
}

/**
 * Realiza o cruzamento de um contrato ativo com a lista de envelopes obtidos da DocuSign.
 *
 * @param {Record<string, any>} contract - Dados do contrato.
 * @param {Array<Record<string, any>>} envelopes - Lista de envelopes da DocuSign.
 * @returns {Record<string, any>|null} Envelope correspondente ou null se não houver match.
 */
function matchContractWithEnvelope(contract, envelopes) {
  const repEmail = normalizeString(contract.client?.representante?.email || contract.client?.admin?.email);
  const repName = normalizeString(contract.client?.representante?.nome || contract.client?.admin?.nome);
  const storedEnvelopeId = contract.envelopeId || contract.docusign_envelope_id;

  return (
    envelopes.find((env) => {
      if (storedEnvelopeId && env.envelopeId && env.envelopeId === storedEnvelopeId) {
        return true;
      }
      const envRecipient = normalizeString(env.recipient);
      if (repEmail && envRecipient.includes(repEmail)) return true;
      if (repName && envRecipient.includes(repName)) return true;
      return false;
    }) || null
  );
}

/**
 * Realiza o download do PDF assinado e atualiza o contrato com o caminho do arquivo baixado.
 *
 * @param {Record<string, any>} contract - Dados do contrato.
 * @param {Record<string, any>} matchedEnvelope - Envelope correspondente da DocuSign.
 * @param {Record<string, any>} config - Configuração ativa do robô.
 * @param {string} contractId - Identificador do contrato.
 * @returns {Promise<boolean>} True se o download foi concluído ou o arquivo já existia, false caso contrário.
 * @async
 */
async function handleSignedContractDownload(contract, matchedEnvelope, config, contractId) {
  if (!matchedEnvelope.envelopeId || config.operations?.download === false) {
    return false;
  }

  try {
    const paths = buildDownloadPath(contract, matchedEnvelope.envelopeId);
    const fullFilePath = path.join(paths.downloadDir, paths.fileName);

    if (fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).size > 0) {
      console.log(`[statusSyncScheduler] PDF já existe e está salvo em: ${paths.relativePath}`);
      await syncContractStatus(contractId, "assinado", {
        envelopeId: matchedEnvelope.envelopeId,
        signedDocPath: paths.relativePath,
      });
      return true;
    }

    console.log(`[statusSyncScheduler] Baixando PDF assinado para o contrato ${contractId}...`);
    const dlResult = await browserrobot.executeWithBrowser("download", {
      envelopeId: matchedEnvelope.envelopeId,
      downloadDir: paths.downloadDir,
      fileName: paths.fileName,
      credentials: {
        ...config.credentials,
        token_notification_email: config.token_notification_email,
        mfa: config.mfa,
      },
    });

    if (dlResult !== null && dlResult !== undefined) {
      console.log(`[statusSyncScheduler] PDF assinado salvo com sucesso em: ${paths.relativePath}`);
      await syncContractStatus(contractId, "assinado", {
        envelopeId: matchedEnvelope.envelopeId,
        signedDocPath: paths.relativePath,
      });
      return true;
    }

    if (fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).size > 0) {
      console.log(`[statusSyncScheduler] PDF assinado salvo com sucesso em: ${paths.relativePath}`);
      await syncContractStatus(contractId, "assinado", {
        envelopeId: matchedEnvelope.envelopeId,
        signedDocPath: paths.relativePath,
      });
      return true;
    }
  } catch (dlErr) {
    console.error(`[statusSyncScheduler] Erro ao baixar PDF assinado do contrato ${contractId}:`, dlErr.message);
  }

  return false;
}

/**
 * Executa uma rodada completa de consulta geral de status na DocuSign e atualiza os contratos no banco.
 *
 * @param {Object} [options={}] - Parâmetros adicionais para a sincronização.
 * @param {number} [options.daysBack=30] - Quantidade de dias no passado a consultar na DocuSign.
 * @returns {Promise<{ success: boolean, checked: number, updated: number, downloaded: number, status?: string, reason?: string, error?: string }>} Relatório da sincronização.
 * @async
 */
export async function syncAllContractsStatus(options = {}) {
  if (isRunning) {
    console.log("[statusSyncScheduler] Varredura de status já em andamento. Pulando nova execução concorrente.");
    return {
      success: true,
      checked: 0,
      updated: 0,
      downloaded: 0,
      status: "busy",
      reason: "already_running",
    };
  }

  isRunning = true;
  try {
    console.log("[statusSyncScheduler] Iniciando varredura periódica de status geral...");

    const config = await getRobotConfig();
    const prereq = await validateExecutionPrerequisites(config);
    if (!prereq.allowed) {
      return { success: true, checked: 0, updated: 0, downloaded: 0, reason: prereq.reason };
    }

    const dualRobot = await handleDualRobotDelegation();
    if (dualRobot.delegated) {
      return { success: true, checked: 0, updated: 0, downloaded: 0, reason: dualRobot.reason };
    }

    // Buscar contratos ativos no banco (excluindo rascunhos e status finais irreversíveis)
    const activeContracts = await Contract.find({
      status: { $in: ["enviado", "gerado"] },
    }).lean();

    if (!activeContracts || activeContracts.length === 0) {
      console.log("[statusSyncScheduler] Nenhum contrato pendente de atualização de status encontrado.");
      return { success: true, checked: 0, updated: 0, downloaded: 0, reason: "no_active_contracts" };
    }

    console.log(`[statusSyncScheduler] ${activeContracts.length} contratos ativos identificados para checagem.`);

    let updatedCount = 0;
    let downloadedCount = 0;

    try {
      const daysBack = options.daysBack || 30;
      const queryResult = await browserrobot.executeWithBrowser("query_agreements", {
        credentials: {
          ...config.credentials,
          token_notification_email: config.token_notification_email,
          mfa: config.mfa,
        },
        daysBack,
        headless: true,
      });

      const envelopes = queryResult?.envelopes || [];
      console.log(`[statusSyncScheduler] ${envelopes.length} envelopes obtidos da DocuSign.`);

      for (const contract of activeContracts) {
        const contractId = contract._id ? contract._id.toString() : contract.id;
        const storedEnvelopeId = contract.envelopeId || contract.docusign_envelope_id;
        const matchedEnvelope = matchContractWithEnvelope(contract, envelopes);

        if (!matchedEnvelope) {
          continue;
        }

        const targetStatus = mapEnvelopeStatusToContractStatus(matchedEnvelope.status);
        if (!targetStatus) {
          console.warn(
            `[statusSyncScheduler] Status de envelope não reconhecido ou rascunho ('${matchedEnvelope.status}') para o contrato ${contractId}. Nenhuma alteração realizada.`
          );
          if (matchedEnvelope.envelopeId && !storedEnvelopeId) {
            await Contract.findByIdAndUpdate(contractId, { envelopeId: matchedEnvelope.envelopeId });
          }
          continue;
        }

        const isStatusChanged = targetStatus !== contract.status;

        if (isStatusChanged || (matchedEnvelope.envelopeId && !storedEnvelopeId)) {
          console.log(
            `[statusSyncScheduler] Atualizando contrato ${contractId}: status '${contract.status}' -> '${targetStatus}' (Envelope: ${matchedEnvelope.envelopeId || "N/A"})`
          );

          await syncContractStatus(contractId, targetStatus, { envelopeId: matchedEnvelope.envelopeId });
          updatedCount++;

          if (targetStatus === "assinado") {
            const isDownloaded = await handleSignedContractDownload(contract, matchedEnvelope, config, contractId);
            if (isDownloaded) {
              downloadedCount++;
            }
          }

          robotEvents.emit("job:progress", {
            jobId: contractId,
            contractId,
            status: targetStatus,
            action: "status",
            message: `Status do contrato atualizado para: ${targetStatus.toUpperCase()}`,
            envelopeId: matchedEnvelope.envelopeId,
            timestamp: new Date().toISOString(),
          });
        }
      }

      console.log(`[statusSyncScheduler] Varredura concluída: ${updatedCount} atualizados, ${downloadedCount} baixados.`);
      return {
        success: true,
        checked: activeContracts.length,
        updated: updatedCount,
        downloaded: downloadedCount,
      };
    } catch (error) {
      console.error("[statusSyncScheduler] Falha durante a consulta geral de status:", error);
      return {
        success: false,
        checked: activeContracts.length,
        updated: updatedCount,
        downloaded: downloadedCount,
        error: error.message,
      };
    }
  } finally {
    isRunning = false;
  }
}

/** Timer do timeout inicial de boot. @type {NodeJS.Timeout|null} */
let bootTimerId = null;

/** Timer do loop periódico de status. @type {NodeJS.Timeout|null} */
let statusTimerId = null;

/**
 * Inicia o loop periódico do scheduler de consulta de status geral.
 *
 * @param {number} [intervalMs] - Intervalo opcional em milissegundos para sobrescrever configuração.
 * @returns {Promise<NodeJS.Timeout|null>} A instância do timer criado ou null se desabilitado.
 * @async
 */
export async function start(intervalMs) {
  if (statusTimerId) {
    console.log("[statusSyncScheduler] Scheduler de status já está em execução.");
    return statusTimerId;
  }

  const config = await getRobotConfig();
  const schedule = config.schedule || {};

  const intervalMinutes = schedule.intervalMinutes || schedule.interval_minutes || 5;
  if (!intervalMs) {
    intervalMs = intervalMinutes * 60 * 1000;
  }

  console.log(`[statusSyncScheduler] Iniciando loop de consulta periódica de status (intervalo: ${intervalMinutes} min / ${intervalMs}ms)...`);

  // Executa uma checagem inicial após 5 segundos do boot
  bootTimerId = setTimeout(() => {
    bootTimerId = null;
    syncAllContractsStatus().catch((err) => {
      console.error("[statusSyncScheduler] Erro na consulta de status inicial:", err);
    });
  }, 5000);

  statusTimerId = setInterval(() => {
    syncAllContractsStatus().catch((err) => {
      console.error("[statusSyncScheduler] Erro no loop de consulta de status:", err);
    });
  }, intervalMs);

  return statusTimerId;
}

/**
 * Para o loop periódico do scheduler de consulta de status.
 *
 * @returns {void}
 */
export function stop() {
  if (bootTimerId) {
    clearTimeout(bootTimerId);
    bootTimerId = null;
  }
  if (statusTimerId) {
    clearInterval(statusTimerId);
    statusTimerId = null;
    console.log("[statusSyncScheduler] Scheduler de consulta de status parado com sucesso.");
  }
}

export default {
  syncAllContractsStatus,
  mapEnvelopeStatusToContractStatus,
  start,
  stop,
  isStatusSyncRunning,
};
