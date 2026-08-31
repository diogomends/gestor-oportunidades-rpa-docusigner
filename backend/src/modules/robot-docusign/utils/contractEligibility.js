/**
 * @file Helper compartilhado para elegibilidade de contratos ao envio DocuSign.
 * Centraliza filtro Mongo e validação em memória (PDF + e-mail).
 */

/**
 * Verifica se string tem conteúdo não-vazio (após trim).
 * @param {any} v
 * @returns {boolean}
 */
function hasValue(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Verifica se contrato possui PDF anexado.
 * @param {Object} contract
 * @returns {boolean}
 */
export function hasPdf(contract) {
  if (!contract?.documents || !Array.isArray(contract.documents) || contract.documents.length === 0) return false;
  return contract.documents.some((d) => hasValue(d?.originalUrl));
}

/**
 * Verifica se contrato possui e-mail do destinatário.
 * @param {Object} contract
 * @returns {boolean}
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
 * @param {Object} contract
 * @returns {boolean}
 */
export function isEligibleForSend(contract) {
  return hasPdf(contract) && hasRecipientEmail(contract);
}

/**
 * Filtro Mongo para buscar apenas contratos `gerado` elegíveis.
 * Reutilizado em `getNextJob` e `robotScheduler`.
 * @type {Object}
 */
export const GERADO_ELIGIBLE_FILTER = {
  status: "gerado",
  "documents.originalUrl": { $exists: true, $ne: null, $ne: "" },
  $or: [
    { "client.representante.email": { $exists: true, $ne: null, $ne: "" } },
    { "signer.email": { $exists: true, $ne: null, $ne: "" } },
    { email: { $exists: true, $ne: null, $ne: "" } },
    { clientEmail: { $exists: true, $ne: null, $ne: "" } },
  ],
};

export default { hasPdf, hasRecipientEmail, isEligibleForSend, GERADO_ELIGIBLE_FILTER };
