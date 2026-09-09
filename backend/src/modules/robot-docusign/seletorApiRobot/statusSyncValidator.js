/**
 * @file Validador de pré-requisitos de execução e delegador de jobs do scheduler de status.
 * Responsável pela verificação de configuração, restrição de horários e delegação para robôs autônomos de consulta.
 * Aplica os princípios SOLID (SRP) e Clean Boundaries.
 */

import SystemConfig from "../../../models/SystemConfig.js";
import RobotJob from "../models/RobotJob.js";
import RobotInstance from "../models/RobotInstance.js";
import { isTimeAccessAllowed } from "../../../utils/timeRestrictionService.js";

/**
 * Valida os pré-requisitos de configuração e restrição de horário antes de prosseguir com a sincronização.
 *
 * @param {Record<string, any>} config - Configuração ativa do robô DocuSign.
 * @returns {Promise<{ allowed: boolean, reason?: string }>} Resultado da validação prévia.
 * @async
 */
export async function validateExecutionPrerequisites(config) {
  if (config.mode !== "robot") {
    console.log("[statusSyncScheduler] Robô desabilitado ou em modo API. Pulando consulta de status.");
    return { allowed: false, reason: "robot_disabled" };
  }

  if (config.operations?.statusCheck === false) {
    console.log("[statusSyncScheduler] Operação 'statusCheck' desabilitada nas configurações. Pulando.");
    return { allowed: false, reason: "status_check_disabled" };
  }

  const accessConfig = await SystemConfig.findOne({ key: "access_restriction" }).lean();
  if (accessConfig?.value?.enabled) {
    const isAllowed = isTimeAccessAllowed(accessConfig.value);
    if (!isAllowed) {
      console.log("[statusSyncScheduler] Fora do horário de expediente permitido. Pulando consulta.");
      return { allowed: false, reason: "outside_working_hours" };
    }
  }

  return { allowed: true };
}

/**
 * Verifica se há robôs autônomos de consulta (query) ativos e delega o job query_agreements para execução distribuída.
 *
 * @returns {Promise<{ delegated: boolean, reason?: string }>} Indica se o job foi delegado ou já está pendente.
 * @async
 */
export async function handleDualRobotDelegation() {
  try {
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState === 1) {
      const hasQueryRobot = await RobotInstance.exists({
        role: { $in: ["query", "all"] },
        last_heartbeat: { $gt: new Date(Date.now() - 60 * 1000) },
      });

      // Expira jobs stale com mais de 10 minutos
      await RobotJob.updateMany(
        {
          action: "query_agreements",
          status: { $in: ["pending", "processing"] },
          createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) },
        },
        { $set: { status: "failed", error: "auto-expired: TTL 10min" } }
      );

      const hasPendingQueryJob = await RobotJob.exists({
        action: "query_agreements",
        status: { $in: ["pending", "processing"] },
        createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) },
      });

      if (hasQueryRobot && !hasPendingQueryJob) {
        await RobotJob.create({ action: "query_agreements", status: "pending", mode: "robot" });
        console.log("[statusSyncScheduler] Query robot conectado — job query_agreements enfileirado para robô externo.");
        return { delegated: true, reason: "enqueued_query_robot" };
      }

      if (hasQueryRobot && hasPendingQueryJob) {
        console.log("[statusSyncScheduler] Query job já pendente/processando — aguardando robô externo.");
        return { delegated: true, reason: "query_job_pending" };
      }
    }
  } catch (e) {
    console.warn("[statusSyncScheduler] Dual-robot check ignorado (sem DB):", e.message);
  }

  return { delegated: false };
}

export default {
  validateExecutionPrerequisites,
  handleDualRobotDelegation,
};
