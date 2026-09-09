/**
 * @file Modelo Mongoose para persistência e rastreamento de envelopes DocuSign no banco crm_contracts.
 */

import mongoose from "mongoose";
import { getContractsConnection } from "../config/database.js";

/**
 * @typedef {Object} DocusignEnvelopeClientDoc
 * @property {string} [type] - Tipo do documento anexo.
 * @property {string} [originalName] - Nome original do arquivo.
 * @property {string} [filePath] - Caminho relativo do arquivo armazenado.
 * @property {Date} [uploadedAt] - Data do upload.
 */

/**
 * @typedef {Object} DocusignEnvelopeSigner
 * @property {string} [nome] - Nome do signatário.
 * @property {string} [email] - E-mail do signatário.
 * @property {string} [cpf] - CPF do signatário.
 */

/**
 * @typedef {Object} DocusignEnvelopeDoc
 * @property {import('mongoose').Types.ObjectId} contractId - Referência ao contrato associado.
 * @property {string} [envelopeId] - Identificador único do envelope na DocuSign.
 * @property {'rascunho'|'created'|'sent'|'delivered'|'completed'|'declined'|'voided'} [status] - Status do envelope.
 * @property {DocusignEnvelopeSigner} [signer] - Dados do signatário principal.
 * @property {Date} [sentAt] - Data de envio do envelope.
 * @property {Date} [completedAt] - Data de conclusão das assinaturas.
 * @property {Array<{ event: string, timestamp: Date }>} [webhookEvents] - Histórico de eventos de webhook.
 * @property {string} [accessHash] - Hash de acesso público seguro.
 * @property {string} [signedDocPath] - Caminho local do documento assinado baixado.
 * @property {Array<DocusignEnvelopeClientDoc>} [clientDocs] - Documentos complementares anexados.
 * @property {Date} createdAt - Data de criação do registro.
 * @property {Date} updatedAt - Data da última atualização.
 */

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
    clientDocs: [
      {
        type: { type: String },
        originalName: String,
        filePath: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const conn = getContractsConnection();

/** @type {import('mongoose').Model<DocusignEnvelopeDoc>} */
const DocusignEnvelope = conn.models.DocusignEnvelope || conn.model("DocusignEnvelope", docusignEnvelopeSchema, "docusign_envelopes");

export default DocusignEnvelope;
