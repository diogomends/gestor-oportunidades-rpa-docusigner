import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../../../models/User.js";
import Contract from "../../../models/Contract.js";
import SystemConfig from "../../../models/SystemConfig.js";
import RobotJob from "../models/RobotJob.js";
import RobotInstance from "../models/RobotInstance.js";
import robotOrchestrator from "../services/robotOrchestrator.js";
import { isTimeAccessAllowed } from "../../../utils/timeRestrictionService.js";
import { getAclDb } from "../../../config/database.js";
import { GERADO_ELIGIBLE_FILTER, isEligibleForSend, hasPdf } from "../utils/contractEligibility.js";

/**
 * Zod Schema para autenticação da instância do robô via email/senha.
 */
const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  instance_id: z.string().min(1),
  machine_info: z
    .object({
      hostname: z.string().optional(),
      platform: z.string().optional(),
      arch: z.string().optional(),
      app_version: z.string().optional(),
    })
    .optional(),
});

/**
 * Zod Schema para busca de próximo job.
 */
const nextJobSchema = z.object({
  instance_id: z.string().min(1),
});

/**
 * Zod Schema para atualização de status de job.
 */
const updateStatusSchema = z.object({
  instance_id: z.string().min(1),
  status: z.enum(["processing", "completed", "failed", "retrying"]),
  step: z
    .object({
      name: z.string(),
      status: z.enum(["pending", "running", "success", "failed"]).default("success"),
      duration: z.number().optional().default(0),
      error: z.string().optional(),
    })
    .optional(),
  envelopeId: z.string().optional(),
  signedDocPath: z.string().optional(),
  result: z.any().optional(),
  error: z.string().optional(),
});

/**
 * Zod Schema para heartbeat.
 */
const heartbeatSchema = z.object({
  instance_id: z.string().min(1),
  status: z.enum(["active", "idle", "busy", "offline"]).default("idle"),
  current_job_id: z.string().optional().nullable(),
  jobs_processed_today: z.number().optional(),
  machine_info: z.record(z.any()).optional(),
});

/**
 * Realiza autenticação da instância do robô e retorna token JWT.
 * Suporta autenticação por API Key (header X-Robot-Key ou campo robot_key) ou credenciais de usuário (email/senha).
 *
 * @param {import("express").Request} req - Objeto de requisição Express
 * @param {import("express").Response} res - Objeto de resposta Express
 * @returns {Promise<import("express").Response>} Resposta JSON com token JWT e dados da sessão
 */
