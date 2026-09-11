/**
 * @file Motor de varredura e sincronização em lote de status de contratos DocuSign (seletorApiRobot).
 * Orquestra a consulta aos contratos ativos, verificação no DocuSign e emissão de eventos SSE.
 * Aplica os princípios SOLID (SRP, DIP) e Anti-Phantom Success Hardening.
 */

import { getRobotConfig } from "./orchestratorConfig.js";
import { validateExecutionPrerequisites, handleDualRobotDelegation } from "./statusSyncValidator.js";

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
 * @param {number} [options.daysBack=30] - Mantido por compatibilidade de API (`?daysBack=`); a consulta efetiva ocorre no robô de consulta via delegação — o servidor não executa mais o navegador.
 * @returns {Promise<{ success: boolean, checked: number, updated: number, downloaded: number, status?: string, reason?: string, error?: string }>} Relatório da sincronização (em `reason` podem vir `enqueued_query_robot`, `query_job_pending`, `fleet_offline` ou `fleet_unavailable` quando a rodada é delegada/abortada).
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
    if (dualRobot.handled) {
      return { success: true, checked: 0, updated: 0, downloaded: 0, reason: dualRobot.reason };
    }

    console.log("[statusSyncScheduler] Frota de robôs de consulta indisponível. Encerrando rodada sem executar navegador no servidor.");
    return { success: true, checked: 0, updated: 0, downloaded: 0, reason: "fleet_unavailable" };
  } finally {
    isRunning = false;
  }
}

export default {
  syncAllContractsStatus,
  isStatusSyncRunning,
};
