/**
 * @file RingBuffer em memória de logs ociosos por instância do robô.
 * Cap 100 mensagens/instância (FIFO). Dado efêmero: perda em restart é aceitável.
 */

const MAX_LOGS = 100;

/** @type {Map<string, string[]>} */
const buffers = new Map();

/**
 * Anexa logs ao buffer da instância (FIFO cap 100).
 * @param {string} instanceId - ID da instância do robô.
 * @param {string[]} [logs=[]] - Mensagens a anexar.
 * @returns {string[]} Buffer atual (cópia).
 */
export function pushLogs(instanceId, logs = []) {
  if (!instanceId || !Array.isArray(logs) || logs.length === 0) return getLogs(instanceId);
  const buf = buffers.get(instanceId) || [];
  for (const log of logs) buf.push(String(log).slice(0, 500));
  if (buf.length > MAX_LOGS) buf.splice(0, buf.length - MAX_LOGS);
  buffers.set(instanceId, buf);
  return [...buf];
}

/**
 * Retorna cópia dos logs da instância.
 * @param {string} instanceId - ID da instância do robô.
 * @returns {string[]} Últimos logs (mais antigo primeiro).
 */
export function getLogs(instanceId) {
  return [...(buffers.get(instanceId) || [])];
}

/**
 * Remove buffers de instâncias sem heartbeat recente.
 * @param {Map<string, number>|Object<string, number>} [lastSeenById] - Mapa instanceId -> timestamp ms.
 * @param {number} [maxIdleMs=600000] - Idleness máxima (padrão 10min).
 * @returns {void}
 */
export function pruneIdle(lastSeenById, maxIdleMs = 600000) {
  const now = Date.now();
  const entries = lastSeenById instanceof Map ? lastSeenById.entries() : Object.entries(lastSeenById || {});
  for (const [id, ts] of entries) {
    if (now - Number(ts) > maxIdleMs) buffers.delete(id);
  }
}

export default { pushLogs, getLogs, pruneIdle, MAX_LOGS };
