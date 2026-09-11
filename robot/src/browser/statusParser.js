/**
 * @file Fachada Barrel DIP e ponto de entrada para o parser de status de envelopes no robô DocuSign.
 * Re-exporta funções atômicas de ./statusParser/ mantendo 100% de compatibilidade retroativa.
 */

export { normalizeComparisonText, normalizeText } from "./statusParser/normalizeComparisonText.js";
export { cleanSignerNameNoise, stripPendingSignerNoise } from "./statusParser/cleanSignerNameNoise.js";
export { extractPendingSignerName, extractPendingSigner } from "./statusParser/extractPendingSignerName.js";
export { normalizeDocusignEnvelopeStatus, normalizeEnvelopeStatus } from "./statusParser/normalizeDocusignEnvelopeStatus.js";

import { normalizeComparisonText } from "./statusParser/normalizeComparisonText.js";
import { cleanSignerNameNoise } from "./statusParser/cleanSignerNameNoise.js";
import { extractPendingSignerName } from "./statusParser/extractPendingSignerName.js";
import { normalizeDocusignEnvelopeStatus } from "./statusParser/normalizeDocusignEnvelopeStatus.js";

export default {
  normalizeText: normalizeComparisonText,
  normalizeComparisonText,
  stripPendingSignerNoise: cleanSignerNameNoise,
  cleanSignerNameNoise,
  extractPendingSigner: extractPendingSignerName,
  extractPendingSignerName,
  normalizeEnvelopeStatus: normalizeDocusignEnvelopeStatus,
  normalizeDocusignEnvelopeStatus,
};
