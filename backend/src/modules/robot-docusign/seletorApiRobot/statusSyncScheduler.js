/**
 * @file Scheduler e agendador de ciclo de vida para sincronização periódica de status no DocuSign.
 * Controla os timers de execução periódica e re-exporta as operações para compatibilidade com a arquitetura DIP.
 * Aplica os princípios SOLID (SRP, DIP) e PonyTail.
 */

import { getRobotConfig } from "./orchestratorConfig.js";
import { syncAllContractsStatus, isStatusSyncRunning } from "./contractStatusSyncService.js";
import { mapEnvelopeStatusToContractStatus } from "./contractEnvelopeMatcher.js";

export { syncAllContractsStatus, isStatusSyncRunning, mapEnvelopeStatusToContractStatus };

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
