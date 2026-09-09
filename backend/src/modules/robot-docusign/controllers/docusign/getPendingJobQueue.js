import RobotJob from "../../models/RobotJob.js";

/**
 * Retorna a fila de jobs pendentes ou em processamento no robô.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const getPendingJobQueue = async (req, res) => {
  try {
    const queue = await RobotJob.find({
      status: { $in: ["pending", "processing", "running", "retrying"] },
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: queue.length,
      queue,
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao obter fila de jobs:", error);
    return res.status(500).json({
      error: "Erro interno ao consultar a fila do robô",
      message: error.message,
    });
  }
};

export const getQueue = getPendingJobQueue;
export default getPendingJobQueue;
