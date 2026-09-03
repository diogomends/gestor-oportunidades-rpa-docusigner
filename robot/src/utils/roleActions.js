/**
 * @file Utilitário canônico de papéis (roles) e permissões de ações da frota de robôs DocuSigner.
 * Centraliza os papéis suportados, suas respectivas ações permitidas e funções de validação no robô standalone.
 */

/**
 * Papéis canônicos suportados pela frota de robôs.
 * @constant
 * @type {readonly ["query", "update", "all"]}
 */
export const ROLE_ENUM = /** @type {const} */ (["query", "update", "all"]);

/**
 * Mapa de ações permitidas por papel na frota.
 * @constant
 * @type {Record<string, readonly string[]>}
 */
export const ROLE_ACTIONS = Object.freeze({
  query: Object.freeze(["query_agreements", "status", "reports", "download"]),
  update: Object.freeze(["send", "resend"]),
  all: Object.freeze(["query_agreements", "status", "reports", "download", "send", "resend"]),
});

/**
 * Retorna a lista de ações permitidas para um determinado papel.
 *
 * @param {string} [role="all"] - Papel da instância do robô ('query', 'update', 'all').
 * @returns {readonly string[]} Lista de ações permitidas para o papel.
 */
export function getAllowedActions(role = "all") {
  const normalized = normalizeRole(role);
  if (!normalized || normalized === "all") {
    return ROLE_ACTIONS.all;
  }
  return ROLE_ACTIONS[normalized] || ROLE_ACTIONS.all;
}

/**
 * Verifica se uma ação é permitida para um determinado papel.
 *
 * @param {string} role - Papel da instância do robô.
 * @param {string} action - Ação a ser executada.
 * @returns {boolean} Verdadeiro se a ação for permitida para o papel.
 */
export function isActionAllowedForRole(role, action) {
  if (!action) return false;
  const allowed = getAllowedActions(role);
  return allowed.includes(action);
}

/**
 * Normaliza um papel recebido (incluindo tratamento de alias 'enviar' -> 'update').
 *
 * @param {string|null|undefined} role - Papel a ser normalizado.
 * @returns {string|null} Papel canônico ('query', 'update', 'all') ou null se inválido.
 */
export function normalizeRole(role) {
  if (!role || typeof role !== "string") return null;
  const clean = role.trim().toLowerCase();
  if (clean === "enviar") return "update";
  if (ROLE_ENUM.includes(clean)) return clean;
  return null;
}

export default {
  ROLE_ENUM,
  ROLE_ACTIONS,
  getAllowedActions,
  isActionAllowedForRole,
  normalizeRole,
};
