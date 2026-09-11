/**
 * @file Fachada Barrel DIP e ponto de entrada para serviços de consulta de acordos DocuSign no backend.
 * Re-exporta funções atômicas de ./agreements/ mantendo 100% de retrocompatibilidade.
 */

export { normalizeSearchText, normalizeText } from "./agreements/normalizeSearchText.js";
export { cleanSignerNameNoise, stripPendingSignerNoise } from "./agreements/cleanSignerNameNoise.js";
export { extractPendingSignerName, extractPendingSigner } from "./agreements/extractPendingSignerName.js";
export { normalizeDocusignEnvelopeStatus, normalizeEnvelopeStatus } from "./agreements/normalizeDocusignEnvelopeStatus.js";
export { buildAgreementsFilterUrl, buildAgreementsUrl } from "./agreements/buildAgreementsFilterUrl.js";
export { extractPageEnvelopeRows, extractEnvelopesFromCurrentPage } from "./agreements/extractPageEnvelopeRows.js";
export { queryRepresentativeAgreementsPaginated, fetchAgreementsByRepresentative } from "./agreements/queryRepresentativeAgreementsPaginated.js";

import { extractPageEnvelopeRows } from "./agreements/extractPageEnvelopeRows.js";
import { queryRepresentativeAgreementsPaginated } from "./agreements/queryRepresentativeAgreementsPaginated.js";

export default {
  extractEnvelopesFromCurrentPage: extractPageEnvelopeRows,
  fetchAgreementsByRepresentative: queryRepresentativeAgreementsPaginated,
  extractPageEnvelopeRows,
  queryRepresentativeAgreementsPaginated,
};
