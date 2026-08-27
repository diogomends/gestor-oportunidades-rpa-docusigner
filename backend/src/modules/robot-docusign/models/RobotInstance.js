import mongoose from "mongoose";
import { getContractsConnection } from "../../../config/database.js";

/**
 * Schema Mongoose para Instâncias do Robô DocuSign (Executáveis .exe).
 * Rastreia heartbeat, status e máquina que está executando a automação.
 */
const robotInstanceSchema = new mongoose.Schema(
  {
    instance_id: {
      type: String,
      required: true,
      unique: true,
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
