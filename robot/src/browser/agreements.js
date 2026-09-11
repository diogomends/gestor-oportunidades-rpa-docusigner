/**
 * @file Fachada Barrel DIP e ponto de entrada para serviços de acordos do robô DocuSign.
 * Re-exporta funções atômicas de ./agreements/ mantendo 100% de compatibilidade retroativa.
 */

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
