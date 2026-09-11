/**
 * @file Função utilitária para correspondência entre contrato do CRM e envelopes retornados da DocuSign.
 */

import { normalizeComparisonText } from "./normalizeComparisonText.js";

/**
 * Realiza o cruzamento de um contrato ativo com a lista de envelopes obtidos da DocuSign.
 *
 * @param {Record<string, any>} contract - Dados do contrato.
 * @param {Array<Record<string, any>>} envelopes - Lista de envelopes da DocuSign.
 * @returns {Record<string, any>|null} Envelope correspondente ou null se não houver match.
 */
export function matchContractWithDocusignEnvelope(contract, envelopes) {
  if (!contract || !Array.isArray(envelopes)) return null;

  const repEmail = normalizeComparisonText(contract.client?.representante?.email || contract.client?.admin?.email);
  const repName = normalizeComparisonText(contract.client?.representante?.nome || contract.client?.admin?.nome);
  const storedEnvelopeId = contract.envelopeId || contract.docusign_envelope_id;

  return (
    envelopes.find((env) => {
      if (storedEnvelopeId && env.envelopeId && env.envelopeId === storedEnvelopeId) {
        return true;
      }
      const envRecipient = normalizeComparisonText(env.recipient);
      if (repEmail && envRecipient.includes(repEmail)) return true;
      if (repName && envRecipient.includes(repName)) return true;
      return false;
    }) || null
  );
}

/** Alias retrocompatível */
export const matchContractWithEnvelope = matchContractWithDocusignEnvelope;

export default matchContractWithDocusignEnvelope;
