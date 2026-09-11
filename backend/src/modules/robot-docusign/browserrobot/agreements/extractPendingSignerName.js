/**
 * @file Função utilitária para extração do nome do signatário pendente a partir do texto bruto de status do DocuSign.
 */

import { cleanSignerNameNoise } from "./cleanSignerNameNoise.js";

/**
 * Extrai o nome do signatário pendente a partir do texto bruto de status do DocuSign.
 * Rótulos genéricos ("Aguardando outros", "Aguardando 2 outros", "Aguardando terceiros")
 * retornam null — o texto integral permanece preservado em `statusDetail` para exibição.
 *
 * @param {string} [rawText=""] - Texto bruto capturado.
 * @returns {string|null} Nome do signatário limpo ou null.
 */
export function extractPendingSignerName(rawText = "") {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();

  // Padrões comuns: "Aguardando [Nome]", "Waiting for [Nome]", "Needs to sign: [Nome]"
  const match =
    trimmed.match(/^aguardando\s+(.+)$/i) ||
    trimmed.match(/^waiting\s+for\s+(.+)$/i) ||
    trimmed.match(/^needs\s+to\s+sign:?\s*(.+)$/i);
  if (!match) return null;

  const signer = cleanSignerNameNoise(match[1]);
  return signer || null;
}

/** Alias retrocompatível */
export const extractPendingSigner = extractPendingSignerName;

export default extractPendingSignerName;
