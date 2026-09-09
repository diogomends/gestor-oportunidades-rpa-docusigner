import mongoose from "mongoose";
import { getContractsConnection } from "../config/database.js";

const docusignEnvelopeSchema = new mongoose.Schema(
  {
    contractId: { type: mongoose.Schema.Types.ObjectId, ref: "Contract", required: true },
    envelopeId: String,
    status: {
      type: String,
      enum: ["rascunho", "created", "sent", "delivered", "completed", "declined", "voided"],
    },
    signer: {
      nome: String,
      email: String,
      cpf: String,
    },
    sentAt: Date,
    completedAt: Date,
    webhookEvents: [{ event: String, timestamp: Date }],
    accessHash: String,
    signedDocPath: String,
    clientDocs: [{
      type: { type: String },
      originalName: String,
      filePath: String,
      uploadedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

const conn = getContractsConnection();
export default conn.models.DocusignEnvelope || conn.model("DocusignEnvelope", docusignEnvelopeSchema, "docusign_envelopes");
