import { resolveSelectors } from "./stepUtils.js";

/**
 * Navega para a seção de relatórios/analytics da DocuSign e extrai métricas de desempenho.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [options={}] - Parâmetros opcionais de consulta de relatório (ex: startDate, endDate).
 * @returns {Promise<{totalSent: number, totalCompleted: number, totalPending: number, options: Object}>} Objeto contendo métricas coletadas.
 * @throws {Error} Lança erro caso page não seja informada.
 */
export async function extractReports(page, options = {}) {
  if (!page) {
    throw new Error("Page instance is required for reports operation");
  }

  const selectors = resolveSelectors();
  const repSel = selectors.reports || {};
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  const reportsUrl = repSel.url || `${baseUrl}/reports`;

  if (typeof page.goto === "function") {
    await page.goto(reportsUrl);
  }

  let totalSent = 0;
  let totalCompleted = 0;
  let totalPending = 0;

  if (repSel.total_sent && typeof page.textContent === "function") {
    const text = await page.textContent(repSel.total_sent).catch(() => "0");
    totalSent = parseInt(text || "0", 10) || 0;
  }

  if (repSel.total_completed && typeof page.textContent === "function") {
    const text = await page.textContent(repSel.total_completed).catch(() => "0");
    totalCompleted = parseInt(text || "0", 10) || 0;
  }

  if (repSel.total_pending && typeof page.textContent === "function") {
    const text = await page.textContent(repSel.total_pending).catch(() => "0");
    totalPending = parseInt(text || "0", 10) || 0;
  }

  return {
    totalSent,
    totalCompleted,
    totalPending,
    options,
  };
}
