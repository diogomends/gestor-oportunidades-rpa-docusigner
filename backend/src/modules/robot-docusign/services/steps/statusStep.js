import { resolveSelectors } from "./stepUtils.js";

/**
 * Navega para o dashboard ou detalhes do envelope e consulta o seu status atual na plataforma DocuSign.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador único do envelope DocuSign.
 * @returns {Promise<string>} Status atual do envelope (ex: 'sent', 'delivered', 'signed', 'completed').
 * @throws {Error} Lança erro caso page ou envelopeId não sejam fornecidos.
 */
export async function checkStatus(page, envelopeId) {
  if (!page || !envelopeId) {
    throw new Error("Page and envelopeId are required for status operation");
  }

  const selectors = resolveSelectors();
  const dashSel = selectors.dashboard || {};
  const statusSel = selectors.status || {};
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  const envelopeUrl = `${dashSel.url || `${baseUrl}/documents`}/${envelopeId}`;

  if (typeof page.goto === "function") {
    await page.goto(envelopeUrl);
  }

  const targetSelector = statusSel.status_badge || dashSel.status_badge;
  let rawStatus = "";

  if (targetSelector && typeof page.textContent === "function") {
    rawStatus = (await page.textContent(targetSelector)) || "";
  }

  const normalizedStatus = rawStatus.trim().toLowerCase();
  return normalizedStatus || "sent";
}
