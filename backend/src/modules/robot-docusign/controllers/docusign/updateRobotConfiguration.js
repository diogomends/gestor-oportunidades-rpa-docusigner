import { z } from "zod";
import SystemConfig from "../../../../models/SystemConfig.js";
import robotOrchestrator from "../../seletorApiRobot/index.js";
import { encryptText } from "../../../../utils/crypto.js";

/**
 * Esquema de validação Zod para atualização de configuração do robô.
 * @constant
 * @type {import("zod").ZodObject}
 */
const updateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(["robot", "api"]).optional(),
  operations: z
    .object({
      send: z.boolean().optional(),
      statusCheck: z.boolean().optional(),
      download: z.boolean().optional(),
      reports: z.boolean().optional(),
      resend: z.boolean().optional(),
    })
    .optional(),
  schedule: z
    .object({
      enabled: z.boolean().optional(),
      intervalMinutes: z.number().int().optional(),
      interval_minutes: z.number().int().optional(),
      startHour: z.string().optional(),
      endHour: z.string().optional(),
    })
    .optional(),
  limits: z
    .object({
      max_concurrent: z.number().int().min(1).optional(),
    })
    .optional(),
  retry: z
    .object({
      maxAttempts: z.number().int().min(1).optional(),
      baseDelayMs: z.number().int().min(100).optional(),
    })
    .optional(),
  credentials: z
    .object({
      email: z.string().email().optional().or(z.literal("")),
      password: z.string().optional(),
    })
    .optional(),
  token_notification_email: z
    .object({
      email: z.string().email().optional().or(z.literal("")),
      password: z.string().optional(),
      host: z.string().optional(),
      port: z.number().int().optional(),
      tls: z.boolean().optional(),
    })
    .optional(),
  mfa: z
    .object({
      maxWaitMs: z.number().int().min(1000).optional(),
      maxAgeMs: z.number().int().min(1000).optional(),
    })
    .optional(),
});

/**
 * Atualiza as configurações do Robô DocuSign (apenas Administradores).
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const updateRobotConfiguration = async (req, res) => {
  try {
    const parseResult = updateConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Dados de configuração inválidos",
        details: parseResult.error.errors,
      });
    }

    const currentConfig = await robotOrchestrator.getRobotConfig();

    const newConfigData = {
      ...currentConfig,
      ...parseResult.data,
      operations: {
        ...currentConfig.operations,
        ...(parseResult.data.operations || {}),
      },
      schedule: {
        ...currentConfig.schedule,
        ...(parseResult.data.schedule || {}),
      },
      limits: {
        ...currentConfig.limits,
        ...(parseResult.data.limits || {}),
      },
      retry: {
        ...currentConfig.retry,
        ...(parseResult.data.retry || {}),
      },
      credentials: {
        ...currentConfig.credentials,
        ...(parseResult.data.credentials || {}),
      },
      token_notification_email: {
        ...currentConfig.token_notification_email,
        ...(parseResult.data.token_notification_email || {}),
      },
      mfa: {
        ...currentConfig.mfa,
        ...(parseResult.data.mfa || {}),
      },
    };

    if (newConfigData.credentials?.password) {
      newConfigData.credentials.password = encryptText(newConfigData.credentials.password);
    }

    if (newConfigData.token_notification_email?.password) {
      newConfigData.token_notification_email.password = encryptText(newConfigData.token_notification_email.password);
    }

    const doc = await SystemConfig.findOneAndUpdate(
      { key: "robot_docusign" },
      {
        key: "robot_docusign",
        value: newConfigData,
        updatedBy: req.user?._id || req.user?.id,
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Configurações do Robô DocuSign atualizadas com sucesso",
      config: doc.value,
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao atualizar configuração:", error);
    return res.status(500).json({
      error: "Erro interno ao atualizar configuração do robô",
      message: error.message,
    });
  }
};

export const updateConfig = updateRobotConfiguration;
export default updateRobotConfiguration;
