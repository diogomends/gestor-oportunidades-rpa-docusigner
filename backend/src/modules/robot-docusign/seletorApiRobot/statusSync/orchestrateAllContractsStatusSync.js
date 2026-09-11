/**
 * @file Orquestrador atômico para sincronização em lote de status de contratos DocuSign via frota de robôs.
 */

import { getRobotConfig } from "../orchestratorConfig.js";
import { validateExecutionPrerequisites, handleDualRobotDelegation } from "../statusSyncValidator.js";
import {
  getStatusSyncRunningState,
  setStatusSyncRunningState,
} from "./getStatusSyncRunningState.js";

/**
 * Executa uma rodada completa de consulta geral de status na DocuSign e atualiza os contratos no banco.
 *
 * @param {Object} [options={}] - Parâmetros adicionais para a sincronização.
 * @param {number} [options.daysBack=30] - Quantidade de dias no passado a consultar na DocuSign.
 * @returns {Promise<{ success: boolean, checked: number, updated: number, downloaded: number, status?: string, reason?: string, error?: string }>} Relatório da sincronização.
 * @async
 */
export async function orchestrateAllContractsStatusSync(options = {}) {
  if (getStatusSyncRunningState()) {
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

  setStatusSyncRunningState(true);
  try {
    console.log("[statusSyncScheduler] Iniciando varredura periódica de status geral...");

    const config = await getRobotConfig();
    const prereq = await validateExecutionPrerequisites(config);
    if (!prereq.allowed) {
      return { success: true, checked: 0, updated: 0, downloaded: 0, reason: prereq.reason };
    }

    const dualRobot = await handleDualRobotDelegation();
    if (dualRobot.handled) {
      return { success: true, checked: 0, updated: 0, downloaded: 0, reason: dualRobot.reason };
    }

    console.log("[statusSyncScheduler] Frota de robôs de consulta indisponível. Encerrando rodada sem executar navegador no servidor.");
    return { success: true, checked: 0, updated: 0, downloaded: 0, reason: "fleet_unavailable" };
  } finally {
    setStatusSyncRunningState(false);
  }
}

/** Alias retrocompatível */
export const syncAllContractsStatus = orchestrateAllContractsStatusSync;

export default orchestrateAllContractsStatusSync;
