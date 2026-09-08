import { z } from "zod";
import RobotInstance from "../../models/RobotInstance.js";
import { robotEvents } from "../../seletorApiRobot/orchestratorEvents.js";
import { pushLogs } from "../../utils/telemetryBuffer.js";
import { normalizeRole } from "../../utils/roleActions.js";

/**
 * Valida role e retorna normalizado ou __invalid__.
 * @param {string|undefined|null} role - Role recebido.
 * @returns {string|null} Role normalizado ("query", "update", "all"), null se ausente ou "__invalid__".
 */
function parseRoleOr400(role) {
  if (role === undefined || role === null || role === "") return null;
  const norm = normalizeRole(role);
  if (!norm) return "__invalid__";
  return norm;
}

/**
 * Zod Schema para payload de heartbeat da instância do robô.
 * @constant
 * @type {import("zod").ZodObject<any>}
 */
const heartbeatSchema = z.object({
  instance_id: z.string().min(1),
  status: z.enum(["active", "idle", "busy", "offline"]).default("idle"),
  role: z.string().optional(),
  current_job_id: z.string().optional().nullable(),
  jobs_processed_today: z.number().optional(),
  telemetryLogs: z.array(z.string().max(500)).max(20).optional(),
  machine_info: z.record(z.any()).optional(),
});

/**
 * Registra o heartbeat periódico da instância standalone e armazena logs de telemetria ociosa.
 *
 * @async
 * @param {import("express").Request} req - Requisição Express (body instance_id, status, role, telemetryLogs).
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<import("express").Response>} Instância atualizada com last_heartbeat.
 */
export const registerHeartbeat = async (req, res) => {
  try {
    const parse = heartbeatSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: "Dados de heartbeat inválidos",
        message: "Dados de heartbeat inválidos",
        details: parse.error.errors,
      });
    }

    const { instance_id, status, current_job_id, jobs_processed_today, machine_info, role: rawRole, telemetryLogs } = parse.data;

    let normalizedRole = null;
    if (rawRole !== undefined && rawRole !== null && rawRole !== "") {
      normalizedRole = parseRoleOr400(rawRole);
      if (normalizedRole === "__invalid__") {
        return res.status(400).json({
          error: "role inválido",
          message: "role inválido",
        });
      }
    }

    const updateDoc = {
      status,
      last_heartbeat: new Date(),
    };

    if (current_job_id !== undefined) updateDoc.current_job_id = current_job_id;
    if (jobs_processed_today !== undefined) updateDoc.jobs_processed_today = jobs_processed_today;
    if (machine_info) updateDoc.machine_info = machine_info;
    if (normalizedRole) updateDoc.role = normalizedRole;

    const instance = await RobotInstance.findOneAndUpdate(
      { instance_id },
      { $set: updateDoc },
      { upsert: true, new: true }
    );

    // Telemetria ociosa: RingBuffer + evento SSE (só logs novos do heartbeat)
    const newLogs = Array.isArray(telemetryLogs) ? telemetryLogs : [];
    if (newLogs.length) {
      pushLogs(instance_id, newLogs);
      try {
        robotEvents.emit("instance:telemetry", {
          instanceId: instance_id,
          status: instance.status,
          lastHeartbeat: instance.last_heartbeat,
          logs: newLogs,
        });
      } catch (_) {}
    }

    return res.status(200).json({
      success: true,
      instance_id: instance.instance_id,
      status: instance.status,
      role: instance.role,
      last_heartbeat: instance.last_heartbeat,
    });
  } catch (error) {
    console.error("[registerHeartbeat] Erro no heartbeat:", error);
    return res.status(500).json({ error: "Erro ao registrar heartbeat", message: error.message });
  }
};

export default registerHeartbeat;
