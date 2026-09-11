/**
 * @file Função utilitária para normalização de status de envelopes DocuSign para status canônicos do sistema.
 */

import { normalizeSearchText } from "./normalizeSearchText.js";
import { extractPendingSignerName } from "./extractPendingSignerName.js";

/**
 * Normaliza o status bruto extraído da interface DocuSign para status canônico da aplicação.
 *
 * @param {string} [rawStatus=""] - Texto bruto do status obtido da UI.
 * @returns {{ status: string, rawStatus: string, statusDetail: string, pendingSigner: string|null, unknown_status: boolean }} Objeto com status normalizado e indicação de desconhecido.
 */
export function normalizeDocusignEnvelopeStatus(rawStatus = "") {
  const clean = normalizeSearchText(rawStatus);
  const pendingSigner = extractPendingSignerName(rawStatus);

  if (clean.includes("aguardando") || clean.includes("waiting")) {
    return {
      status: "sent",
      rawStatus: String(rawStatus || "").trim(),
      statusDetail: String(rawStatus || "").trim(),
      pendingSigner,
      unknown_status: false,
    };
  }

  const statusMap = {
    assinado: "completed",
    concluido: "completed",
    completed: "completed",
    signed: "completed",
    enviado: "sent",
    sent: "sent",
    entregue: "delivered",
    delivered: "delivered",
    recusado: "declined",
    declined: "declined",
    anulado: "voided",
    voided: "voided",
    expirado: "expired",
    expired: "expired",
    processando: "processing",
    processing: "processing",
    rascunho: "draft",
    draft: "draft",
  };

  const status = statusMap[clean] || "unknown";
  let statusDetail = String(rawStatus || "").trim();
  // Rótulos oficiais pt-BR quando a interface exibe apenas o termo técnico em inglês.
  if (status === "voided" && clean.includes("voided")) {
    statusDetail = "Anulado";
  } else if (status === "completed" && clean.includes("completed")) {
    statusDetail = "Concluído";
  }

  return {
    status,
    rawStatus: String(rawStatus || "").trim(),
    statusDetail,
    pendingSigner,
    unknown_status: status === "unknown" && Boolean(clean),
  };
}

/** Alias retrocompatível */
export const normalizeEnvelopeStatus = normalizeDocusignEnvelopeStatus;

export default normalizeDocusignEnvelopeStatus;
