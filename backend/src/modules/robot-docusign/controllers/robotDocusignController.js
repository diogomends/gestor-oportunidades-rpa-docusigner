import mongoose from "mongoose";
import { z } from "zod";
import RobotJob from "../models/RobotJob.js";
import SystemConfig from "../../../models/SystemConfig.js";
import robotOrchestrator, { robotEvents } from "../seletorApiRobot/index.js";
import robotSession from "../browserrobot/robotSession.js";
import robotScheduler from "../seletorApiRobot/robotScheduler.js";
import { syncAllContractsStatus } from "../seletorApiRobot/statusSyncScheduler.js";
import { encryptText } from "../../../utils/crypto.js";

/**
 * Esquema de validação Zod para o disparo de jobs no Robô DocuSign.
 * @constant
 * @type {import("zod").ZodObject}
 */
const triggerSchema = z.object({
  contractId: z.string().optional(),
  contract_id: z.string().optional(),
  action: z.enum(["send", "status", "download", "resend", "reports", "query_agreements"]).default("send"),
  options: z.record(z.any()).optional().default({}),
});

/**
 * Esquema de validação Zod para disparo em lote (batch).
 * @constant
 * @type {import("zod").ZodObject}
 */
const triggerBatchSchema = z.object({
  contractIds: z.array(z.string()).min(1, "contractIds deve ser um array com pelo menos 1 ID"),
  action: z.enum(["send", "status", "download", "resend", "reports", "query_agreements"]).optional().default("send"),
  options: z.record(z.any()).optional().default({}),
});

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
 * Esquema de validação Zod para o teste de login.
 * @constant
 * @type {import("zod").ZodOptional}
 */
const testLoginSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().optional(),
    otpCode: z
      .string()
      .regex(/^\d{6}$/, "otpCode deve conter exatamente 6 dígitos numéricos")
      .optional(),
  })
  .optional();

/**
 * Dispara uma ação (send, status, download, resend, reports) no Robô DocuSign enfileirando de forma assíncrona.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const triggerJob = async (req, res) => {
  try {
    const parseResult = triggerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errMsg = "Dados de requisição inválidos";
      return res.status(400).json({
        error: errMsg,
        message: errMsg,
        details: parseResult.error.errors,
      });
    }

    const { contractId, contract_id, action, options } = parseResult.data;
    const targetContractId = contractId || contract_id;

    if (!targetContractId && !["reports", "query_agreements"].includes(action)) {
      const errMsg = "contractId ou contract_id é obrigatório para esta ação";
      return res.status(400).json({
        error: errMsg,
        message: errMsg,
      });
    }

    const mergedOptions = {
      ...options,
      userId: req.user?._id || req.user?.id,
    };

    const enqueueResult = await robotOrchestrator.enqueueJob(targetContractId, action, mergedOptions);

    return res.status(202).json({
      success: true,
      message: "Job enfileirado com sucesso",
      jobId: enqueueResult.jobId,
      status: "pending",
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao disparar job:", error);
    const errMsg = "Erro interno ao processar disparo do robô DocuSign";
    return res.status(500).json({
      error: errMsg,
      message: error.message || errMsg,
    });
  }
};

/**
 * Dispara ações em lote (batch) para múltiplos contratos no Robô DocuSign enfileirando de forma assíncrona.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const triggerBatch = async (req, res) => {
  try {
    const parseResult = triggerBatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errMsg = "Dados de requisição inválidos";
      return res.status(400).json({
        error: errMsg,
        message: errMsg,
        details: parseResult.error.errors,
      });
    }

    const { contractIds, action, options } = parseResult.data;
    const mergedOptions = {
      ...options,
      userId: req.user?._id || req.user?.id,
    };

    const createdJobIds = [];
    for (const contractId of contractIds) {
      try {
        const enq = await robotOrchestrator.enqueueJob(contractId, action, mergedOptions);
        if (enq?.jobId) createdJobIds.push(enq.jobId);
      } catch (err) {
        console.error(`[robotDocusignController] Erro ao enfileirar job em lote para ${contractId}:`, err);
      }
    }

    return res.status(202).json({
      success: true,
      message: "Jobs agendados em lote com sucesso",
      contractIds,
      jobIds: createdJobIds,
      status: "pending",
    });
  } catch (error) {
    console.error("[robotDocusignController] Erro ao disparar lote de jobs:", error);
    return res.status(500).json({
      error: "Erro interno ao processar disparo em lote do robô DocuSign",
      message: error.message,
    });
  }
};

/**
 * Retorna o status detalhado de um job específico pelo seu ID.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const getJobStatus = async (req, res) => {
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

/**
 * Lista os jobs executados pelo robô com suporte a filtros e paginação.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const listJobs = async (req, res) => {
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
        // According to instructions, we must treat gracefully and not cause CastError.
        // If it's not a valid ObjectId and the fields are ObjectId, querying them throws CastError.
        // We will query them as strings if possible, but to prevent CastError we can also just return empty.
        // Let's just push it and rely on the try-catch for safety, or return empty if we strictly validate.
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

/**
 * Retorna as métricas agregadas de execuções do Robô DocuSign.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const getMetrics = async (req, res) => {
  try {
    // ponytail: evita buffering timeout quando mongo não está conectado (testes)
    let instancesByRoleAgg = [];
    if (mongoose.connection.readyState === 1) {
      try {
        const { RobotInstance } = await import("../models/RobotInstance.js");
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

/**
 * Retorna os logs detalhados (steps e histórico de erros) de um job específico.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const getJobLogs = async (req, res) => {
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

/**
 * Obtém as configurações atuais do Robô DocuSign.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const getConfig = async (req, res) => {
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

/**
 * Atualiza as configurações do Robô DocuSign (apenas Administradores).
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const updateConfig = async (req, res) => {
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

/**
 * Testa o login no DocuSign via Playwright utilizando credenciais salvas ou fornecidas.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const testLogin = async (req, res) => {
  let browser = null;
  try {
    const parseResult = testLoginSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Credenciais de teste inválidas",
        details: parseResult.error.errors,
      });
    }

    let credentials = parseResult.data;
    if (!credentials?.email || !credentials?.password) {
      const config = await robotOrchestrator.getRobotConfig();
      credentials = config.credentials;
    }

    if (!credentials?.email || !credentials?.password) {
      return res.status(400).json({
        error: "Credenciais não fornecidas e nenhuma credencial salva encontrada",
      });
    }

    const { chromium } = await import("playwright");
    const launchOptions = {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext();
    const page = await context.newPage();

    const sessionResult = await robotSession.getOrRefreshSession(page, context, credentials);

    await browser.close();
    browser = null;

    return res.status(200).json({
      success: true,
      message: "Login no DocuSign testado e validado com sucesso",
      refreshed: sessionResult.refreshed,
      email: credentials.email,
    });
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch (cErr) {
        // Ignora erro de fechamento
      }
    }
    if (error?.code === "MFA_REQUIRED" || error?.code === "OTP_INVALID") {
      return res.status(401).json({ error: error.code, message: error.message });
    }
    console.error("[robotDocusignController] Erro ao testar login DocuSign:", error);
    return res.status(500).json({
      error: "Erro ao testar login no DocuSign",
      message: error.message,
    });
  }
};

/**
 * Retorna a fila de jobs pendentes ou em processamento no robô.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const getQueue = async (req, res) => {
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

/**
 * Executa o agendamento para processar até 1 contrato pendente na fila.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const processPending = async (req, res) => {
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

/**
 * Executa sob demanda uma rodada de sincronização de status geral com o DocuSign.
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const syncAllStatuses = async (req, res) => {
  try {
    const daysBack = req.query.daysBack ? parseInt(req.query.daysBack, 10) : 30;
    const result = await syncAllContractsStatus({ daysBack });
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

/**
 * Transmite o progresso de um job em tempo real via Server-Sent Events (SSE).
 *
 * @async
 * @param {import("express").Request} req - Objeto de requisição Express.
 * @param {import("express").Response} res - Objeto de resposta Express.
 * @returns {Promise<void>}
 */
