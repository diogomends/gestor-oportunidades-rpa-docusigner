import RobotInstance from "../../models/RobotInstance.js";
import { getLogs, pruneIdle } from "../../utils/telemetryBuffer.js";

/**
 * Lista todas as instâncias registradas do robô com métricas por role e status de presença.
 *
 * @async
 * @param {import("express").Request} req - Requisição Express (query includeLogs).
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<import("express").Response>} Lista de instâncias com flags alive e contadores por role.
 */
export const getAllInstances = async (req, res) => {
  try {
    const instances = await RobotInstance.find({})
      .sort({ last_heartbeat: -1 })
      .lean();

    const instancesByRole = { query: 0, update: 0, all: 0, total: instances.length };
    const lastSeenMap = new Map();
    for (const inst of instances) {
      if (inst.role && instancesByRole[inst.role] !== undefined) instancesByRole[inst.role]++;
      else if (!inst.role) instancesByRole.all++;
      if (inst.last_heartbeat) {
        lastSeenMap.set(inst.instance_id, new Date(inst.last_heartbeat).getTime());
      }
    }

    // Limpa buffers em memória de instâncias inativas (>10 min)
    pruneIdle(lastSeenMap);

    const includeLogs = req.query?.includeLogs === "true" || req.query?.includeLogs === "1";
    const now = Date.now();
    return res.status(200).json({
      success: true,
      instances: instances.map((inst) => {
        const isAlive = inst.last_heartbeat
          ? (now - new Date(inst.last_heartbeat).getTime()) < 90000
          : false;
        return {
          instance_id: inst.instance_id,
          status: inst.status,
          role: inst.role || "all",
          alive: isAlive,
          last_heartbeat: inst.last_heartbeat,
          current_job_id: inst.current_job_id || null,
          jobs_processed_today: inst.jobs_processed_today || 0,
          machine_info: inst.machine_info || {},
          ...(includeLogs
            ? {
                logs: getLogs(inst.instance_id),
                telemetryLogs: getLogs(inst.instance_id),
              }
            : {}),
          createdAt: inst.createdAt,
          updatedAt: inst.updatedAt,
        };
      }),
      instances_by_role: instancesByRole,
    });
  } catch (error) {
    console.error("[getAllInstances] Erro ao listar instâncias:", error);
    return res.status(500).json({ error: "Erro ao listar instâncias", message: error.message });
  }
};

export default getAllInstances;
