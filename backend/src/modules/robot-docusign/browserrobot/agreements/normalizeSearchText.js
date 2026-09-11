/**
 * @file Função utilitária para normalização de strings em consultas e comparações de acordos DocuSign.
 * Remove diacríticos/acentuações e converte para caixa baixa.
 */

/**
 * Normaliza strings de texto removendo espaços extras e acentos para comparação insensível.
 *
 * @param {string} [text=""] - Texto original.
 * @returns {string} Texto normalizado em caixa baixa sem acentos.
 */
export function normalizeSearchText(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Alias retrocompatível */
export const normalizeText = normalizeSearchText;

export default normalizeSearchText;
