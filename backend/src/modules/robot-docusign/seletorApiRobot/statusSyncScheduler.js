/**
 * @file Scheduler dedicado à sincronização periódica e consulta geral de status de contratos no DocuSign.
 * Varre contratos ativos (não-rascunho), consulta o painel da DocuSign, atualiza o banco e baixa PDFs assinados.
 */

import fs from "node:fs";
import path from "node:path";
import Contract from "../../../models/Contract.js";
import SystemConfig from "../../../models/SystemConfig.js";
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

    // 1. Validar configuração do robô e permissão da operação statusCheck
    const config = await getRobotConfig();
    if (config.mode !== "robot") {
      console.log("[statusSyncScheduler] Robô desabilitado ou em modo API. Pulando consulta de status.");
      return { success: true, checked: 0, updated: 0, downloaded: 0, reason: "robot_disabled" };
    }

    if (config.operations?.statusCheck === false) {
      console.log("[statusSyncScheduler] Operação 'statusCheck' desabilitada nas configurações. Pulando.");
      return { success: true, checked: 0, updated: 0, downloaded: 0, reason: "status_check_disabled" };
    }

    // 2. Validar horário de expediente se habilitado
    const accessConfig = await SystemConfig.findOne({ key: "access_restriction" }).lean();
    if (accessConfig?.value?.enabled) {
      const isAllowed = isTimeAccessAllowed(accessConfig.value);
      if (!isAllowed) {
        console.log("[statusSyncScheduler] Fora do horário de expediente permitido. Pulando consulta.");
        return { success: true, checked: 0, updated: 0, downloaded: 0, reason: "outside_working_hours" };
      }
    }

    // 3. Buscar contratos ativos no banco (excluindo rascunhos e contratos com status finais irreversíveis)
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
      // 4. Consultar listagem geral de acordos na DocuSign via Playwright
      const daysBack = options.daysBack || 30;
      const queryResult = await browserrobot.executeWithBrowser("query_agreements", {
        credentials: config.credentials,
        daysBack,
        headless: true,
      });

      const envelopes = queryResult?.envelopes || [];
      console.log(`[statusSyncScheduler] ${envelopes.length} envelopes obtidos da DocuSign.`);

      // 5. Cruzar cada contrato ativo com os envelopes retornados
      for (const contract of activeContracts) {
        const contractId = contract._id ? contract._id.toString() : contract.id;
        const repEmail = normalizeString(contract.client?.representante?.email || contract.client?.admin?.email);
        const repName = normalizeString(contract.client?.representante?.nome || contract.client?.admin?.nome);
        const storedEnvelopeId = contract.envelopeId || contract.docusign_envelope_id;

        // Localiza o envelope correspondente por ID exato ou por e-mail/nome do destinatário
        const matchedEnvelope = envelopes.find((env) => {
          if (storedEnvelopeId && env.envelopeId && env.envelopeId === storedEnvelopeId) {
            return true;
          }
          const envRecipient = normalizeString(env.recipient);
          if (repEmail && envRecipient.includes(repEmail)) return true;
          if (repName && envRecipient.includes(repName)) return true;
          return false;
        });

        if (!matchedEnvelope) {
          continue;
        }

        const targetStatus = mapEnvelopeStatusToContractStatus(matchedEnvelope.status);
        if (!targetStatus) {
          console.warn(
            `[statusSyncScheduler] Status de envelope não reconhecido ou rascunho ('${matchedEnvelope.status}') para o contrato ${contractId}. Nenhuma alteração de status realizada.`
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

          // 6. Se o contrato foi assinado/concluído e o download automático está ativo, baixa o PDF
          if (targetStatus === "assinado" && matchedEnvelope.envelopeId && config.operations?.download !== false) {
            try {
              const paths = buildDownloadPath(contract, matchedEnvelope.envelopeId);
              const fullFilePath = path.join(paths.downloadDir, paths.fileName);
              
              if (fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).size > 0) {
                console.log(`[statusSyncScheduler] PDF já existe e está salvo em: ${paths.relativePath}`);
                downloadedCount++;
                continue;
              }

              console.log(`[statusSyncScheduler] Baixando PDF assinado para o contrato ${contractId}...`);
              await browserrobot.executeWithBrowser("download", {
                envelopeId: matchedEnvelope.envelopeId,
                downloadDir: paths.downloadDir,
                fileName: paths.fileName,
                credentials: config.credentials,
              });

              if (fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).size > 0) {
                downloadedCount++;
                console.log(`[statusSyncScheduler] PDF assinado salvo com sucesso em: ${paths.relativePath}`);
              }
            } catch (dlErr) {
              console.error(`[statusSyncScheduler] Erro ao baixar PDF assinado do contrato ${contractId}:`, dlErr.message);
            }
          }

          // 7. Notifica frontend em tempo real via evento de progresso SSE
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

  const intervalMinutes = schedule.intervalMinutes || schedule.interval_minutes || 10;
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

/**
 * Exportação padrão do scheduler de sincronização de status.
 * @constant
 * @type {Object}
 */

export default {
  syncAllContractsStatus,
  mapEnvelopeStatusToContractStatus,
  start,
  stop,
  isStatusSyncRunning,
};
