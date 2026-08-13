import mongoose from "mongoose";
import { getContractsConnection } from "../../../config/database.js";

/**
 * Sub-schema para log de execução por passo (REQ-001 AC 3)
 */
const robotJobStepSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: { type: String, enum: ["pending", "running", "success", "failed"], default: "pending" },
    timestamp: { type: Date, default: Date.now },
    duration: { type: Number, default: 0 },
    error: { type: String },
  },
  { _id: false }
);

/**
 * Schema Mongoose para Fila de Jobs do Robô DocuSign.
 * Suporta os requisitos de REQ-001 (SPEC.md) e T01-modelo.md.
 */
const robotJobSchema = new mongoose.Schema(
  {
    // Identificador do Contrato (Suporta contract_id e contractId)
    contract_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
      index: true,
    },
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
    },

    // Ação do Robô
    action: {
      type: String,
      enum: ["send", "status", "download", "resend", "reports"],
      required: true,
    },

    // Status da Execução (Suporta enums do SPEC.md e T01)
    status: {
      type: String,
      enum: ["pending", "processing", "running", "completed", "success", "failed", "retrying"],
      default: "pending",
      index: true,
    },

    // Modo de Operação
    robot_mode: {
      type: Boolean,
      default: false,
    },
    mode: {
      type: String,
      enum: ["robot", "api"],
      default: "robot",
    },

    // Tentativas e Retry
    attempts: {
      type: Number,
      default: 0,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    max_attempts: {
      type: Number,
      default: 3,
    },
    next_retry_at: {
      type: Date,
      index: true,
    },

    // Timestamps de Ciclo de Vida
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },

    // Logs e Erros
    error: {
      type: String,
    },
    lastError: {
      type: String,
    },
    steps: [robotJobStepSchema],

    // Dados de Retorno DocuSign
    envelopeId: {
      type: String,
    },
    signedDocPath: {
      type: String,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Auditoria
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Índices compostos conforme REQ-001
robotJobSchema.index({ contractId: 1, status: 1 });
robotJobSchema.index({ createdAt: -1 });

// Middleware pre-save para sincronizar aliases de convenção
robotJobSchema.pre("save", function (next) {
  if (this.contract_id && !this.contractId) {
    this.contractId = this.contract_id;
  } else if (this.contractId && !this.contract_id) {
    this.contract_id = this.contractId;
  }

  if (this.attempts !== undefined && this.retryCount === 0) {
    this.retryCount = this.attempts;
  } else if (this.retryCount !== undefined && this.attempts === 0) {
    this.attempts = this.retryCount;
  }

  if (this.error && !this.lastError) {
    this.lastError = this.error;
  } else if (this.lastError && !this.error) {
    this.error = this.lastError;
  }

  next();
});

const conn = getContractsConnection();
export const RobotJob = conn.models.RobotJob || conn.model("RobotJob", robotJobSchema, "robot_jobs");
export default RobotJob;
