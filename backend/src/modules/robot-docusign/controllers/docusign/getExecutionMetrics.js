import mongoose from "mongoose";
import RobotJob from "../../models/RobotJob.js";

/**
 * Retorna as métricas agregadas de execuções do Robô DocuSign e contagem de instâncias por papel.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const getExecutionMetrics = async (req, res) => {
  try {
    // ponytail: evita buffering timeout quando mongo não está conectado (testes)
    let instancesByRoleAgg = [];
    if (mongoose.connection.readyState === 1) {
      try {
        const { RobotInstance } = await import("../../models/RobotInstance.js");
        instancesByRoleAgg = await RobotInstance.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]);
      } catch (_) {
        instancesByRoleAgg = [];
      }
    }
    const [
      totalJobs,
      completedJobs,
      failedJobs,
      retryingJobs,
      pendingJobs,
      byMode,
      byAction,
    ] = await Promise.all([
      RobotJob.countDocuments({}),
      RobotJob.countDocuments({ status: { $in: ["completed", "success"] } }),
      RobotJob.countDocuments({ status: "failed" }),
      RobotJob.countDocuments({ status: "retrying" }),
      RobotJob.countDocuments({ status: { $in: ["pending", "processing", "running"] } }),
      RobotJob.aggregate([{ $group: { _id: "$mode", count: { $sum: 1 } } }]),
      RobotJob.aggregate([{ $group: { _id: "$action", count: { $sum: 1 } } }]),
    ]);

    const successRate = totalJobs > 0 ? Number(((completedJobs / totalJobs) * 100).toFixed(2)) : 0;

    const modeMetrics = { robot: 0, api: 0 };
    byMode.forEach((item) => {
      if (item._id) modeMetrics[item._id] = item.count;
    });

    const actionMetrics = {};
    byAction.forEach((item) => {
      if (item._id) actionMetrics[item._id] = item.count;
    });

    const instancesByRole = { query: 0, update: 0, all: 0, total: 0 };
    (instancesByRoleAgg || []).forEach((item) => {
      if (item._id) instancesByRole[item._id] = item.count;
      instancesByRole.total += item.count;
    });

    return res.status(200).json({
      success: true,
      metrics: {
        totalJobs,
        completedJobs,
        failedJobs,
        retryingJobs,
        pendingJobs,
        successRate,
        byMode: modeMetrics,
        byAction: actionMetrics,
        instances_by_role: instancesByRole,
      },
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao obter métricas:", error);
    return res.status(500).json({
      error: "Erro interno ao obter métricas do robô",
      message: error.message,
    });
  }
};

export const getMetrics = getExecutionMetrics;
export default getExecutionMetrics;
