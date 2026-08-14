import RobotJob from "../models/RobotJob.js";
import SystemConfig from "../../../models/SystemConfig.js";
import robotOrchestrator from "./robotOrchestrator.js";
import { isTimeAccessAllowed } from "../../../utils/timeRestrictionService.js";
import Contract from "../../../models/Contract.js";

/**
 * Processa até 1 contrato pendente na fila do Robô DocuSign.
 * Respeita as flags de ativação, limite de concorrência e horário de funcionamento.
 *
 * @param {Object} [options={}] - Opções adicionais para a execução do scheduler.
 * @returns {Promise<Object>} Resultado do processamento do job.
 */
export async function processPendingJobs(options = {}) {
  console.log("[robotScheduler] Iniciando verificação de jobs pendentes...");

  // 1. Verificar se o robô está habilitado
  const config = await robotOrchestrator.getRobotConfig();
  if (!config.enabled || config.mode === "api") {
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
  const accessConfig = await SystemConfig.findOne({ key: "access_restriction" })?.lean();
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

  // 4. Buscar exatamente 1 contrato/job pendente na fila (status: 'pending' ou 'retrying' elegível)
  const now = new Date();
  const job = await RobotJob.findOne({
    $or: [
      { status: "pending" },
      {
        status: "retrying",
        $or: [
          { next_retry_at: { $lte: now } },
          { next_retry_at: { $exists: false } },
          { next_retry_at: null },
        ],
      },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!job) {
    // Busca 1 contrato com status 'gerado' (mais antigo)
    const contract = await Contract.findOne({ status: "gerado" })
      .sort({ createdAt: 1 })
      .lean();

    if (contract) {
      console.log(`[robotScheduler] Encontrado contrato com status 'gerado' (${contract._id}). Disparando executeJob...`);
      try {
        const result = await robotOrchestrator.executeJob(contract, "send", {
          ...options,
          scheduledRun: true,
        });

        return {
          success: true,
          processed: 1,
          contractId: contract._id,
          jobId: result.jobId,
          result,
        };
      } catch (error) {
        console.error(`[robotScheduler] Erro ao executar job para contrato gerado (${contract._id}):`, error);
        return {
          success: false,
          processed: 1,
          contractId: contract._id,
          error: error.message,
        };
      }
    }

    console.log("[robotScheduler] Nenhum job pendente e nenhum contrato gerado para processar.");
    return {
      success: true,
      processed: 0,
      status: "idle",
      reason: "no_pending_jobs",
    };
  }

  const contractId = job.contract_id || job.contractId;
  const action = job.action || "send";

  console.log(`[robotScheduler] Processando job ${job._id} para o contrato ${contractId} (Ação: ${action})...`);

  // 5. Executar o job via robotOrchestrator
  try {
    const result = await robotOrchestrator.trigger(contractId, action, {
      ...options,
      jobId: job._id,
      scheduledRun: true,
    });

    console.log(`[robotScheduler] Job ${job._id} finalizado com sucesso.`);
    return {
      success: true,
      processed: 1,
      jobId: job._id,
      contractId,
      result,
    };
  } catch (error) {
    console.error(`[robotScheduler] Erro ao executar job ${job._id}:`, error);
    return {
      success: false,
      processed: 1,
      jobId: job._id,
      contractId,
      error: error.message,
    };
  }
}

let timerId = null;

/**
 * Starts the periodic job scheduler for DocuSign Robot.
 * @param {number} [intervalMs=30000] - Polling interval in milliseconds.
 * @returns {NodeJS.Timeout} The timer instance.
 */
export function start(intervalMs = 30000) {
  if (timerId) {
    console.log("[robotScheduler] Scheduler is already running.");
    return timerId;
  }

  console.log(`[robotScheduler] Starting scheduler loop (interval: ${intervalMs}ms)...`);

  setTimeout(() => {
    processPendingJobs().catch((err) => {
      console.error("[robotScheduler] Error processing pending jobs on boot:", err);
    });
  }, 1000);

  timerId = setInterval(() => {
    processPendingJobs().catch((err) => {
      console.error("[robotScheduler] Error in scheduler loop:", err);
    });
  }, intervalMs);

  return timerId;
}

/**
 * Stops the periodic job scheduler for DocuSign Robot.
 */
export function stop() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log("[robotScheduler] Scheduler stopped successfully.");
  }
}

export default {
  processPendingJobs,
  start,
  stop,
};

