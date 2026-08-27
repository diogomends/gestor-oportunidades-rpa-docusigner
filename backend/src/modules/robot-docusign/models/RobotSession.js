import mongoose from "mongoose";
import { getContractsConnection } from "../../../config/database.js";

/**
 * Schema Mongoose para Persistência de Sessão do Robô DocuSign.
 * Collection: `robot_sessions` no banco `crm_contracts`.
 */
const robotSessionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    cookies: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    localStorage: {
      type: mongoose.Schema.Types.Mixed,
    },
    user_agent: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
    },
    last_used_at: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

/**
 * Funcao utilitaria para sincronizar aliases entre snake_case e camelCase.
 * @param {Object} doc - Documento ou objeto da sessao.
 */
export function syncSessionAliases(doc) {
  if (!doc) return;

  if (doc.expires_at && !doc.expiresAt) {
    doc.expiresAt = doc.expires_at;
  } else if (doc.expiresAt) {
    doc.expires_at = doc.expiresAt;
  }

  if (doc.lastUsedAt) {
    doc.last_used_at = doc.lastUsedAt;
  } else if (doc.last_used_at) {
    doc.lastUsedAt = doc.last_used_at;
  }

  if (doc.user_agent && !doc.userAgent) {
    doc.userAgent = doc.user_agent;
  } else if (doc.userAgent) {
    doc.user_agent = doc.userAgent;
  }
}

// Pre-save hook para sincronizar aliases entre snake_case e camelCase
robotSessionSchema.pre("save", function (next) {
  syncSessionAliases(this);

  if (typeof next === "function") {
    next();
  }
});

const conn = getContractsConnection();
/**
 * Model Mongoose para sessões do robô DocuSign (collection: robot_sessions).
 * @type {import('mongoose').Model}
 */
export const RobotSession = conn.models.RobotSession || conn.model("RobotSession", robotSessionSchema, "robot_sessions");
/**
 * Model padrão de RobotSession para import default.
 * @type {import('mongoose').Model}
 */
export default RobotSession;