export const authenticateInstance = async (req, res) => {
  try {
    const rawRobotKey = req.headers["x-robot-key"] || req.body?.robot_key;

    // 1. Fluxo de autenticação por API Key (Robot Profile / Service Account)
    if (rawRobotKey && typeof rawRobotKey === "string" && rawRobotKey.trim().length > 0) {
      const robotKey = rawRobotKey.trim();
      const keyHash = crypto.createHash("sha256").update(robotKey).digest("hex");
      const aclDb = getAclDb();

      const apiKeyDoc = await aclDb.collection("robot_api_keys").findOne({
        key_hash: keyHash,
        active: true,
      });

      if (!apiKeyDoc) {
        return res.status(401).json({ error: "Chave de robô (API Key) inválida ou inativa." });
      }

      // Carregar usuário criador da chave para herdar permissões/cargo
      const user = await User.findById(apiKeyDoc.created_by);
      if (!user) {
        return res.status(401).json({ error: "Usuário associado à chave não encontrado." });
      }

      if (user.ativo === false) {
        return res.status(403).json({ error: "Usuário associado à chave está inativo." });
      }

      const instance_id = req.body?.instance_id || `robot-${apiKeyDoc.key_prefix || "profile"}`;
      const machine_info = req.body?.machine_info || {};

      const token = jwt.sign(
        {
          id: user._id,
          role: user.cargo,
          cargo: user.cargo,
          instance_id,
          isRobot: true,
          requestedBy: user._id,
        },
        process.env.JWT_SECRET || "default_jwt_secret_dev",
        { expiresIn: "30d" }
      );

      // Registra ou atualiza a instância
      await RobotInstance.findOneAndUpdate(
        { instance_id },
        {
          $set: {
            instance_id,
            status: "active",
            last_heartbeat: new Date(),
            machine_info,
          },
        },
        { upsert: true, new: true }
      );

      // Atualiza timestamp e IP do último uso da chave
      await aclDb.collection("robot_api_keys").updateOne(
        { _id: apiKeyDoc._id },
        {
          $set: {
            last_used_at: new Date(),
            last_used_ip: req.ip || req.socket?.remoteAddress || null,
          },
        }
      );

      return res.status(200).json({
        success: true,
        token,
        instance_id,
        isRobot: true,
        user: {
          id: user._id,
          nome: user.nome,
          email: user.email,
          cargo: user.cargo,
        },
      });
    }

    // 2. Fluxo legado: Autenticação via Email e Senha
    const parse = authSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: "Dados de autenticação inválidos",
        details: parse.error.errors,
      });
    }

    const { email, password, instance_id, machine_info } = parse.data;

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    if (user.ativo === false) {
      return res.status(403).json({ error: "Usuário inativo." });
    }

    const token = jwt.sign(
      { id: user._id, role: user.cargo, instance_id },
      process.env.JWT_SECRET || "default_jwt_secret_dev",
      { expiresIn: "30d" }
    );

    // Registra ou atualiza a instância
    await RobotInstance.findOneAndUpdate(
      { instance_id },
      {
        $set: {
          instance_id,
          status: "active",
          last_heartbeat: new Date(),
          machine_info: machine_info || {},
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      token,
      instance_id,
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
      },
    });
  } catch (error) {
    console.error("[robotInstanceController] Erro na autenticação:", error);
    return res.status(500).json({ error: "Erro interno no login do robô", message: error.message });
  }
};

/**
 * Obtém as configurações de agendamento, horário e limites do sistema.
 * @param {import("express").Request} req - Requisição Express.
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<import("express").Response>} JSON com enabled, mode, schedule e credenciais.
 */
export const getInstanceConfig = async (req, res) => {
  try {
    const robotConfig = await robotOrchestrator.getRobotConfig();
    const accessConfig = await SystemConfig.findOne({ key: "access_restriction" })?.lean();

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
    console.error("[robotInstanceController] Erro ao buscar config:", error);
    return res.status(500).json({ error: "Erro ao buscar configurações", message: error.message });
  }
};

/**
 * Busca de forma atômica o próximo job da fila para processamento.
 * @param {import("express").Request} req - Requisição Express (query/body instance_id).
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<import("express").Response>} Payload do job ou flag hasJob:false.
 */
