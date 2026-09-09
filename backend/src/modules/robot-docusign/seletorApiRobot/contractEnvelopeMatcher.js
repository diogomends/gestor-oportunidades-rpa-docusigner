/**
 * @file Utilitário e mapeador de status entre contratos do CRM e envelopes da DocuSign.
 * Responsável exclusivo por normalização de texto, conversão canônica de status e algoritmo de correspondência.
 * Aplica os princípios SOLID (SRP) e Anti-Phantom Success Hardening.
 */

/**
 * Normaliza strings para facilitar comparação insensível a maiúsculas e acentuação.
 *
 * @param {string} [str=""] - Texto original.
 * @returns {string} Texto normalizado.
 */
export function normalizeString(str = "") {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Mapeia o status do envelope extraído da DocuSign para o status canônico do modelo Contract.
 * Retorna null se o status não for reconhecido, for vazio ou rascunho, prevenindo alterações arbitrárias de estado (Anti-Phantom Success).
 *
 * @param {string} [envelopeStatus=""] - Status do envelope na DocuSign.
 * @returns {string|null} Status correspondente no modelo Contract ('enviado', 'assinado', 'cancelado') ou null se não reconhecido.
 */
export function mapEnvelopeStatusToContractStatus(envelopeStatus = "") {
  const normalized = normalizeString(envelopeStatus);
  switch (normalized) {
    case "completed":
    case "assinado":
    case "signed":
    case "concluido":
      return "assinado";
    case "declined":
    case "voided":
    case "expired":
    case "recusado":
    case "anulado":
    case "cancelado":
      return "cancelado";
    case "sent":
    case "delivered":
    case "processing":
    case "enviado":
    case "entregue":
      return "enviado";
    default:
      return null;
  }
}

/**
 * Realiza o cruzamento de um contrato ativo com a lista de envelopes obtidos da DocuSign.
 *
 * @param {Record<string, any>} contract - Dados do contrato.
 * @param {Array<Record<string, any>>} envelopes - Lista de envelopes da DocuSign.
 * @returns {Record<string, any>|null} Envelope correspondente ou null se não houver match.
 */
export function matchContractWithEnvelope(contract, envelopes) {
  const repEmail = normalizeString(contract.client?.representante?.email || contract.client?.admin?.email);
  const repName = normalizeString(contract.client?.representante?.nome || contract.client?.admin?.nome);
  const storedEnvelopeId = contract.envelopeId || contract.docusign_envelope_id;

  return (
    envelopes.find((env) => {
      if (storedEnvelopeId && env.envelopeId && env.envelopeId === storedEnvelopeId) {
        return true;
      }
      const envRecipient = normalizeString(env.recipient);
      if (repEmail && envRecipient.includes(repEmail)) return true;
      if (repName && envRecipient.includes(repName)) return true;
      return false;
    }) || null
  );
}

export default {
  normalizeString,
  mapEnvelopeStatusToContractStatus,
  matchContractWithEnvelope,
};
