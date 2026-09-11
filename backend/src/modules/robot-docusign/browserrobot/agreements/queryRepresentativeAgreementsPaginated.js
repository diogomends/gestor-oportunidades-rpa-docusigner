/**
 * @file Função utilitária para consulta paginada de acordos por representante no DocuSign via Playwright.
 */

import { getSelectors } from "../robotSelectors.js";
import { assertPage, isLoginUrl } from "../steps/stepUtils.js";
import robotSession from "../robotSession.js";
import { buildAgreementsFilterUrl } from "./buildAgreementsFilterUrl.js";
import { extractPageEnvelopeRows } from "./extractPageEnvelopeRows.js";

/**
 * Consulta e extrai todos os acordos destinados a um representante navegando paginadamente até a última página.
 *
 * @param {import('playwright').Page|Object} page - Instância de página do Playwright.
 * @param {Object} [options={}] - Parâmetros da consulta (repName, daysBack, credentials).
 * @param {string} [options.repName=""] - Nome do representante para filtragem.
 * @param {number} [options.daysBack=5] - Dias no passado para o intervalo da busca.
 * @param {Object} [options.credentials] - Credenciais DocuSign para login se necessário.
 * @returns {Promise<{success: boolean, repName: string, daysBack: number, totalFound: number, envelopes: Array<Object>, unknownStatuses: Array<Object>, queriedAt: string}>} Resultado consolidado.
 * @async
 */
export async function queryRepresentativeAgreementsPaginated(page, options = {}) {
  assertPage(page);

  const { repName = "", daysBack = 5, credentials } = options;
  const selectors = getSelectors();

  const baseUrl = selectors.dashboard?.url || "https://apps.docusign.com/send/documents";
  const targetUrl = buildAgreementsFilterUrl(daysBack, baseUrl);

  try {
    const parsed = new URL(targetUrl);
    const isAllowedHost = parsed.hostname.endsWith("docusign.com") || parsed.hostname.endsWith("docusign.net");
    if (!isAllowedHost) {
      throw new Error(`URL de destino fora do domínio permitido da DocuSign: "${targetUrl}".`);
    }
  } catch (urlErr) {
    if (urlErr.message.includes("domínio permitido")) throw urlErr;
    throw new Error(`URL de destino inválida: "${targetUrl}".`);
  }

  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

  const postNavUrl = typeof page.url === "function" ? page.url() : "";
  if (isLoginUrl(postNavUrl) && credentials?.email && credentials?.password) {
    const ctx = typeof page.context === "function" ? page.context() : null;
    await robotSession.loginAndSaveSession(page, ctx, credentials, selectors.login || {});
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  }

  const allEnvelopes = [];
  const allUnknownStatuses = [];
  let pageIndex = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    if (typeof page.waitForSelector === "function") {
      await page
        .waitForSelector("[data-qa='manage-envelopes-list.table'], tr[data-testid='envelope-row']", { timeout: 15000 })
        .catch(() => null);
    }

    const pageResult = await extractPageEnvelopeRows(page, repName);
    allEnvelopes.push(...pageResult.envelopes);
    allUnknownStatuses.push(...pageResult.unknownStatuses);

    const nextBtn =
      (await page.$("button[data-qa='manage-envelopes-list.footer.pagination-pagination-next']").catch(() => null)) ||
      (await page.$("button[data-testid='pagination-next']").catch(() => null));

    if (!nextBtn) {
      break;
    }

    const isDisabled = await nextBtn
      .evaluate((el) => {
        return (
          el.disabled ||
          el.getAttribute("disabled") !== null ||
          el.getAttribute("aria-disabled") === "true" ||
          el.classList.contains("disabled")
        );
      })
      .catch(() => true);

    if (isDisabled) {
      hasNextPage = false;
    } else {
      await nextBtn.click().catch(() => {
        hasNextPage = false;
      });
      pageIndex++;
      if (typeof page.waitForTimeout === "function") {
        await page.waitForTimeout(2000);
      }
    }
  }

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
