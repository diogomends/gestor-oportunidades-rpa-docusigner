import { assertPage, navigateToEnvelope, resolveSelectors } from "./stepUtils.js";

/**
 * Lista de status conhecidos e válidos para envelopes DocuSign.
 * @constant {string[]}
 */
export const VALID_ENVELOPE_STATUSES = [
  "sent",
  "delivered",
  "signed",
  "completed",
  "voided",
  "declined",
  "correcting",
  "draft",
  "created",
  "processing",
];

/**
 * Navega para o dashboard ou detalhes do envelope e consulta o seu status atual na plataforma DocuSign.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador único do envelope DocuSign.
 * @param {Object} [selectors] - Seletores opcionais pré-resolvidos.
 * @returns {Promise<string>} Status atual do envelope (ex: 'sent', 'delivered', 'signed', 'completed', 'unknown').
 * @throws {Error} Lança erro caso page ou envelopeId não sejam válidos.
 */
export async function checkStatus(page, envelopeId, selectors) {
  assertPage(page);

  const resolvedSelectors = selectors || resolveSelectors();
  const statusSel = resolvedSelectors.status || {};
  const dashSel = resolvedSelectors.dashboard || {};

  await navigateToEnvelope(page, envelopeId, resolvedSelectors);

  const targetSelector = statusSel.status_badge || dashSel.status_badge;
  let rawStatus = "";

  if (targetSelector) {
    await page.waitForSelector(targetSelector, { timeout: 10000 }).catch(() => null);
    rawStatus = (await page.textContent(targetSelector).catch(() => "")) || "";
  }

  const normalizedStatus = rawStatus.trim().toLowerCase();
  if (normalizedStatus && VALID_ENVELOPE_STATUSES.includes(normalizedStatus)) {
    return normalizedStatus;
  }

  if (normalizedStatus) {
    console.warn(`[robot-docusign:statusStep] Status não reconhecido encontrado na UI ("${normalizedStatus}"). Retornando "unknown".`);
  }

  return "unknown";
}
