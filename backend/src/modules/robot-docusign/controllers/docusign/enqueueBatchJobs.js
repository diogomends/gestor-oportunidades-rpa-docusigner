import { z } from "zod";
import robotOrchestrator from "../../seletorApiRobot/index.js";

/**
 * Esquema de validação Zod para disparo em lote (batch).
 * @constant
 * @type {import("zod").ZodObject}
 */
const triggerBatchSchema = z.object({
  contractIds: z.array(z.string()).min(1, "contractIds deve ser um array com pelo menos 1 ID"),
  action: z.enum(["send", "status", "download", "resend", "reports", "query_agreements"]).optional().default("send"),
  options: z.record(z.any()).optional().default({}),
});

/**
 * Dispara ações em lote (batch) para múltiplos contratos no Robô DocuSign enfileirando de forma assíncrona.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const enqueueBatchJobs = async (req, res) => {
  try {
    const parseResult = triggerBatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errMsg = "Dados de requisição inválidos";
      return res.status(400).json({
        error: errMsg,
        message: errMsg,
        details: parseResult.error.errors,
      });
    }

    const { contractIds, action, options } = parseResult.data;
    const mergedOptions = {
      ...options,
      userId: req.user?._id || req.user?.id,
    };

    const createdJobIds = [];
    for (const contractId of contractIds) {
      try {
        const enq = await robotOrchestrator.enqueueJob(contractId, action, mergedOptions);
        if (enq?.jobId) createdJobIds.push(enq.jobId);
      } catch (err) {
        console.error(`[robotDocusignController] Erro ao enfileirar job em lote para ${contractId}:`, err);
      }
    }

    return res.status(202).json({
      success: true,
      message: "Jobs agendados em lote com sucesso",
      contractIds,
      jobIds: createdJobIds,
      status: "pending",
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao disparar lote de jobs:", error);
    return res.status(500).json({
      error: "Erro interno ao processar disparo em lote do robô DocuSign",
      message: error.message,
    });
  }
};

export const triggerBatch = enqueueBatchJobs;
export default enqueueBatchJobs;
