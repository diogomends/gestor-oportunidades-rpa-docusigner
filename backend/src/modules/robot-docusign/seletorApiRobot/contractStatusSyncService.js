/**
 * @file Fachada Barrel DIP e ponto de entrada para o motor de sincronização de status de contratos DocuSign.
 * Re-exporta funções atômicas de ./statusSync/ mantendo 100% de compatibilidade retroativa.
 */

export { getStatusSyncRunningState, setStatusSyncRunningState, isStatusSyncRunning } from "./statusSync/getStatusSyncRunningState.js";
export { orchestrateAllContractsStatusSync, syncAllContractsStatus } from "./statusSync/orchestrateAllContractsStatusSync.js";

import { getStatusSyncRunningState } from "./statusSync/getStatusSyncRunningState.js";
import { orchestrateAllContractsStatusSync } from "./statusSync/orchestrateAllContractsStatusSync.js";

export default {
  syncAllContractsStatus: orchestrateAllContractsStatusSync,
  isStatusSyncRunning: getStatusSyncRunningState,
  orchestrateAllContractsStatusSync,
  getStatusSyncRunningState,
};