export const getNextJob = async (req, res) => {
  try {
    const instance_id = req.query.instance_id || req.body?.instance_id || req.user?.instance_id || "standalone-robot";
    const now = new Date();
    const lockExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos de lock

    // 1. Validar se o robô está ativo
    const config = await robotOrchestrator.getRobotConfig();
    if (config.mode !== "robot") {
      return res.status(200).json({
        hasJob: false,
        reason: "robot_disabled",
        message: "Robô desativado ou operando em modo API.",
      });
    }

    // 2. Validar horário de funcionamento
    const accessConfig = await SystemConfig.findOne({ key: "access_restriction" })?.lean();
    if (accessConfig?.value?.enabled && !isTimeAccessAllowed(accessConfig.value)) {
      return res.status(200).json({
        hasJob: false,
        reason: "outside_working_hours",
        message: "Fora do horário de expediente permitido.",
      });
    }

    // 3. Limpar/recuperar jobs com lock expirado para evitar deadlock
    await RobotJob.updateMany(
      {
        status: "processing",
        lock_expires_at: { $lt: now },
      },
      {
        $set: {
          status: "pending",
          locked_by: null,
          lock_expires_at: null,
        },
      }
    );

    // 4. Buscar e travar atomicamente um job pendente existente
    let job = await RobotJob.findOneAndUpdate(
      {
        $and: [
          {
            $or: [
              { status: "pending" },
              {
                status: "retrying",
                $or: [
                  { next_retry_at: { $lte: now } },
                  { next_retry_at: { $exists: false } },
                  { next_retry_at: null },
                ],
              },
            ],
          },
          {
            $or: [
              { locked_by: null },
              { lock_expires_at: null },
              { lock_expires_at: { $lt: now } },
            ],
          },
        ],
      },
      {
        $set: {
          status: "processing",
          locked_by: instance_id,
          lock_expires_at: lockExpiresAt,
          startedAt: now,
        },
        $inc: { attempts: 1, retryCount: 1 },
      },
      { new: true, sort: { createdAt: 1 } }
    );

    // 5. Se não houver job na fila, verificar se há Contrato elegível (não-rascunho) e documento PDF anexado (se envio permitido)
    if (!job && config.operations?.send !== false) {
      const contract = await Contract.findOneAndUpdate(
        GERADO_ELIGIBLE_FILTER,
        { $set: { status: "em_processamento_robot" } },
        { sort: { createdAt: 1 } }
      );

      if (contract) {
        job = await RobotJob.create({
          contract_id: contract._id,
          contractId: contract._id,
          action: "send",
          status: "processing",
          mode: "robot",
          robot_mode: true,
          locked_by: instance_id,
          lock_expires_at: lockExpiresAt,
          startedAt: now,
          attempts: 1,
          retryCount: 1,
          steps: [{ name: "init", status: "success", timestamp: now, duration: 0 }],
        });
      }
    }

    if (!job) {
      return res.status(200).json({
        hasJob: false,
        reason: "no_pending_jobs",
        message: "Nenhum job pendente no momento.",
      });
    }

    // 6. Carregar os dados completos do Contrato associado
    const contractId = job.contract_id || job.contractId;
    const contract = await Contract.findById(contractId).lean();

    // Extrair caminho do primeiro documento disponível (usa helper hasPdf)
    let pdfUrl = null;
    if (hasPdf(contract)) {
      pdfUrl = `/api/robot-docusign/instance/contracts/${contractId}/pdf`;
    }

    // Se a ação for 'send' e não houver documento PDF ou e-mail válido, cancela o lock e pula o job
    // Reverte contrato de em_processamento_robot para seu status original ou 'gerado' para permitir retry
    if (job.action === "send" && !isEligibleForSend(contract)) {
      await RobotJob.findByIdAndUpdate(job._id, {
        status: "failed",
        error: "Contrato sem documento PDF anexado ou sem e-mail do destinatário.",
        completedAt: now,
        locked_by: null,
        lock_expires_at: null,
      });

      // ponytail: reverte contrato preso em em_processamento_robot para status original ou 'gerado'
      if (contractId) {
        const revertStatus = (contract?.status && contract.status !== "em_processamento_robot") ? contract.status : "gerado";
        await Contract.findByIdAndUpdate(contractId, { status: revertStatus }).catch(() => {});
      }

      console.warn(`[robotInstanceController] Job ${job._id} ignorado por falta de PDF ou e-mail (contrato ${contractId}).`);

      return res.status(200).json({
        hasJob: false,
        reason: "contract_missing_pdf_or_email",
        message: `Job ${job._id} ignorado por falta de PDF ou e-mail de destinatário no contrato.`,
      });
    }

    const recipientName =
      contract?.client?.representante?.nome ||
      contract?.signer?.name ||
      contract?.name ||
      contract?.clientName ||
      "Representante Legal";

    const recipientEmail =
      contract?.client?.representante?.email ||
      contract?.signer?.email ||
      contract?.email ||
      contract?.clientEmail ||
      "";

    const payload = {
      hasJob: true,
      jobId: job._id.toString(),
      contractId: contractId?.toString(),
      action: job.action || "send",
      envelopeId: job.envelopeId || contract?.envelopeId || null,
      recipientName,
      recipientEmail,
      subject: `Contrato de Adesão - ${contract?.client?.razaoSocial || "Cliente"}`,
      message: "Prezado cliente, segue o contrato para assinatura eletrônica.",
      pdfUrl,
      credentials: {
        ...(config.credentials || {}),
        token_notification_email: config.token_notification_email,
        mfa: config.mfa,
      },
      token_notification_email: config.token_notification_email,
      mfa: config.mfa || { maxWaitMs: 90000, maxAgeMs: 600000 },
    };

    // Atualiza status da instância
    await RobotInstance.findOneAndUpdate(
      { instance_id },
      { $set: { status: "busy", current_job_id: job._id, last_heartbeat: now } }
    );

    return res.status(200).json(payload);
  } catch (error) {
    console.error("[robotInstanceController] Erro ao buscar próximo job:", error);
    return res.status(500).json({ error: "Erro ao buscar próximo job", message: error.message });
  }
};

