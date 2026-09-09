import mongoose from "mongoose";
import { z } from "zod";
import Contract from "../../../../models/Contract.js";
import RobotJob from "../../models/RobotJob.js";
import RobotInstance from "../../models/RobotInstance.js";
import { emitProgress } from "../../seletorApiRobot/orchestratorEvents.js";
import { syncContractStatus } from "../../seletorApiRobot/contractSyncService.js";
import { mapEnvelopeStatusToContractStatus } from "../../seletorApiRobot/statusSyncScheduler.js";

/**
 * Zod Schema para atualização de status de job.
 * @constant
 * @type {import("zod").ZodObject<any>}
 */
const updateStatusSchema = z.object({
  instance_id: z.string().min(1),
  status: z.enum(["processing", "completed", "failed", "retrying"]),
  step: z
    .object({
      name: z.string(),
      status: z.enum(["pending", "running", "success", "failed"]).default("success"),
      duration: z.number().optional().default(0),
      error: z.string().optional().nullable(),
    })
    .optional(),
  envelopeId: z.string().optional().nullable(),
  signedDocPath: z.string().optional().nullable(),
  result: z.any().optional(),
  error: z.string().optional().nullable(),
  logs: z.array(z.string()).optional(),
});

/**
 * Regex para validação de UUID v4 de 36 caracteres (anti-fantasma).
 * @constant
 * @type {RegExp}
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reconcilia acordos em lote quando a ação for query_agreements.
 * @async
 * @param {Array<object>} rawEnvelopes - Lista de envelopes recebidos do robô.
 * @returns {Promise<void>}
 */
