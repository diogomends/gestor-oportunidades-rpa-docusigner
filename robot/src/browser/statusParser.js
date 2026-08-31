import logger from "../utils/logger.js";

/**
 * Remove acentos e normaliza texto para comparação case-insensitive.
 * @param {string} text - Texto a ser normalizado.
 * @returns {string} Texto normalizado em minúsculas e sem diacríticos.
 */
export function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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
];

/**
 * Normaliza o texto de status do envelope extraído da DocuSign para status padronizados do sistema.
 * Registra alerta se o status for desconhecido e preserva o texto original.
 *
 * @param {string} rawText - Texto bruto de status capturado na interface.
 * @returns {{status: string, rawStatus: string, unknown_status: boolean}} Objeto com status normalizado e flag de alerta.
 */
export function normalizeEnvelopeStatus(rawText) {
  const clean = normalizeText(rawText);

  if (!clean) {
    return {
      status: "unknown",
      rawStatus: rawText || "",
      unknown_status: true,
    };
  }

  for (const rule of STATUS_RULES) {
    if (rule.terms.some((term) => clean.includes(term) || clean === term)) {
      return { status: rule.status, rawStatus: rawText, unknown_status: false };
    }
  }

  logger.warn("Browser", `Status de envelope desconhecido detectado: "${rawText}". Registrando alerta e preservando texto.`);
  return {
    status: "unknown",
    rawStatus: rawText,
    unknown_status: true,
  };
}

export default {
  normalizeText,
  normalizeEnvelopeStatus,
};
