import mongoose from "mongoose";
import RobotJob from "../../models/RobotJob.js";
import { robotEvents } from "../../seletorApiRobot/index.js";

/**
 * Transmite o progresso de um job em tempo real via Server-Sent Events (SSE).
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const streamJobProgressSSE = async (req, res) => {
  const { jobId } = req.params;
  if (!jobId) {
    return res.status(400).json({ error: "Parâmetro jobId é obrigatório" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  let pingInterval = null;
  let onProgress = null;

  const cleanup = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (onProgress) {
      robotEvents.off("job:progress", onProgress);
      onProgress = null;
    }
  };

  req.on("close", cleanup);

  try {
    const query = [];
    if (mongoose.Types.ObjectId.isValid(jobId)) {
      query.push({ _id: jobId }, { contract_id: jobId }, { contractId: jobId });
    } else {
      query.push({ contract_id: jobId }, { contractId: jobId });
    }

    let job;
    try {
      job = await RobotJob.findOne({ $or: query }).sort({ createdAt: -1 }).lean();
    } catch (err) {
      if (err.name !== "CastError") {
        throw err;
      }
    }

    let targetJobId = jobId;
    if (job) {
      targetJobId = job._id.toString();
      const payload = {
        jobId: targetJobId,
        status: job.status,
        steps: [...(job.steps || [])].reverse(),
        result: job.result || null,
        error: job.error || null,
        logs: job.logs || [],
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);

      if (["completed", "success", "failed"].includes(job.status)) {
        res.write(`event: done\ndata: {}\n\n`);
        cleanup();
        return res.end();
      }
    }

    onProgress = (data) => {
      if (data.jobId === targetJobId || data.jobId === jobId) {
        const out = {
          ...data,
          logs: data.logs || [],
          ...(data.steps ? { steps: [...data.steps].reverse() } : {}),
        };
        res.write(`data: ${JSON.stringify(out)}\n\n`);
        if (["completed", "success", "failed"].includes(data.status)) {
          res.write(`event: done\ndata: {}\n\n`);
          cleanup();
          res.end();
        }
      }
    };

    robotEvents.on("job:progress", onProgress);

    pingInterval = setInterval(() => {
      res.write(": ping\n\n");
    }, 15000);
  } catch (error) {
    console.error("[robotDocusignController] Erro no streaming SSE:", error);
    cleanup();
    res.end();
  }
};

export const streamJobProgress = streamJobProgressSSE;
export default streamJobProgressSSE;