/**
 * Atualiza o status e logs de um job em execução.
 * @param {import("express").Request} req - Requisição Express (params jobId, body status/step).
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<import("express").Response>} Job atualizado.
 */
export const updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const parse = updateStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: "Dados de atualização inválidos",
        details: parse.error.errors,
      });
    }

    const { instance_id, status, step, envelopeId, signedDocPath, result, error } = parse.data;
    const now = new Date();

    const updateFields = {
      status,
      updatedAt: now,
    };

    if (envelopeId) updateFields.envelopeId = envelopeId;
    if (signedDocPath) updateFields.signedDocPath = signedDocPath;
    if (result !== undefined) updateFields.result = result;
    if (error) {
      updateFields.error = error;
      updateFields.lastError = error;
    }

    if (status === "completed" || status === "failed") {
      updateFields.completedAt = now;
      updateFields.locked_by = null;
      updateFields.lock_expires_at = null;
    }

    const updateOps = { $set: updateFields };
    if (step) {
      updateOps.$push = {
        steps: {
          name: step.name,
          status: step.status || "success",
          duration: step.duration || 0,
          error: step.error || null,
          timestamp: now,
        },
      };
    }

    const updatedJob = await RobotJob.findByIdAndUpdate(jobId, updateOps, { new: true });
    if (!updatedJob) {
      return res.status(404).json({ error: "Job não encontrado." });
    }

    // Atualizar Contrato correspondente
    const contractId = updatedJob.contract_id || updatedJob.contractId;
    if (contractId) {
      if (status === "completed") {
        if (updatedJob.action === "download") {
          await Contract.findByIdAndUpdate(contractId, { status: "assinado" });
        } else {
          await Contract.findByIdAndUpdate(contractId, {
            status: "enviado",
            envelopeId: envelopeId || updatedJob.envelopeId,
          });
        }
      } else if (status === "failed") {
        await Contract.findByIdAndUpdate(contractId, { status: "gerado" });
      }
    }

    // Atualizar métricas da instância
    const instanceUpdate = {
      last_heartbeat: now,
      status: status === "completed" || status === "failed" ? "idle" : "busy",
      current_job_id: status === "completed" || status === "failed" ? null : updatedJob._id,
    };

    if (status === "completed") {
      await RobotInstance.findOneAndUpdate(
        { instance_id },
        { $set: instanceUpdate, $inc: { jobs_processed_today: 1 } }
      );
    } else {
      await RobotInstance.findOneAndUpdate({ instance_id }, { $set: instanceUpdate });
    }

    return res.status(200).json({
      success: true,
      jobId: updatedJob._id,
      status: updatedJob.status,
    });
  } catch (error) {
    console.error("[robotInstanceController] Erro ao atualizar status do job:", error);
    return res.status(500).json({ error: "Erro ao atualizar job", message: error.message });
  }
};

