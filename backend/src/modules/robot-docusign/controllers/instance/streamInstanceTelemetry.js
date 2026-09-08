import RobotInstance from "../../models/RobotInstance.js";
import { robotEvents } from "../../seletorApiRobot/orchestratorEvents.js";
import { getLogs } from "../../utils/telemetryBuffer.js";

/**
 * Stream SSE de telemetria ociosa e logs em tempo real da instância (consumidor primário do painel de controle).
 *
 * @async
 * @param {import("express").Request} req - Requisição Express (params instanceId).
 * @param {import("express").Response} res - Resposta Express (text/event-stream).
 * @returns {Promise<void>}
 */
export const streamInstanceTelemetry = async (req, res) => {
  const { instanceId } = req.params;
  if (!instanceId) {
    return res.status(400).json({
      error: "Parâmetro instanceId é obrigatório",
      message: "Parâmetro instanceId é obrigatório",
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  let pingInterval = null;
  let onTelemetry = null;
  const cleanup = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (onTelemetry) {
      robotEvents.off("instance:telemetry", onTelemetry);
      onTelemetry = null;
    }
  };
  req.on("close", cleanup);
  res.on("close", cleanup);

  try {
    const inst = await RobotInstance.findOne({ instance_id: instanceId }).lean().catch(() => null);

    // Guarda de desconexão prematura antes de registrar listeners persistentes
    if (req.destroyed || req.closed || res.writableEnded || res.destroyed) {
      cleanup();
      return;
    }

    res.write(`data: ${JSON.stringify({
      instanceId,
      status: inst?.status || "offline",
      lastHeartbeat: inst?.last_heartbeat || null,
      logs: getLogs(instanceId),
    })}\n\n`);

    onTelemetry = (data) => {
      if (data.instanceId === instanceId && !res.writableEnded && !res.destroyed) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };
    robotEvents.on("instance:telemetry", onTelemetry);
    pingInterval = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) {
        res.write(": ping\n\n");
      }
    }, 15000);
  } catch (error) {
    console.error("[streamInstanceTelemetry] Erro no stream de telemetria:", error);
    cleanup();
    if (!res.writableEnded && !res.destroyed) {
      res.end();
    }
  }
};

export default streamInstanceTelemetry;
