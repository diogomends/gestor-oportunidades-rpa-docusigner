/**
 * @file Função utilitária para normalização de textos no robô DocuSign.
 * Remove acentos e converte para minúsculas.
 */

/**
 * Remove acentos e normaliza texto para comparação case-insensitive.
 *
 * @param {string} text - Texto a ser normalizado.
 * @returns {string} Texto normalizado em minúsculas e sem diacríticos.
 */
export function normalizeComparisonText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Alias retrocompatível */
export const normalizeText = normalizeComparisonText;

export default normalizeComparisonText;
