/**
 * @file Módulo atômico para controle do estado de execução e trava de concorrência da sincronização de status.
 */

/** Flag indicando se uma varredura de status já está em andamento. @type {boolean} */
let isRunning = false;

/**
 * Retorna se o serviço de sincronização de status está em execução no momento.
 *
 * @returns {boolean} True se estiver rodando, false caso contrário.
 */
export function getStatusSyncRunningState() {
  return isRunning;
}

/**
 * Define o estado da trava de concorrência da sincronização de status.
 *
 * @param {boolean} runningState - Novo estado de execução.
 */
export function setStatusSyncRunningState(runningState) {
  isRunning = Boolean(runningState);
}

/** Alias retrocompatível */
export const isStatusSyncRunning = getStatusSyncRunningState;

export default {
  getStatusSyncRunningState,
  setStatusSyncRunningState,
  isStatusSyncRunning,
};
