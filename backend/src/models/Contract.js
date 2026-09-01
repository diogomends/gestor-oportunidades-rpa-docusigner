import mongoose from "mongoose";
import { getContractsConnection } from "../config/database.js";

/**
 * @typedef {Object} ContractDocument
 * @property {import("mongoose").Types.ObjectId} [opportunityId]
 * @property {import("mongoose").Types.ObjectId} [createdBy]
 * @property {Object} [client]
 * @property {Array} [negotiation]
 * @property {Array} [documents]
 * @property {"rascunho"|"gerado"|"enviado"|"assinado"|"cancelado"} [status]
 * @property {string|null} [envelopeId]
 * @property {string|null} [docusign_envelope_id]
 * @property {Object|null} [tokenInfo]
 * @property {Date} [createdAt]
 * @property {Date} [updatedAt]
 */

/**
 * Mongoose schema representing contracts stored in the 'crm_contracts' database.
 * Includes client details, negotiations, portability lines, document links, status, and DocuSign token trigger info.
 */
const contractSchema = new mongoose.Schema(
  {
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    client: {
      razaoSocial: String,
      cnpj: String,
      endereco: {
        cep: String,
        logradouro: String,
        numero: String,
        complemento: String,
        bairro: String,
        cidade: String,
        estado: String,
      },
      admin: {
        nome: String,
        rg: String,
        orgao: String,
        cpf: String,
        email: String,
        telefone: String,
      },
      representante: {
        nome: String,
        rg: String,
        orgao: String,
        cpf: String,
        email: String,
        telefone: String,
      },
      socios: [
        {
          nome: String,
          rg: String,
          orgao: String,
          cpf: String,
          isPJ: Boolean,
          telefone: String,
          email: String,
        },
      ],
      testemunhas: [
        {
          nome: String,
          cpf: String,
        },
      ],
      recebedor: {
        nome: String,
        rg: String,
        orgao: String,
        cpf: String,
        telefone: String,
      },
      inscricaoEstadual: String,
      ramoAtividade: String,
      tipoEmpresa: String,
      referencia: String,
      refEntrega: String,
      dataFundacao: String,
      capitalSocial: String,
      vencimento: String,
      tipoFatura: String,
      observacoes: String,
      dataAssinatura: String,
    },
    negotiation: [
      {
        tipoContratacao: String,
        tipoVenda: String,
        acessos: Number,
        ddd: String,
        plano: String,
        oferta: String,
        aparelho: String,
        roaming: Boolean,
        valorMensal: Number,
        perfil: String,
        tipoLinha: {
          type: String,
          enum: ["port-in", "linha-nova"],
          default: "linha-nova",
        },
        portabilityLines: [
          {
            tipoCedente: { type: String, enum: ["PF", "PJ"] },
            operadoraDoadora: String,
            nomeCedente: String,
            cpfCnpjCedente: String,
            numero: String,
          },
        ],
      },
    ],
    documents: [
      {
        type: {
          type: String,
          enum: ["termo", "proposta", "permanencia"],
        },
        originalUrl: String,
        generatedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["rascunho", "gerado", "em_processamento_robot", "enviado", "assinado", "cancelado"],
      default: "rascunho",
    },
    envelopeId: {
      type: String,
      default: null,
    },
    docusign_envelope_id: {
      type: String,
      default: null,
    },
    tokenInfo: {
      type: {
        tokenLogin: String,
        nomeTbp: String,
        cnpjTbp: String,
        uf: String,
        ddd: String,
        tipoEnvio: [String],
        criterioGatilho: String,
      },
      _id: false,
      default: null,
    },
  },
  { timestamps: true }
);

const conn = getContractsConnection();

/**
 * Contract Mongoose model compiled on the 'crm_contracts' database connection.
 * @type {import("mongoose").Model<ContractDocument & import("mongoose").Document>}
 */
export default conn.models.Contract || conn.model("Contract", contractSchema);

