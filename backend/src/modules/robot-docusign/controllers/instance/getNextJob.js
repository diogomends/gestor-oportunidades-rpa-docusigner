import Contract from "../../../../models/Contract.js";
import SystemConfig from "../../../../models/SystemConfig.js";
import RobotJob from "../../models/RobotJob.js";
import RobotInstance from "../../models/RobotInstance.js";
import robotOrchestrator from "../../services/robotOrchestrator.js";
import { emitProgress } from "../../seletorApiRobot/orchestratorEvents.js";
import { isTimeAccessAllowed } from "../../../../utils/timeRestrictionService.js";
import { isEligibleForSend, hasPdf } from "../../utils/contractEligibility.js";
import { getAllowedActions, normalizeRole } from "../../utils/roleActions.js";

/**
 * Extrai e deduplica a lista de signatários de um contrato (Representante Legal + Responsáveis pela Portabilidade).
 * @param {object|null} contract - Documento do contrato.
 * @returns {{recipientName: string, recipientEmail: string, recipients: Array<{name: string, email: string, role: string, numero?: string}>}}
 */
function extractContractRecipients(contract) {
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

  const recipients = [];
  const seenRecipients = new Set();

  if (recipientName && recipientEmail) {
    recipients.push({ name: recipientName, email: recipientEmail, role: "representante_legal" });
    seenRecipients.add(`${recipientName.trim().toLowerCase()}||${recipientEmail.trim().toLowerCase()}`);
  }

  if (contract && Array.isArray(contract.negotiation)) {
    contract.negotiation.forEach((neg) => {
      if (Array.isArray(neg.portabilityLines)) {
        neg.portabilityLines.forEach((line) => {
          const cedenteNome = (line?.nomeCedente || "").trim();
          const cedenteEmail = (line?.email || "").trim().toLowerCase();
          if (cedenteNome && cedenteEmail) {
            const key = `${cedenteNome.toLowerCase()}||${cedenteEmail}`;
            if (!seenRecipients.has(key)) {
              seenRecipients.add(key);
              recipients.push({
                name: cedenteNome,
                email: cedenteEmail,
                role: "responsavel_portabilidade",
                numero: line.numero || null,
              });
            }
          }
        });
      }
    });
  }

  return { recipientName, recipientEmail, recipients };
}

/**
 * Busca de forma atômica o próximo job da fila para processamento pelo robô.
 *
 * @async
 * @param {import("express").Request} req - Requisição Express (query/body instance_id, role).
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
    const accessConfig = await SystemConfig.findOne({ key: "access_restriction" }).lean();
    if (accessConfig?.value?.enabled && !isTimeAccessAllowed(accessConfig.value)) {
      return res.status(200).json({
        hasJob: false,
        reason: "outside_working_hours",
        message: "Fora do horário de expediente permitido.",
      });
    }

    // 2b. Resolver role da instância para filtragem (ignora req.user.role que carrega permissão de usuário 'admin')
    let rawInstanceRole = req.query.role || req.body?.role || null;
    let instanceRole = normalizeRole(rawInstanceRole);
    if (rawInstanceRole && !instanceRole) {
      return res.status(400).json({
        error: "role inválido",
        message: "role inválido",
      });
    }
    // Busca role persistido se não enviado
    if (!instanceRole) {
      const instDoc = await RobotInstance.findOne({ instance_id }).lean();
      instanceRole = normalizeRole(instDoc?.role) || "all";
    }
    const allowedActions = instanceRole === "all" ? null : getAllowedActions(instanceRole);

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

    // 4. Buscar e travar atomicamente um job pendente existente (filtrado por role)
    const statusLockFilter = {
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
    };
    const actionFilter = allowedActions ? { action: { $in: allowedActions } } : {};
    let job = await RobotJob.findOneAndUpdate(
      { ...statusLockFilter, ...actionFilter },
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

    if (job) {
      emitProgress(job);
    }

    if (!job) {
      return res.status(200).json({
        hasJob: false,
        reason: "no_pending_jobs",
        message: "Nenhum job pendente no momento.",
      });
    }

    // 5. Carregar os dados completos do Contrato associado (null-safe para jobs globais)
    const contractId = job.contract_id || job.contractId || null;
    // Jobs globais (query_agreements/reports) não têm contrato — entrega payload de varredura sem Contract.findById(null)
    if (!contractId && ["query_agreements", "reports"].includes(job.action)) {
      const payloadGlobal = {
        hasJob: true,
        jobId: job._id.toString(),
        contractId: null,
        action: job.action,
        envelopeId: job.envelopeId || null,
        credentials: {
          ...(config.credentials || {}),
          token_notification_email: config.token_notification_email,
          mfa: config.mfa,
        },
        token_notification_email: config.token_notification_email,
        mfa: config.mfa || { maxWaitMs: 90000, maxAgeMs: 600000 },
        daysBack: Number(job.payload?.daysBack) || 5,
      };
      await RobotInstance.findOneAndUpdate(
        { instance_id },
        { $set: { status: "busy", current_job_id: job._id, last_heartbeat: now } }
      );
      return res.status(200).json(payloadGlobal);
    }

    let contract = null;
    if (contractId) {
      contract = await Contract.findById(contractId).lean();
    }

    // Extrair caminho do primeiro documento disponível (usa helper hasPdf)
    let pdfUrl = null;
    if (hasPdf(contract) && contractId) {
      pdfUrl = `/api/robot-docusign/instance/contracts/${contractId}/pdf`;
    }

    // Se a ação for 'send' e não houver documento PDF ou e-mail válido, cancela o lock e pula o job
    if (job.action === "send" && !isEligibleForSend(contract)) {
      await RobotJob.findByIdAndUpdate(job._id, {
        status: "failed",
        error: "Contrato sem documento PDF anexado ou sem e-mail do destinatário.",
        completedAt: now,
        locked_by: null,
        lock_expires_at: null,
      });

      // Reverte contrato preso em em_processamento_robot para status original pré-lock
      if (contractId) {
        const revertStatus =
          (job.originalStatus && job.originalStatus !== "em_processamento_robot")
            ? job.originalStatus
            : "gerado";
        await Contract.findByIdAndUpdate(contractId, { status: revertStatus }).catch((err) => {
          console.warn(`[getNextJob] Erro ao reverter status do contrato ${contractId}:`, err?.message || err);
        });
      }

      console.warn(`[getNextJob] Job ${job._id} ignorado por falta de PDF ou e-mail (contrato ${contractId}).`);

      return res.status(200).json({
        hasJob: false,
        reason: "contract_missing_pdf_or_email",
        message: `Job ${job._id} ignorado por falta de PDF ou e-mail de destinatário no contrato.`,
      });
    }

    const { recipientName, recipientEmail, recipients } = extractContractRecipients(contract);

    const payload = {
      hasJob: true,
      jobId: job._id.toString(),
      contractId: contractId?.toString(),
      action: job.action || "send",
      envelopeId: job.envelopeId || contract?.envelopeId || null,
      recipientName,
      recipientEmail,
      recipients,
      subject: job.payload?.subject || `Contrato de Adesão - ${contract?.client?.razaoSocial || "Cliente"}`,
      message: job.payload?.message || "Prezado cliente, segue o contrato para assinatura eletrônica.",
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
    console.error("[getNextJob] Erro ao buscar próximo job:", error);
    return res.status(500).json({ error: "Erro ao buscar próximo job", message: error.message });
  }
};

export default getNextJob;