/**
 * Registra o heartbeat periódico da instância standalone.
 * @param {import("express").Request} req - Requisição Express (body instance_id, status).
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<import("express").Response>} Instância com last_heartbeat.
 */
export const registerHeartbeat = async (req, res) => {
  try {
    const parse = heartbeatSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: "Dados de heartbeat inválidos",
        details: parse.error.errors,
      });
    }

    const { instance_id, status, current_job_id, jobs_processed_today, machine_info } = parse.data;

    const updateDoc = {
      status,
      last_heartbeat: new Date(),
    };

    if (current_job_id !== undefined) updateDoc.current_job_id = current_job_id;
    if (jobs_processed_today !== undefined) updateDoc.jobs_processed_today = jobs_processed_today;
    if (machine_info) updateDoc.machine_info = machine_info;

    const instance = await RobotInstance.findOneAndUpdate(
      { instance_id },
      { $set: updateDoc },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      instance_id: instance.instance_id,
      status: instance.status,
      last_heartbeat: instance.last_heartbeat,
    });
  } catch (error) {
    console.error("[robotInstanceController] Erro no heartbeat:", error);
    return res.status(500).json({ error: "Erro ao registrar heartbeat", message: error.message });
  }
};

/**
 * Faz stream do arquivo PDF do contrato para o robô anexar na DocuSign.
 * @param {import("express").Request} req - Requisição Express (params contractId).
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<void>} Pipe do PDF ou JSON de erro.
 */
export const downloadContractPdf = async (req, res) => {
  try {
    const { contractId } = req.params;
    const contract = await Contract.findById(contractId).lean();
    if (!contract) {
      return res.status(404).json({ error: "Contrato não encontrado." });
    }

    if (!contract.documents || contract.documents.length === 0) {
      return res.status(404).json({ error: "Nenhum documento encontrado para este contrato." });
    }

    const doc = contract.documents.find((d) => d.originalUrl) || contract.documents[0];
    const originalUrl = doc.originalUrl || "";

    // Localizar arquivo no disco
    const filePath = path.resolve(process.cwd(), originalUrl.startsWith("/") ? originalUrl.slice(1) : originalUrl);

    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="contrato_${contractId}.pdf"`);
      return fs.createReadStream(filePath).pipe(res);
    }

    return res.status(404).json({ error: "Arquivo PDF não encontrado no disco do servidor." });
  } catch (error) {
    console.error("[robotInstanceController] Erro ao servir PDF:", error);
    return res.status(500).json({ error: "Erro ao baixar PDF", message: error.message });
  }
};

/**
 * Lista todas as instâncias registradas do robô.
 * @param {import("express").Request} req - Requisição Express.
 * @param {import("express").Response} res - Resposta Express.
 * @returns {Promise<import("express").Response>} Lista de instâncias.
 */
export const getAllInstances = async (req, res) => {
  try {
    const instances = await RobotInstance.find({})
      .sort({ last_heartbeat: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      instances: instances.map((inst) => ({
        instance_id: inst.instance_id,
        status: inst.status,
        last_heartbeat: inst.last_heartbeat,
        current_job_id: inst.current_job_id || null,
        jobs_processed_today: inst.jobs_processed_today || 0,
        machine_info: inst.machine_info || {},
        createdAt: inst.createdAt,
        updatedAt: inst.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[robotInstanceController] Erro ao listar instâncias:", error);
    return res.status(500).json({ error: "Erro ao listar instâncias" });
  }
};

/**
 * Exportação padrão dos handlers de instância do robô.
 * @type {{authenticateInstance: function, getInstanceConfig: function, getNextJob: function, updateJobStatus: function, registerHeartbeat: function, downloadContractPdf: function, getAllInstances: function}}
 */
export default {
  authenticateInstance,
  getInstanceConfig,
  getNextJob,
  updateJobStatus,
  registerHeartbeat,
  downloadContractPdf,
  getAllInstances,
};
