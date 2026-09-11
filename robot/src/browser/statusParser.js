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
  { terms: ["aguardando", "waiting", "waiting_others"], status: "waiting_others" },
];

/**
 * Remove ruído de rótulos de pendência que não representam um signatário nominal
 * (ex: "outros", "terceiros", "assinatura de", contadores como "2 outros").
 *
 * @param {string} signerText - Texto bruto extraído após o prefixo de pendência.
 * @returns {string} Texto limpo; string vazia se não houver signatário nominal.
 */
function stripPendingSignerNoise(signerText) {
  const cleaned = signerText
    .replace(/^(?:assinatura\s+de|signature\s+of)\s+/i, "")
    .replace(/\s+(?:e|and)\s+\d+\s+(?:outros?|others?)$/i, "")
    .trim();
  if (/^(?:\d+\s+)?(?:outros?|others?|terceiros|third\s+parties?|partes?)$/i.test(cleaned)) {
    return "";
  }
  return cleaned;
}

/**
 * Extrai o nome do signatário pendente a partir do texto bruto de status do DocuSign.
 * Rótulos genéricos ("Aguardando outros", "Aguardando 2 outros", "Aguardando terceiros")
 * retornam null — o texto integral permanece preservado em `statusDetail` para exibição.
 *
 * @param {string} rawText - Texto bruto capturado.
 * @returns {string|null} Nome do signatário limpo ou null.
 */
export function extractPendingSigner(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();

  // Padrões comuns: "Aguardando [Nome]", "Waiting for [Nome]", "Needs to sign: [Nome]"
  const match =
    trimmed.match(/^aguardando\s+(.+)$/i) ||
    trimmed.match(/^waiting\s+for\s+(.+)$/i) ||
    trimmed.match(/^needs\s+to\s+sign:?\s*(.+)$/i);
  if (!match) return null;

  const signer = stripPendingSignerNoise(match[1]);
  return signer || null;
}

/**
 * Normaliza o texto de status do envelope extraído da DocuSign para status padronizados do sistema.
 * Extrai detalhes nominais de signatários pendentes e preserva o texto original para exibição.
 *
 * @param {string} rawText - Texto bruto de status capturado na interface.
 * @returns {{status: string, rawStatus: string, statusDetail: string, pendingSigner: string|null, unknown_status: boolean}} Objeto com status normalizado, detalhe e flag de alerta.
 */
export function normalizeEnvelopeStatus(rawText) {
  const clean = normalizeText(rawText);

  if (!clean) {
    return {
      status: "unknown",
      rawStatus: rawText || "",
      statusDetail: "",
      pendingSigner: null,
      unknown_status: true,
    };
  }

  const pendingSigner = extractPendingSigner(rawText);

  for (const rule of STATUS_RULES) {
    if (rule.terms.some((term) => clean.includes(term) || clean === term)) {
      // Rótulos oficiais pt-BR quando a interface exibe apenas o termo técnico em inglês.
      // statusDetail sempre é truthy neste ponto (rawText não-vazio garantido pelo early-return).
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

export default {
  normalizeText,
  normalizeEnvelopeStatus,
};
