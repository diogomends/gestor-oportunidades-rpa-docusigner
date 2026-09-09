/**
 * @file Barramento de eventos global e emissão de progresso de jobs do robô DocuSign.
 * Aplica o Princípio de Responsabilidade Única (SRP) e desacopla a notificação de eventos da orquestração.
 */

import { EventEmitter } from "node:events";

/**
 * Instância global do EventEmitter para o Robô DocuSign emitir progresso dos jobs.
 */
export const robotEvents = new EventEmitter();

/**
 * Emite evento de progresso do job para os ouvintes (ex: SSE endpoints).
 * Eventos: `job:progress` (jobs) e `instance:telemetry` (logs ociosos via heartbeat).
 *
 * @param {Object} job - Instância ou dados do RobotJob.
 * @param {string[]} [logs=[]] - Logs de execução acumulados reportados pelo robô.
 */
export function emitProgress(job, logs = []) {
  if (!job) return;
  const jobLogs = Array.isArray(logs) && logs.length > 0 ? logs : Array.isArray(job.logs) ? job.logs : [];
  robotEvents.emit("job:progress", {
    jobId: job._id ? job._id.toString() : String(job.id || job.contract_id),
    status: job.status,
    steps: job.steps,
    result: job.result,
    error: job.error,
    logs: jobLogs,
  });
}

export default {
  robotEvents,
  emitProgress,
};
