/**
 * @file Função utilitária para normalização de status de envelopes no robô DocuSign.
 */

import logger from "../../utils/logger.js";
import { normalizeComparisonText } from "./normalizeComparisonText.js";
import { extractPendingSignerName } from "./extractPendingSignerName.js";

/**
 * Mapeamento padronizado de termos para status de envelopes do sistema.
 * @constant
 * @type {Array<{terms: string[], status: string}>}
 */
const STATUS_RULES = [
  { terms: ["concluido", "concluído", "completed"], status: "completed" },
  { terms: ["aguardando", "waiting_others"], status: "waiting_others" },
  { terms: ["anulado", "voided"], status: "voided" },
  { terms: ["falha na entrega", "falha", "delivery_failed"], status: "delivery_failed" },
  { terms: ["aguardando", "waiting", "waiting_others"], status: "waiting_others" },
];

/**
 * Normaliza o texto de status do envelope extraído da DocuSign para status padronizados do sistema.
 * Extrai detalhes nominais de signatários pendentes e preserva o texto original para exibição.
 *
 * @param {string} rawText - Texto bruto de status capturado na interface.
 * @returns {{status: string, rawStatus: string, statusDetail: string, pendingSigner: string|null, unknown_status: boolean}} Objeto com status normalizado, detalhe e flag de alerta.
 */
export function normalizeDocusignEnvelopeStatus(rawText) {
  const clean = normalizeComparisonText(rawText);

  if (!clean) {
    return {
      status: "unknown",
      rawStatus: rawText || "",
      statusDetail: "",
      pendingSigner: null,
      unknown_status: true,
    };
  }

  const pendingSigner = extractPendingSignerName(rawText);

  for (const rule of STATUS_RULES) {
    if (rule.terms.some((term) => clean.includes(term) || clean === term)) {
      // Rótulos oficiais pt-BR quando a interface exibe apenas o termo técnico em inglês.
      let statusDetail = rawText ? rawText.trim() : "";
      if (rule.status === "voided" && clean.includes("voided")) {
        statusDetail = "Anulado";
      } else if (rule.status === "completed" && clean.includes("completed")) {
        statusDetail = "Concluído";
      }

      return {
        status: rule.status,
        rawStatus: rawText,
        statusDetail,
        pendingSigner,
        unknown_status: false,
      };
    }
  }

  logger.warn("Browser", `Status de envelope desconhecido detectado: "${rawText}". Registrando alerta e preservando texto.`);
  return {
    status: "unknown",
    rawStatus: rawText,
    statusDetail: rawText ? rawText.trim() : "",
    pendingSigner: null,
    unknown_status: true,
  };
}

/** Alias retrocompatível */
export const normalizeEnvelopeStatus = normalizeDocusignEnvelopeStatus;

export default normalizeDocusignEnvelopeStatus;
