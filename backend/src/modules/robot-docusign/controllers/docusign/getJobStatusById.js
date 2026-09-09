import mongoose from "mongoose";
import RobotJob from "../../models/RobotJob.js";

/**
 * Retorna o status detalhado de um job específico pelo seu ID ou ID do contrato.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const getJobStatusById = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ error: "Parâmetro jobId é obrigatório" });
    }

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
      if (err.name === "CastError") {
        return res.status(404).json({ error: "Job não encontrado" });
      }
      throw err;
    }

    if (!job) {
      return res.status(404).json({ error: "Job não encontrado" });
    }

    return res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao buscar status do job:", error);
    return res.status(500).json({
      error: "Erro interno ao buscar status do job",
      message: error.message,
    });
  }
};

export const getJobStatus = getJobStatusById;
export default getJobStatusById;
