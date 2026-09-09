import robotScheduler from "../../seletorApiRobot/robotScheduler.js";

/**
 * Executa o agendamento para processar até 1 contrato pendente na fila.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const processPendingJobs = async (req, res) => {
  try {
    const result = await robotScheduler.processPendingJobs({
      triggeredByUserId: req.user?._id || req.user?.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[robotDocusignController] Erro ao processar jobs pendentes via cron/agendamento:", error);
    return res.status(500).json({
      error: "Erro interno ao executar agendamento de contratos pendentes",
      message: error.message,
    });
  }
};

export const processPending = processPendingJobs;
export default processPendingJobs;
