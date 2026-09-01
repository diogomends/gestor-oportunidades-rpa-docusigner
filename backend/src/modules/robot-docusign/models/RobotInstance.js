import mongoose from "mongoose";
import { getContractsConnection } from "../../../config/database.js";

/**
 * @typedef {object} RobotInstanceDocument
 * @property {string} instance_id - Identificador único da instância (ex: robot-query-1).
 * @property {"query"|"update"|"all"} role - Papel da instância na segregação query/update.
 * @property {"active"|"idle"|"busy"|"offline"} status - Status operacional.
 * @property {Date} last_heartbeat - Timestamp do último heartbeat.
 * @property {import("mongoose").Types.ObjectId|null} current_job_id - Job em processamento.
 * @property {number} jobs_processed_today - Contador diário de jobs concluídos.
 * @property {{hostname?:string,platform?:string,arch?:string,app_version?:string}} machine_info - Metadados da máquina.
 */

/**
 * Schema Mongoose para Instâncias do Robô DocuSign (Executáveis .exe).
 * Rastreia heartbeat, status, role e máquina que está executando a automação.
 * @type {import("mongoose").Schema<RobotInstanceDocument>}
 */
const robotInstanceSchema = new mongoose.Schema(
  {
    instance_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    /**
     * @type {import("mongoose").SchemaTypeOptions<"query"|"update"|"all">}
     */
    role: {
      type: String,
      enum: ["query", "update", "all"],
      default: "all",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "idle", "busy", "offline"],
      default: "idle",
      index: true,
    },
    last_heartbeat: {
      type: Date,
      default: Date.now,
      index: true,
    },
    current_job_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RobotJob",
      default: null,
    },
    jobs_processed_today: {
      type: Number,
      default: 0,
    },
    machine_info: {
      hostname: { type: String },
      platform: { type: String },
      arch: { type: String },
      app_version: { type: String },
    },
  },
  { timestamps: true }
);

const conn = getContractsConnection();
/**
 * Model Mongoose para instâncias do robô DocuSign (collection: robot_instances).
 * @type {import('mongoose').Model}
 */
export const RobotInstance =
  conn.models.RobotInstance || conn.model("RobotInstance", robotInstanceSchema, "robot_instances");
export default RobotInstance;
