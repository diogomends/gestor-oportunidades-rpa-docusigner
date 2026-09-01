/**
 * @file Helper compartilhado para elegibilidade de contratos ao envio DocuSign.
 * Centraliza filtro Mongo e validação em memória (PDF + e-mail).
 */

/**
 * Verifica se string tem conteúdo não-vazio (após trim).
 * @param {any} v - Valor a ser verificado.
 * @returns {boolean} True se for string válida e não vazia.
 */
function hasValue(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Verifica se contrato possui PDF anexado.
 * @param {Object} contract - Objeto do contrato.
 * @returns {boolean} True se o contrato possuir ao menos um documento válido.
 */
export function hasPdf(contract) {
  if (!contract?.documents || !Array.isArray(contract.documents) || contract.documents.length === 0) return false;
  return contract.documents.some((d) => hasValue(d?.originalUrl));
}

/**
 * Verifica se contrato possui e-mail do destinatário.
 * @param {Object} contract - Objeto do contrato.
 * @returns {boolean} True se o contrato possuir e-mail de destinatário válido.
 */
export function hasRecipientEmail(contract) {
  const email =
    contract?.client?.representante?.email ||
    contract?.signer?.email ||
    contract?.email ||
    contract?.clientEmail ||
    "";
  return hasValue(email);
}

/**
 * Verifica se contrato está elegível para envio (PDF + e-mail).
 * @param {Object} contract - Objeto do contrato.
 * @returns {boolean} True se o contrato estiver elegível.
 */
export function isEligibleForSend(contract) {
  return hasPdf(contract) && hasRecipientEmail(contract);
}

/**
 * Filtro Mongo para buscar contratos elegíveis para envio (todos exceto rascunho com PDF e e-mail).
 * Reutilizado em `getNextJob` e `robotScheduler`.
 * @constant
 * @type {Object}
 */
export const GERADO_ELIGIBLE_FILTER = {
  status: { $ne: "rascunho" },
  "documents.originalUrl": { $exists: true, $ne: null, $ne: "" },
  $or: [
    { "client.representante.email": { $exists: true, $ne: null, $ne: "" } },
    { "signer.email": { $exists: true, $ne: null, $ne: "" } },
    { email: { $exists: true, $ne: null, $ne: "" } },
    { clientEmail: { $exists: true, $ne: null, $ne: "" } },
  ],
};

/**
 * Alias semântico para o filtro Mongo de contratos elegíveis para envio.
 * @constant
 * @type {Object}
 */
export const CONTRACT_ELIGIBLE_FILTER = GERADO_ELIGIBLE_FILTER;

/**
 * Alias semântico plural para o filtro Mongo de contratos elegíveis para envio.
 * @constant
 * @type {Object}
 */
export const ELIGIBLE_CONTRACTS_FILTER = GERADO_ELIGIBLE_FILTER;

/**
 * Exportação padrão do helper de elegibilidade de contratos.
 * @constant
 * @type {Object}
 */
export default {
  hasPdf,
  hasRecipientEmail,
  isEligibleForSend,
  GERADO_ELIGIBLE_FILTER,
  CONTRACT_ELIGIBLE_FILTER,
  ELIGIBLE_CONTRACTS_FILTER,
};

