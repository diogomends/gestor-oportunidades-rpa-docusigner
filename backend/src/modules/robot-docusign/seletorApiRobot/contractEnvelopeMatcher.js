/**
 * @file Fachada Barrel DIP e ponto de entrada para utilitários de correspondência e mapeamento de envelopes DocuSign.
 * Re-exporta funções atômicas de ./envelopeMatcher/ mantendo 100% de compatibilidade retroativa.
 */

export { normalizeComparisonText, normalizeString } from "./envelopeMatcher/normalizeComparisonText.js";
export { convertDocusignStatusToContractStatus, mapEnvelopeStatusToContractStatus } from "./envelopeMatcher/convertDocusignStatusToContractStatus.js";
export { matchContractWithDocusignEnvelope, matchContractWithEnvelope } from "./envelopeMatcher/matchContractWithDocusignEnvelope.js";

import { normalizeComparisonText } from "./envelopeMatcher/normalizeComparisonText.js";
import { convertDocusignStatusToContractStatus } from "./envelopeMatcher/convertDocusignStatusToContractStatus.js";
import { matchContractWithDocusignEnvelope } from "./envelopeMatcher/matchContractWithDocusignEnvelope.js";

export default {
  normalizeString: normalizeComparisonText,
  mapEnvelopeStatusToContractStatus: convertDocusignStatusToContractStatus,
  matchContractWithEnvelope: matchContractWithDocusignEnvelope,
  normalizeComparisonText,
  convertDocusignStatusToContractStatus,
  matchContractWithDocusignEnvelope,
};
