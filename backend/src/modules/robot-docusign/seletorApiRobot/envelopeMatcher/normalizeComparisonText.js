/**
 * @file Função utilitária para normalização de textos em operações de comparação e correspondência de contratos.
 */

/**
 * Normaliza strings para facilitar comparação insensível a maiúsculas e acentuação.
 *
 * @param {string} [str=""] - Texto original.
 * @returns {string} Texto normalizado em caixa baixa sem acentos.
 */
export function normalizeComparisonText(str = "") {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Alias retrocompatível */
export const normalizeString = normalizeComparisonText;

export default normalizeComparisonText;
