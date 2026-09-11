/**
 * @file Função utilitária para construção da URL parametrizada de acordos/documentos no DocuSign.
 */

/**
 * Constrói a URL para a listagem de documentos/acordos no DocuSign com base no intervalo de dias.
 *
 * @param {number} [daysBack=5] - Quantidade de dias no passado a consultar.
 * @param {string} [baseUrl="https://apps.docusign.com/send/documents"] - URL base da listagem.
 * @returns {string} URL parametrizada com folder e from_date.
 */
export function buildAgreementsFilterUrl(daysBack = 5, baseUrl = "https://apps.docusign.com/send/documents") {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - (Number(daysBack) || 5));
  const dateParam = fromDate.toISOString().split("T")[0];
  return `${baseUrl}?folder=all&from_date=${dateParam}`;
}

/** Alias retrocompatível */
export const buildAgreementsUrl = buildAgreementsFilterUrl;

export default buildAgreementsFilterUrl;