async function reconcileAgreementsBatch(rawEnvelopes) {
  try {
    const envelopesSchema = z.array(
      z.object({
        envelopeId: z.string().optional(),
        status: z.string().optional(),
        recipient: z.string().optional(),
      }).passthrough()
    );
    const parsed = envelopesSchema.safeParse(rawEnvelopes);
    if (!parsed.success || parsed.data.length === 0) return;

    const envelopes = parsed.data;
    const activeContracts = await Contract.find({ status: { $in: ["enviado", "gerado"] } }).lean();
    const normalizeString = (s = "") =>
      String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    for (const contract of activeContracts) {
      const cId = contract._id.toString();
      const repEmail = normalizeString(contract.client?.representante?.email || contract.client?.admin?.email);
      const repName = normalizeString(contract.client?.representante?.nome || contract.client?.admin?.nome);
      const storedEnvelopeId = contract.envelopeId || contract.docusign_envelope_id;
      const matched = envelopes.find((env) => {
        if (storedEnvelopeId && env.envelopeId && env.envelopeId === storedEnvelopeId) return true;
        const envRecipient = normalizeString(env.recipient);
        if (repEmail && envRecipient.includes(repEmail)) return true;
        if (repName && envRecipient.includes(repName)) return true;
        return false;
      });
      if (!matched) continue;
      const targetStatus = mapEnvelopeStatusToContractStatus(matched.status || "");
      if (!targetStatus) {
        if (matched.envelopeId && !storedEnvelopeId) {
          await Contract.findByIdAndUpdate(cId, { envelopeId: matched.envelopeId }).catch(() => {});
        }
        continue;
      }
      if (targetStatus !== contract.status || (matched.envelopeId && !storedEnvelopeId)) {
        await syncContractStatus(cId, targetStatus, { envelopeId: matched.envelopeId }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("[updateJobStatus] Falha na reconciliação batch query_agreements:", e.message);
  }
}

/**
 * Atualiza o status, steps e resultados de um job em execução pelo robô.
 *
 * @async
 * @param {import("express").Request} req - Requisição Express (params jobId, body status/step/result).
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<import("express").Response>} Job atualizado com status e jobId.
 */
export const updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        error: "ID de job inválido",
        message: "ID de job inválido",
      });
    }

    const parse = updateStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: "Dados de atualização inválidos",
        message: "Dados de atualização inválidos",
        details: parse.error.errors,
      });
    }

    const { instance_id, status, step, envelopeId, signedDocPath, result, error } = parse.data;
    const now = new Date();

    const existingJob = await RobotJob.findById(jobId).lean();
    if (!existingJob) {
      return res.status(404).json({
        error: "Job não encontrado.",
        message: "Job não encontrado.",
      });
    }

    let effectiveStatus = status;
    const action = existingJob.action || "send";
    const finalEnvelopeId = envelopeId || (result && typeof result === "object" ? result.envelopeId : null);

    // Anti-fantasma: send/resend completed exige envelopeId UUID v4 válido de 36 caracteres
    let antiPhantomFailed = false;
    if ((action === "send" || action === "resend") && status === "completed") {
      if (!finalEnvelopeId || typeof finalEnvelopeId !== "string" || !UUID_V4_REGEX.test(finalEnvelopeId.trim())) {
        console.warn(`[updateJobStatus] Anti-fantasma: Job ${jobId} tentou concluir '${action}' sem envelopeId UUID válido (${finalEnvelopeId}). Marcando como failed.`);
        effectiveStatus = "failed";
        antiPhantomFailed = true;
      }
    }

    const updateFields = {
      status: effectiveStatus,
      updatedAt: now,
    };

    if (finalEnvelopeId) updateFields.envelopeId = finalEnvelopeId;
    if (signedDocPath) updateFields.signedDocPath = signedDocPath;
    if (result !== undefined) updateFields.result = result;
    if (error) {
      updateFields.error = error;
      updateFields.lastError = error;
    } else if (antiPhantomFailed) {
      const phantomMsg = `Falha no envio do envelope: envelopeId UUID ausente ou inválido (${finalEnvelopeId || "nenhum"}) retornado pelo robô.`;
      updateFields.error = phantomMsg;
      updateFields.lastError = phantomMsg;
    }

    if (effectiveStatus === "completed" || effectiveStatus === "failed") {
      updateFields.completedAt = now;
      updateFields.locked_by = null;
      updateFields.lock_expires_at = null;
    }

    const updateOps = { $set: updateFields };
    if (step) {
      updateOps.$push = {
        steps: {
          name: step.name,
          status: antiPhantomFailed ? "failed" : (step.status || "success"),
          duration: step.duration || 0,
          error: antiPhantomFailed ? updateFields.error : (step.error || null),
          timestamp: now,
        },
      };
    }

    const updatedJob = await RobotJob.findByIdAndUpdate(jobId, updateOps, { new: true });
    if (!updatedJob) {
      return res.status(404).json({
        error: "Job não encontrado.",
        message: "Job não encontrado.",
      });
    }

    // Atualizar Contrato correspondente (skip para jobs globais sem contractId)
    const contractId = updatedJob.contract_id || updatedJob.contractId;
    if (updatedJob.action === "query_agreements" && effectiveStatus === "completed" && result?.envelopes) {
      await reconcileAgreementsBatch(result.envelopes);
    } else if (contractId) {
      if (effectiveStatus === "completed") {
        const targetStatus = updatedJob.action === "download" ? "assinado" : "enviado";
        const extraPayload = updatedJob.action === "download" ? {} : { envelopeId: finalEnvelopeId || updatedJob.envelopeId };

        // Atualiza contrato localmente de imediato no MongoDB
        await Contract.findByIdAndUpdate(contractId, {
          status: targetStatus,
          ...extraPayload,
        }).catch(() => {});

        // Sincroniza status com o CRM externo de forma desacoplada/assíncrona sem bloquear resposta HTTP
        syncContractStatus(contractId, targetStatus, extraPayload).catch((err) => {
          console.warn(`[updateJobStatus] Erro ao sincronizar status '${targetStatus}' no CRM externo para contrato ${contractId}:`, err?.message || err);
        });
      } else if (effectiveStatus === "failed") {
        const revertStatus =
          updatedJob.originalStatus && updatedJob.originalStatus !== "em_processamento_robot"
            ? updatedJob.originalStatus
            : "gerado";

        // Reverte contrato localmente de imediato no MongoDB
        await Contract.findByIdAndUpdate(contractId, { status: revertStatus }).catch(() => {});

        // Sincroniza reversão de status com o CRM externo de forma desacoplada/assíncrona sem bloquear resposta HTTP
        syncContractStatus(contractId, revertStatus).catch((err) => {
          console.warn(`[updateJobStatus] Erro ao sincronizar reversão de status '${revertStatus}' no CRM externo para contrato ${contractId}:`, err?.message || err);
        });
      }
    }

    // Atualizar métricas da instância
    const instanceUpdate = {
      last_heartbeat: now,
      status: effectiveStatus === "completed" || effectiveStatus === "failed" ? "idle" : "busy",
      current_job_id: effectiveStatus === "completed" || effectiveStatus === "failed" ? null : updatedJob._id,
    };

    if (effectiveStatus === "completed") {
      await RobotInstance.findOneAndUpdate(
        { instance_id },
        { $set: instanceUpdate, $inc: { jobs_processed_today: 1 } }
      );
    } else {
      await RobotInstance.findOneAndUpdate({ instance_id }, { $set: instanceUpdate });
    }

    emitProgress(updatedJob, parse.data.logs || []);

    return res.status(200).json({
      success: true,
      jobId: updatedJob._id,
      status: updatedJob.status,
    });
  } catch (error) {
    console.error("[updateJobStatus] Erro ao atualizar status do job:", error);
    return res.status(500).json({ error: "Erro ao atualizar job", message: error.message });
  }
};

export default updateJobStatus;
