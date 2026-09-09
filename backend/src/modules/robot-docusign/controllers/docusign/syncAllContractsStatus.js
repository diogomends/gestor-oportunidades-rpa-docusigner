import { syncAllContractsStatus as syncAllContractsStatusService } from "../../seletorApiRobot/statusSyncScheduler.js";

/**
 * Executa sob demanda uma rodada de sincronização de status geral com o DocuSign.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const syncAllContractsStatus = async (req, res) => {
  try {
    const daysBack = req.query.daysBack ? parseInt(req.query.daysBack, 10) : 30;
    const result = await syncAllContractsStatusService({ daysBack });
    if (result.success === false) {
      return res.status(500).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("[robotDocusignController] Erro ao sincronizar status dos contratos:", error);
    return res.status(500).json({
      error: "Erro interno ao sincronizar status dos contratos",
      message: error.message,
    });
  }
};

export const syncAllStatuses = syncAllContractsStatus;
export default syncAllContractsStatus;
