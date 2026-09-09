import { z } from "zod";
import robotOrchestrator from "../../seletorApiRobot/index.js";

/**
 * Esquema de validação Zod para o disparo de jobs no Robô DocuSign.
 * @constant
 * @type {import("zod").ZodObject}
 */
const triggerSchema = z.object({
  contractId: z.string().optional(),
  contract_id: z.string().optional(),
  action: z.enum(["send", "status", "download", "resend", "reports", "query_agreements"]).default("send"),
  options: z.record(z.any()).optional().default({}),
});

/**
 * Dispara uma ação (send, status, download, resend, reports) no Robô DocuSign enfileirando de forma assíncrona.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const enqueueSingleJob = async (req, res) => {
  try {
    const parseResult = triggerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errMsg = "Dados de requisição inválidos";
      return res.status(400).json({
        error: errMsg,
        message: errMsg,
        details: parseResult.error.errors,
      });
    }

    const { contractId, contract_id, action, options } = parseResult.data;
    const targetContractId = contractId || contract_id;

    if (!targetContractId && !["reports", "query_agreements"].includes(action)) {
      const errMsg = "contractId ou contract_id é obrigatório para esta ação";
      return res.status(400).json({
        error: errMsg,
        message: errMsg,
      });
    }

    const mergedOptions = {
      ...options,
      userId: req.user?._id || req.user?.id,
    };

    const enqueueResult = await robotOrchestrator.enqueueJob(targetContractId, action, mergedOptions);

    return res.status(202).json({
      success: true,
      message: "Job enfileirado com sucesso",
      jobId: enqueueResult.jobId,
      status: "pending",
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao disparar job:", error);
    const errMsg = "Erro interno ao processar disparo do robô DocuSign";
    return res.status(500).json({
      error: errMsg,
      message: error.message || errMsg,
    });
  }
};

export const triggerJob = enqueueSingleJob;
export default enqueueSingleJob;