export const streamJobProgress = async (req, res) => {
  const { jobId } = req.params;
  if (!jobId) {
    return res.status(400).json({ error: "Parâmetro jobId é obrigatório" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  let pingInterval = null;
  let onProgress = null;

  const cleanup = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (onProgress) {
      robotEvents.off("job:progress", onProgress);
      onProgress = null;
    }
  };

  req.on("close", cleanup);

  try {
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
      if (err.name !== "CastError") {
        throw err;
      }
    }

    let targetJobId = jobId;
    if (job) {
      targetJobId = job._id.toString();
      const payload = {
        jobId: targetJobId,
        status: job.status,
        steps: [...(job.steps || [])].reverse(),
        result: job.result || null,
        error: job.error || null,
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);

      if (["completed", "success", "failed"].includes(job.status)) {
        cleanup();
        return res.end();
      }
    }

    onProgress = (data) => {
      if (data.jobId === targetJobId || data.jobId === jobId) {
        const out = data.steps ? { ...data, steps: [...data.steps].reverse() } : data;
        res.write(`data: ${JSON.stringify(out)}\n\n`);
        if (["completed", "success", "failed"].includes(data.status)) {
          cleanup();
          res.end();
        }
      }
    };

    robotEvents.on("job:progress", onProgress);

    pingInterval = setInterval(() => {
      res.write(": ping\n\n");
    }, 15000);
  } catch (error) {
    console.error("[robotDocusignController] Erro no streaming SSE:", error);
    cleanup();
    res.end();
  }
};

/**
 * Exportação padrão dos handlers do controller DocuSign.
 * @type {{triggerJob: function, triggerBatch: function, getJobStatus: function, listJobs: function, getMetrics: function, getJobLogs: function, getConfig: function, updateConfig: function, testLogin: function, getQueue: function, processPending: function, syncAllStatuses: function, streamJobProgress: function}}
 */
export default {
  triggerJob,
  triggerBatch,
  getJobStatus,
  listJobs,
  getMetrics,
  getJobLogs,
  getConfig,
  updateConfig,
  testLogin,
  getQueue,
  processPending,
  syncAllStatuses,
  streamJobProgress,
};
