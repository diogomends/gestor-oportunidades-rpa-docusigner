/**
 * @file Serviço backend nativo para consulta e extração paginada de acordos/documentos DocuSign via Playwright.
 * Desacoplado do robô standalone para evitar problemas de dependência em ambiente Docker.
 */

import { getSelectors } from "./robotSelectors.js";
import { assertPage, isLoginUrl } from "./steps/stepUtils.js";
import robotSession from "./robotSession.js";

/**
 * Normaliza strings de texto removendo espaços extras e acentos para comparação insensível.
 *
 * @param {string} [text=""] - Texto original.
 * @returns {string} Texto normalizado em caixa baixa.
 */
function normalizeText(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Normaliza o status bruto extraído da interface DocuSign para status canônico da aplicação.
 *
 * @param {string} [rawStatus=""] - Texto bruto do status obtido da UI.
 * @returns {{ status: string, rawStatus: string, unknown_status: boolean }} Objeto com status normalizado e indicação de desconhecido.
 */
function normalizeEnvelopeStatus(rawStatus = "") {
  const clean = normalizeText(rawStatus);
  const statusMap = {
    assinado: "completed",
    concluido: "completed",
    completed: "completed",
    signed: "completed",
    enviado: "sent",
    sent: "sent",
    entregue: "delivered",
    delivered: "delivered",
    recusado: "declined",
    declined: "declined",
    anulado: "voided",
    voided: "voided",
    expirado: "expired",
    expired: "expired",
    processando: "processing",
    processing: "processing",
    rascunho: "draft",
    draft: "draft",
  };

  const status = statusMap[clean] || "unknown";
  return {
    status,
    rawStatus: String(rawStatus || "").trim(),
    unknown_status: status === "unknown" && Boolean(clean),
  };
}

/**
 * Constrói a URL para a listagem de documentos/acordos no DocuSign com base no intervalo de dias.
 *
 * @param {number} [daysBack=5] - Quantidade de dias no passado a consultar.
 * @param {string} [baseUrl="https://apps.docusign.com/send/documents"] - URL base da listagem.
 * @returns {string} URL parametrizada.
 */
function buildAgreementsUrl(daysBack = 5, baseUrl = "https://apps.docusign.com/send/documents") {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - (Number(daysBack) || 5));
  const dateParam = fromDate.toISOString().split("T")[0];
  return `${baseUrl}?folder=all&from_date=${dateParam}`;
}

/**
 * Extrai os envelopes da página atual da tabela de acordos no DocuSign.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} [repName=""] - Nome do representante para filtro.
 * @returns {Promise<{envelopes: Array<Object>, unknownStatuses: Array<Object>}>}
 */
export async function extractEnvelopesFromCurrentPage(page, repName = "") {
  if (!page || typeof page.$$ !== "function") {
    return { envelopes: [], unknownStatuses: [] };
  }

  const normalizedTargetRep = normalizeText(repName);
  const rows = await page.$$("[data-qa='manage-envelopes-list.table'] tr, tr[data-testid='envelope-row']").catch(() => []);
  const envelopes = [];
  const unknownStatuses = [];

  for (const row of rows) {
    const fromEl = (await row.$("[data-qa$='-mobile-from']").catch(() => null)) || (await row.$("td:nth-child(3)").catch(() => null));
    const rawFrom = fromEl && typeof fromEl.innerText === "function" ? (await fromEl.innerText()).trim() : "";
    const normalizedFrom = normalizeText(rawFrom);

    if (normalizedTargetRep && !normalizedFrom.includes(normalizedTargetRep)) {
      continue;
    }

    const statusEl =
      (await row.$("[data-qa$='-status-status']").catch(() => null)) ||
      (await row.$("[data-qa$='-mobile-status']").catch(() => null)) ||
      (await row.$(".status-badge, [data-testid='status-badge']").catch(() => null));
    const rawStatus = statusEl && typeof statusEl.innerText === "function" ? (await statusEl.innerText()).trim() : "";

    const normalizedStatusObj = normalizeEnvelopeStatus(rawStatus);
    if (normalizedStatusObj.unknown_status && rawStatus) {
      unknownStatuses.push({
        rawStatus,
        recipient: rawFrom,
      });
    }

    const subjectEl =
      (await row.$("[data-qa$='-subject']").catch(() => null)) ||
      (await row.$("a[data-qa*='envelope-']").catch(() => null)) ||
      (await row.$("a").catch(() => null));
    const subject = subjectEl && typeof subjectEl.innerText === "function" ? (await subjectEl.innerText()).trim() : "";
    const href = subjectEl && typeof subjectEl.getAttribute === "function" ? await subjectEl.getAttribute("href").catch(() => "") : "";
    const idMatch = href ? href.match(/\/documents\/details\/([a-zA-Z0-9-]+)/i) || href.match(/\/documents\/([a-zA-Z0-9-]+)/i) : null;
    const envelopeId = idMatch ? idMatch[1] : null;

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
 * Consulta e extrai todos os acordos destinados a um representante navegando paginadamente até a última página.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [options={}] - Parâmetros da consulta (repName, daysBack, credentials).
 * @returns {Promise<{success: boolean, repName: string, daysBack: number, totalFound: number, envelopes: Array<Object>, unknownStatuses: Array<Object>, queriedAt: string}>}
 */
export async function fetchAgreementsByRepresentative(page, options = {}) {
  assertPage(page);

  const { repName = "", daysBack = 5, credentials } = options;
  const selectors = getSelectors();

  const baseUrl = selectors.dashboard?.url || "https://apps.docusign.com/send/documents";
  const targetUrl = buildAgreementsUrl(daysBack, baseUrl);

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

    const pageResult = await extractEnvelopesFromCurrentPage(page, repName);
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

export default {
  extractEnvelopesFromCurrentPage,
  fetchAgreementsByRepresentative,
};
