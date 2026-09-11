/**
 * @file Função utilitária para remoção de ruídos em rótulos de signatários pendentes do DocuSign.
 * Remove prefixos e sufixos como "assinatura de", "2 outros", "terceiros".
 */

/**
 * Remove ruído de rótulos de pendência que não representam um signatário nominal
 * (ex: "outros", "terceiros", "assinatura de", contadores como "2 outros").
 *
 * @param {string} signerText - Texto bruto extraído após o prefixo de pendência.
 * @returns {string} Texto limpo; string vazia se não houver signatário nominal.
 */
export function cleanSignerNameNoise(signerText) {
  if (!signerText || typeof signerText !== "string") return "";
  const cleaned = signerText
    .replace(/^(?:assinatura\s+de|signature\s+of)\s+/i, "")
    .replace(/\s+(?:e|and)\s+\d+\s+(?:outros?|others?)$/i, "")
    .trim();
  if (/^(?:\d+\s+)?(?:outros?|others?|terceiros|third\s+parties?|partes?)$/i.test(cleaned)) {
    return "";
  }
  return cleaned;
}

/** Alias retrocompatível */
export const stripPendingSignerNoise = cleanSignerNameNoise;

export default cleanSignerNameNoise;
