import mongoose from "mongoose";
import RobotJob from "../../models/RobotJob.js";

/**
 * Lista os jobs executados pelo robô com suporte a filtros e paginação.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const listFilteredJobs = async (req, res) => {
  try {
    const {
      status,
      action,
      mode,
      contractId,
      contract_id,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (action) query.action = action;
    if (mode) query.mode = mode;
    if (contractId || contract_id) {
      const cId = contractId || contract_id;
      if (mongoose.Types.ObjectId.isValid(cId)) {
        query.$or = [{ contractId: cId }, { contract_id: cId }];
      } else {
        query.$or = [{ contractId: cId }, { contract_id: cId }];
      }
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let jobs = [];
    let total = 0;
    try {
      [jobs, total] = await Promise.all([
        RobotJob.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        RobotJob.countDocuments(query),
      ]);
    } catch (err) {
      if (err.name === "CastError") {
        return res.status(200).json({
          success: true,
          jobs: [],
          total: 0,
          page: pageNum,
          limit: limitNum,
          pages: 1,
        });
      }
      throw err;
    }

    return res.status(200).json({
      success: true,
      jobs,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao listar jobs:", error);
    return res.status(500).json({
      error: "Erro interno ao listar jobs",
      message: error.message,
    });
  }
};

export const listJobs = listFilteredJobs;
export default listFilteredJobs;
