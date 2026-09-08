import SystemConfig from "../../../../models/SystemConfig.js";
import robotOrchestrator from "../../services/robotOrchestrator.js";
import { isTimeAccessAllowed } from "../../../../utils/timeRestrictionService.js";

/**
 * Obtém as configurações de agendamento, horário e limites do sistema para a instância do robô.
 *
 * @async
 * @param {import("express").Request} req - Requisição Express.
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<import("express").Response>} JSON com enabled, mode, schedule, operations e credenciais.
 */
export const getInstanceConfig = async (req, res) => {
  try {
    const robotConfig = await robotOrchestrator.getRobotConfig();
    const accessConfig = await SystemConfig.findOne({ key: "access_restriction" }).lean();

    const isAllowedNow = accessConfig?.value?.enabled
      ? isTimeAccessAllowed(accessConfig.value)
      : true;

    return res.status(200).json({
      success: true,
      enabled: robotConfig.mode === "robot",
      mode: robotConfig.mode,
      operations: robotConfig.operations || {
        send: true,
        statusCheck: true,
        download: true,
        reports: true,
        resend: true,
      },
      isAllowedNow,
      schedule: {
        interval_seconds: 15,
        access_restriction: accessConfig?.value || null,
      },
      credentials: {
        email: robotConfig.credentials?.email || "",
        password: robotConfig.credentials?.password || "",
      },
      token_notification_email: {
        email: robotConfig.token_notification_email?.email || "",
        password: robotConfig.token_notification_email?.password || "",
        host: robotConfig.token_notification_email?.host || "unitynordeste.com.br",
        port: Number(robotConfig.token_notification_email?.port) || 993,
        tls: robotConfig.token_notification_email?.tls !== false,
      },
      mfa: robotConfig.mfa || { maxWaitMs: 90000, maxAgeMs: 600000 },
      limits: robotConfig.limits || { max_concurrent: 3 },
      retry: robotConfig.retry || { maxAttempts: 3, baseDelayMs: 2000 },
    });
  } catch (error) {
    console.error("[getInstanceConfig] Erro ao buscar config:", error);
    return res.status(500).json({ error: "Erro ao buscar configurações", message: error.message });
  }
};

export default getInstanceConfig;
