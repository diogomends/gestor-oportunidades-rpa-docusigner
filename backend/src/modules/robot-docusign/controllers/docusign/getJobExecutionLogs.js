import RobotJob from "../../models/RobotJob.js";

/**
 * Retorna os logs detalhados (steps em ordem reversa e histórico de erros) de um job específico.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const getJobExecutionLogs = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ error: "Parâmetro jobId é obrigatório" });
    }

    let job;
    try {
      job = await RobotJob.findById(jobId)
        .select(
          "steps error lastError status action mode contractId contract_id createdAt completedAt attempts max_attempts"
        )
        .lean();
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
      jobId: job._id,
      status: job.status,
      action: job.action,
      mode: job.mode,
      attempts: job.attempts,
      max_attempts: job.max_attempts,
      error: job.error || job.lastError || null,
      steps: [...(job.steps || [])].reverse(),
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao obter logs do job:", error);
    return res.status(500).json({
      error: "Erro interno ao obter logs do job",
      message: error.message,
    });
  }
};

export const getJobLogs = getJobExecutionLogs;
export default getJobExecutionLogs;
