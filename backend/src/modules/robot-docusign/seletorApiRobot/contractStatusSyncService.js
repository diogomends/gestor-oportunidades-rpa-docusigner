/**
 * @file Motor de varredura e sincronização em lote de status de contratos DocuSign (seletorApiRobot).
 * Orquestra a consulta aos contratos ativos, verificação no DocuSign e emissão de eventos SSE.
 * Aplica os princípios SOLID (SRP, DIP) e Anti-Phantom Success Hardening.
 */

import Contract from "../../../models/Contract.js";
import browserrobot from "../browserrobot/index.js";
import { getRobotConfig } from "./orchestratorConfig.js";
import { robotEvents } from "./orchestratorEvents.js";
import { syncContractStatus } from "./contractSyncService.js";
import { mapEnvelopeStatusToContractStatus, matchContractWithEnvelope } from "./contractEnvelopeMatcher.js";
import { validateExecutionPrerequisites, handleDualRobotDelegation } from "./statusSyncValidator.js";
import { handleSignedContractDownload } from "./signedPdfDownloadService.js";

/** Flag indicando se uma varredura de status já está em andamento. @type {boolean} */
let isRunning = false;

/**
 * Retorna se o serviço de sincronização de status está em execução no momento.
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

        const extraUpdate = {
          envelopeId: matchedEnvelope.envelopeId,
          pendingSigner: matchedEnvelope.pendingSigner || null,
          docusignStatusDetail: matchedEnvelope.statusDetail || matchedEnvelope.rawStatus || null,
          rawDocusignStatus: matchedEnvelope.rawStatus || null,
        };

        const isStatusChanged = targetStatus !== contract.status;
        const isSignerChanged = (matchedEnvelope.pendingSigner && matchedEnvelope.pendingSigner !== contract.pendingSigner);
        const isDetailChanged = (matchedEnvelope.statusDetail && matchedEnvelope.statusDetail !== contract.docusignStatusDetail);
        const isEnvelopeNew = (matchedEnvelope.envelopeId && !storedEnvelopeId);

        if (isStatusChanged || isSignerChanged || isDetailChanged || isEnvelopeNew) {
          console.log(
            `[statusSyncScheduler] Atualizando contrato ${contractId}: status '${contract.status}' -> '${targetStatus}' (Signatário: ${matchedEnvelope.pendingSigner || "N/A"}, Detalhe: ${matchedEnvelope.statusDetail || "N/A"})`
          );

          await syncContractStatus(contractId, targetStatus, extraUpdate);
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
            pendingSigner: extraUpdate.pendingSigner,
            docusignStatusDetail: extraUpdate.docusignStatusDetail,
            rawDocusignStatus: extraUpdate.rawDocusignStatus,
            action: "status",
            message: extraUpdate.docusignStatusDetail
              ? `Status do contrato atualizado: ${extraUpdate.docusignStatusDetail}`
              : `Status do contrato atualizado para: ${targetStatus.toUpperCase()}`,
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

export default {
  syncAllContractsStatus,
  isStatusSyncRunning,
};
