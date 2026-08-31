import { assertPage, resolveSelectors } from "./stepUtils.js";

/**
 * Navega para a seção de relatórios/analytics da DocuSign e extrai métricas de desempenho de forma declarativa e resiliente.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [options={}] - Parâmetros opcionais de consulta de relatório.
 * @param {Object} [selectors] - Seletores pré-resolvidos opcionais.
 * @returns {Promise<{totalSent: number, totalCompleted: number, totalPending: number}>} Objeto contendo métricas coletadas.
 * @throws {Error} Lança erro caso page não seja informada ou seja inválida.
 */
export async function extractReports(page, options = {}, selectors) {
  assertPage(page);

  const resolvedSelectors = selectors || resolveSelectors();
  const repSel = resolvedSelectors.reports || {};
  const baseUrl = resolvedSelectors.baseUrl || "https://app.docusign.com";
  const reportsUrl = repSel.url || `${baseUrl}/reports`;

  await page.goto(reportsUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  const metricMapping = {
    totalSent: repSel.total_sent,
    totalCompleted: repSel.total_completed,
    totalPending: repSel.total_pending,
  };

  const metrics = {
    totalSent: 0,
    totalCompleted: 0,
    totalPending: 0,
  };

  for (const [key, sel] of Object.entries(metricMapping)) {
    if (sel && typeof page.textContent === "function") {
      if (typeof page.waitForSelector === "function") {
        await page.waitForSelector(sel, { timeout: 8000 }).catch(() => null);
      }
      const rawText = await page.textContent(sel).catch(() => "0");
      const cleanNumber = Number(String(rawText || "").replace(/[^\d]/g, "")) || 0;
      metrics[key] = cleanNumber;
    }
  }

  return metrics;
}
