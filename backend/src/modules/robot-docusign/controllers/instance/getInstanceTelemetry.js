import RobotInstance from "../../models/RobotInstance.js";
import { getLogs } from "../../utils/telemetryBuffer.js";

/**
 * Retorna a telemetria ociosa e histórico de logs em memória de uma instância (fallback polling do SSE).
 *
 * @async
 * @param {import("express").Request} req - Requisição Express (params instanceId).
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<import("express").Response>} Objeto com status, lastHeartbeat e array de logs.
 */
export const getInstanceTelemetry = async (req, res) => {
  try {
    const { instanceId } = req.params;
    if (!instanceId) {
      return res.status(400).json({
        error: "Parâmetro instanceId é obrigatório",
        message: "Parâmetro instanceId é obrigatório",
      });
    }
    const inst = await RobotInstance.findOne({ instance_id: instanceId }).lean();
    if (!inst) {
      return res.status(404).json({
        error: "Instância não encontrada.",
        message: "Instância não encontrada.",
      });
    }
    const instanceLogs = getLogs(instanceId);
    return res.status(200).json({
      instanceId: inst.instance_id,
      status: inst.status,
      lastHeartbeat: inst.last_heartbeat,
      logs: instanceLogs,
      telemetryLogs: instanceLogs,
    });
  } catch (error) {
    console.error("[getInstanceTelemetry] Erro ao buscar telemetria:", error);
    return res.status(500).json({ error: "Erro ao buscar telemetria", message: error.message });
  }
};

export default getInstanceTelemetry;
