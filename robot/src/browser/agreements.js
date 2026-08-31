import selectors, { buildAgreementsUrl } from "./selectors.js";
import { normalizeText, normalizeEnvelopeStatus } from "./statusParser.js";
import { ensureAuthenticated, saveSessionState, randomDelay, isAuthenticationUrl } from "./auth.js";
import logger from "../utils/logger.js";

/**
 * Extrai todos os envelopes correspondentes da página atual da tabela de acordos.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {string} [repName=""] - Nome do representante para filtro no campo "Para:".
 * @returns {Promise<{envelopes: Array<Object>, unknownStatuses: Array<Object>}>} Envelopes extraídos e lista de status desconhecidos.
 */
export async function extractEnvelopesFromCurrentPage(page, repName = "") {
  if (!page) {
    return { envelopes: [], unknownStatuses: [] };
  }

  const normalizedTargetRep = normalizeText(repName);
  const rows = await page.$$(
    selectors.agreements?.row || "tbody[data-qa='manage-envelopes-list.body'] tr, tr[data-qa^='manage-envelopes-list.row.']"
  );
  const envelopes = [];
  const unknownStatuses = [];

  for (const row of rows) {
    const fromEl =
      (await row.$(selectors.agreements?.from_recipient || "[data-qa$='-mobile-from']")) ||
      (await row.$("td:nth-child(2) [data-qa$='-mobile-from']").catch(() => null)) ||
      (await row.$("td:nth-child(2)").catch(() => null));
    const rawFromText = fromEl ? (await fromEl.innerText()).trim() : "";
    const rawFrom = rawFromText.replace(/^(para|to):\s*/i, "").trim();
    const normalizedFrom = normalizeText(rawFrom);

    if (normalizedTargetRep && !normalizedFrom.includes(normalizedTargetRep)) {
      continue;
    }

    const statusEl =
      (await row.$("[data-qa$='-status-status']")) ||
      (await row.$("[data-qa$='-mobile-status']")) ||
      (await row.$(selectors.status?.status_badge || ".status-badge"));
    const rawStatus = statusEl ? (await statusEl.innerText()).trim() : "";

    const normalizedStatusObj = normalizeEnvelopeStatus(rawStatus);

    if (normalizedStatusObj.unknown_status && rawStatus) {
      unknownStatuses.push({
        rawStatus,
        recipient: rawFrom,
      });
    }

    const rowDataQa = typeof row.getAttribute === "function" ? await row.getAttribute("data-qa").catch(() => "") : "";
    const rowIdMatch = rowDataQa ? rowDataQa.match(/manage-envelopes-list\.row\.([a-zA-Z0-9-]+)/i) : null;

    const subjectEl =
      (await row.$("button[data-qa$='-mobile-name']").catch(() => null)) ||
      (await row.$("[data-qa$='-mobile-name-text']").catch(() => null)) ||
      (await row.$("[data-qa$='-subject']").catch(() => null)) ||
      (await row.$("a[data-qa*='envelope-']").catch(() => null)) ||
      (await row.$("a").catch(() => null));
    const subject = subjectEl && typeof subjectEl.innerText === "function" ? (await subjectEl.innerText()).trim() : "";

    let envelopeId = rowIdMatch ? rowIdMatch[1] : null;
    if (!envelopeId) {
      const href = subjectEl && typeof subjectEl.getAttribute === "function" ? await subjectEl.getAttribute("href").catch(() => "") : "";
      const idMatch = href ? href.match(/\/documents\/details\/([a-zA-Z0-9-]+)/i) || href.match(/\/documents\/([a-zA-Z0-9-]+)/i) : null;
      envelopeId = idMatch ? idMatch[1] : null;
    }

    envelopes.push({
      recipient: rawFrom,
      subject,
      envelopeId,
      status: normalizedStatusObj.status,
      rawStatus: normalizedStatusObj.rawStatus,
      unknown_status: normalizedStatusObj.unknown_status,
      extractedAt: new Date().toISOString(),
    });
  }

  return { envelopes, unknownStatuses };
}

/**
 * Consulta e extrai todos os acordos destinados a um representante navegando paginadamente até o fim.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {Object} [options={}] - Parâmetros da consulta.
 * @param {string} [options.repName=""] - Nome do representante para filtragem.
 * @param {number} [options.daysBack=5] - Dias no passado para o intervalo da busca.
 * @param {Object} [options.credentials] - Credenciais DocuSign para login se necessário.
 * @param {string} [options.sessionPath] - Caminho do storageState de sessão.
 * @returns {Promise<{success: boolean, repName: string, daysBack: number, totalFound: number, envelopes: Array<Object>, unknownStatuses: Array<Object>, queriedAt: string}>} Resultado consolidado.
 */
export async function fetchAgreementsByRepresentative(page, options = {}) {
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

    const pageResult = await extractEnvelopesFromCurrentPage(page, repName);
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

export default {
  extractEnvelopesFromCurrentPage,
  fetchAgreementsByRepresentative,
};
