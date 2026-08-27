import mongoose from "mongoose";

/**
 * Mongoose schema representing dynamic key-value system configurations (e.g. robot_docusign credentials, access restrictions).
 */
const SystemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "access_restriction",
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * SystemConfig Mongoose model.
 * @type {import("mongoose").Model<import("mongoose").Document>}
 */
export default mongoose.model("SystemConfig", SystemConfigSchema);

