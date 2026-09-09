import robotOrchestrator from "../../seletorApiRobot/index.js";

/**
 * Obtém as configurações atuais do Robô DocuSign.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const getRobotConfiguration = async (req, res) => {
  try {
    const config = await robotOrchestrator.getRobotConfig();
    return res.status(200).json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao obter configuração:", error);
    return res.status(500).json({
      error: "Erro interno ao obter configuração do robô",
      message: error.message,
    });
  }
};

export const getConfig = getRobotConfiguration;
export default getRobotConfiguration;
