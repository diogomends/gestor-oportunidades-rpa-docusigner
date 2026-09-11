/**
 * @file Scheduler e processador periódico de fila para o robô DocuSign.
 * Gerencia a execução de contratos e jobs pendentes com controle de concorrência e restrição de horário.
 */

import RobotJob from "../models/RobotJob.js";
import RobotInstance from "../models/RobotInstance.js";
import SystemConfig from "../../../models/SystemConfig.js";
import robotOrchestrator from "./index.js";
import { isTimeAccessAllowed } from "../../../utils/timeRestrictionService.js";

/** Cache do último motivo de skip de frota emitido em log (evita ruído a cada tick — log apenas na transição de estado). @type {string|null} */
let lastFleetLogReason = null;

/**
 * Processa até 1 contrato pendente na fila do Robô DocuSign.
 * Respeita as flags de ativação, limite de concorrência e horário de funcionamento.
 *
 * @param {Object} [options={}] - Mantido por compatibilidade de chamadas (ex.: `triggeredByUserId` do controller `/process-pending`); atualmente ignorado — o scheduler não executa jobs inline.
 * @returns {Promise<Object>} Resultado do processamento (`reason`: `robot_disabled`, `outside_working_hours`, `max_concurrent_reached`, `fleet_active` ou `fleet_offline`).
 */
export async function processPendingJobs(options = {}) {
  console.log("[robotScheduler] Iniciando verificação de jobs pendentes...");

  // 1. Verificar se o robô está habilitado
  const config = await robotOrchestrator.getRobotConfig();
  if (config.mode !== "robot") {
    console.log("[robotScheduler] Robô desabilitado ou configurado em modo API. Pulando execução.");
    return {
      success: true,
      processed: 0,
      disabled: true,
      status: "skipped",
      reason: "robot_disabled",
    };
  }

  // 2. Verificar horário de funcionamento
  const accessConfig = await SystemConfig.findOne({ key: "access_restriction" }).lean();
  if (accessConfig?.value?.enabled) {
    const isAllowed = isTimeAccessAllowed(accessConfig.value);
    if (!isAllowed) {
      console.log("[robotScheduler] Fora do horário de expediente permitido. Pulando execução.");
      return {
        success: true,
        processed: 0,
        status: "skipped",
        reason: "outside_working_hours",
      };
    }
  }

  // 3. Verificar limite de concorrência (máximo de jobs rodando simultaneamente)
  const runningCount = await RobotJob.countDocuments({
    status: { $in: ["processing", "running"] },
  });
  const maxConcurrent = config.limits?.max_concurrent || 1;
  if (runningCount >= maxConcurrent) {
    console.log(`[robotScheduler] Limite de concorrência atingido (${runningCount}/${maxConcurrent}). Aguardando término.`);
    return {
      success: true,
      processed: 0,
      status: "busy",
      reason: "max_concurrent_reached",
      runningCount,
      maxConcurrent,
    };
  }

  // 3b. Verificar se há robô da frota (update ou all) ativo (heartbeat < 90s e status não-offline)
  const activeFleetThreshold = new Date(Date.now() - 90 * 1000);
  const activeFleetRobot = await RobotInstance.findOne({
    role: { $in: ["update", "all"] },
    status: { $ne: "offline" },
    last_heartbeat: { $gte: activeFleetThreshold },
  }).lean();

  if (activeFleetRobot) {
    if (lastFleetLogReason !== "fleet_active") {
      console.log(`[robotScheduler] Frota de robôs ativa detectada (${activeFleetRobot.instance_id}, role: ${activeFleetRobot.role || "all"}). Jobs são atendidos via pull pela frota.`);
      lastFleetLogReason = "fleet_active";
    }
    return {
      success: true,
      processed: 0,
      status: "skipped",
      reason: "fleet_active",
      activeInstanceId: activeFleetRobot.instance_id,
    };
  }

  if (lastFleetLogReason !== "fleet_offline") {
    console.log("[robotScheduler] Nenhum robô de envio ('update' ou 'all') ativo na frota. Jobs permanecem na fila aguardando robôs externos.");
    lastFleetLogReason = "fleet_offline";
  }
  return {
    success: true,
    processed: 0,
    status: "skipped",
    reason: "fleet_offline",
  };
}

/** Timer do timeout inicial de boot. @type {NodeJS.Timeout|null} */
let initialTimeoutId = null;

/** Timer do loop periódico do scheduler. @type {NodeJS.Timeout|null} */
let timerId = null;

/**
 * Inicia o loop periódico do scheduler do Robô DocuSign.
 * @param {number} [intervalMs=30000] - Intervalo de polling em milissegundos.
 * @returns {NodeJS.Timeout} A instância do timer criado.
 */
export function start(intervalMs = 30000) {
  if (timerId) {
    console.log("[robotScheduler] Scheduler já está em execução.");
    return timerId;
  }

  console.log(`[robotScheduler] Iniciando loop do scheduler (intervalo: ${intervalMs}ms)...`);

  initialTimeoutId = setTimeout(() => {
    initialTimeoutId = null;
    processPendingJobs().catch((err) => {
      console.error("[robotScheduler] Erro ao processar jobs pendentes no boot:", err);
    });
  }, 1000);

  timerId = setInterval(() => {
    processPendingJobs().catch((err) => {
      console.error("[robotScheduler] Erro no loop do scheduler:", err);
    });
  }, intervalMs);

  return timerId;
}

/**
 * Para o loop periódico do scheduler do Robô DocuSign.
 */
export function stop() {
  if (initialTimeoutId) {
    clearTimeout(initialTimeoutId);
    initialTimeoutId = null;
  }
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log("[robotScheduler] Scheduler parado com sucesso.");
  }
}

export default {
  processPendingJobs,
  start,
  stop,
};
