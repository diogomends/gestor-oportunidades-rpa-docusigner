/**
 * @file Função utilitária para consulta paginada de acordos por representante no robô DocuSign.
 */

import selectors, { buildAgreementsUrl } from "../selectors.js";
import { ensureAuthenticated, saveSessionState, randomDelay, isAuthenticationUrl } from "../auth.js";
import logger from "../../utils/logger.js";
import { extractPageEnvelopeRows } from "./extractPageEnvelopeRows.js";

/**
 * Consulta e extrai todos os acordos destinados a um representante navegando paginadamente até o fim.
 *
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {Object} [options={}] - Parâmetros da consulta.
 * @param {string} [options.repName=""] - Nome do representante para filtragem.
 * @param {number} [options.daysBack=5] - Dias no passado para o intervalo da busca.
 * @param {Object} [options.credentials] - Credenciais DocuSign para login se necessário.
 * @param {string} [options.sessionPath] - Caminho do storageState de sessão.
 * @returns {Promise<{success: boolean, repName: string, daysBack: number, totalFound: number, envelopes: Array<Object>, unknownStatuses: Array<Object>, queriedAt: string}>} Resultado consolidado.
 * @async
 */
export async function queryRepresentativeAgreementsPaginated(page, options = {}) {
  const { repName = "", daysBack = 5, credentials, sessionPath } = options;
  if (credentials) {
    await ensureAuthenticated(page, credentials, { sessionPath });
  }

  const baseUrl = selectors.agreements?.url || "https://apps.docusign.com/send/documents";
  const targetUrl = buildAgreementsUrl(daysBack, baseUrl);
  logger.step("Browser", `Consultando acordos na URL: ${targetUrl} (Representante: ${repName || "Todos"})...`);

  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 45000 });
  await randomDelay(1000, 2000);

  const postNavUrl = page.url();
  if (isAuthenticationUrl(postNavUrl)) {
    logger.warn("Browser", `Redirecionamento para login detectado durante consulta de acordos (${postNavUrl}). Reautenticando...`);
    if (credentials) {
      await ensureAuthenticated(page, credentials, { sessionPath });
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 45000 });
    }
  }

  const allEnvelopes = [];
  const allUnknownStatuses = [];
  let pageIndex = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    logger.step("Browser", `Extraindo acordos da página ${pageIndex}...`);
    if (selectors.agreements?.table) {
      await page.waitForSelector(selectors.agreements.table, { timeout: 15000 }).catch(() => null);
    }

    const pageResult = await extractPageEnvelopeRows(page, repName);
    allEnvelopes.push(...pageResult.envelopes);
    allUnknownStatuses.push(...pageResult.unknownStatuses);

    const nextBtn = await page.$(selectors.agreements?.pagination_next || "button[data-qa='manage-envelopes-list.footer.pagination-pagination-next']");
    if (!nextBtn) {
      logger.step("Browser", "Botão de paginação não encontrado. Encerrando navegação.");
      break;
    }

    const isDisabled = await nextBtn.evaluate((el) => {
      return (
        el.disabled ||
        el.getAttribute("disabled") !== null ||
        el.getAttribute("aria-disabled") === "true" ||
        el.classList.contains("disabled") ||
        el.classList.contains("css-30cpj5")
      );
    }).catch(() => true);

    if (isDisabled) {
      logger.step("Browser", `Última página alcançada (Página ${pageIndex}). Botão de próxima página desabilitado.`);
      hasNextPage = false;
    } else {
      logger.step("Browser", `Avançando para a página ${pageIndex + 1}...`);
      await nextBtn.click();
      await randomDelay(1500, 3000);
      pageIndex++;
    }
  }

  if (sessionPath) {
    await saveSessionState(page, sessionPath);
  }

  logger.success("Browser", `Consulta de acordos finalizada com sucesso! Total de envelopes encontrados: ${allEnvelopes.length}`);
  return {
    success: true,
    repName,
    daysBack,
    totalFound: allEnvelopes.length,
    envelopes: allEnvelopes,
    unknownStatuses: allUnknownStatuses,
    queriedAt: new Date().toISOString(),
  };
}

/** Alias retrocompatível */
export const fetchAgreementsByRepresentative = queryRepresentativeAgreementsPaginated;

export default queryRepresentativeAgreementsPaginated;
