/**
 * @file Função utilitária para extração das linhas de envelopes da página atual na tabela de acordos do DocuSign.
 */

import { normalizeSearchText } from "./normalizeSearchText.js";
import { normalizeDocusignEnvelopeStatus } from "./normalizeDocusignEnvelopeStatus.js";

/**
 * Extrai os envelopes da página atual da tabela de acordos no DocuSign.
 *
 * @param {import('playwright').Page|Object} page - Instância de página do Playwright.
 * @param {string} [repName=""] - Nome do representante para filtro.
 * @returns {Promise<{envelopes: Array<Object>, unknownStatuses: Array<Object>}>} Lista de envelopes extraídos e status desconhecidos.
 * @async
 */
export async function extractPageEnvelopeRows(page, repName = "") {
  if (!page || typeof page.$$ !== "function") {
    return { envelopes: [], unknownStatuses: [] };
  }

  const normalizedTargetRep = normalizeSearchText(repName);
  const rows = await page
    .$$(
      "tbody[data-qa='manage-envelopes-list.body'] tr, tr[data-qa^='manage-envelopes-list.row.'], tr[data-testid='envelope-row']"
    )
    .catch(() => []);
  const envelopes = [];
  const unknownStatuses = [];

  for (const row of rows) {
    const fromEl =
      (await row.$("[data-qa$='-mobile-from']").catch(() => null)) ||
      (await row.$("td:nth-child(2) [data-qa$='-mobile-from']").catch(() => null)) ||
      (await row.$("td:nth-child(2)").catch(() => null));
    const rawFromText = fromEl && typeof fromEl.innerText === "function" ? (await fromEl.innerText()).trim() : "";
    const rawFrom = rawFromText.replace(/^(para|to):\s*/i, "").trim();
    const normalizedFrom = normalizeSearchText(rawFrom);

    if (normalizedTargetRep && !normalizedFrom.includes(normalizedTargetRep)) {
      continue;
    }

    const statusEl =
      (await row.$("[data-qa$='-status-status']").catch(() => null)) ||
      (await row.$("[data-qa$='-mobile-status']").catch(() => null)) ||
      (await row.$(".status-badge, [data-testid='status-badge']").catch(() => null));
    const rawStatus = statusEl && typeof statusEl.innerText === "function" ? (await statusEl.innerText()).trim() : "";

    const normalizedStatusObj = normalizeDocusignEnvelopeStatus(rawStatus);
    if (normalizedStatusObj.unknown_status && rawStatus) {
      unknownStatuses.push({
        rawStatus,
        recipient: rawFrom,
      });
    }

    const rowDataQa = typeof row.getAttribute === "function" ? (await row.getAttribute("data-qa").catch(() => "")) : "";
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
      statusDetail: normalizedStatusObj.statusDetail,
      pendingSigner: normalizedStatusObj.pendingSigner,
      unknown_status: normalizedStatusObj.unknown_status,
      extractedAt: new Date().toISOString(),
    });
  }

  return { envelopes, unknownStatuses };
}

/** Alias retrocompatível */
export const extractEnvelopesFromCurrentPage = extractPageEnvelopeRows;

export default extractPageEnvelopeRows;
