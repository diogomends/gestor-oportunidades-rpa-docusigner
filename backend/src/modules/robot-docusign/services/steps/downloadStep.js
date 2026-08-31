import fs from "node:fs";
import path from "node:path";
import { resolveSelectors } from "./stepUtils.js";

/**
 * Navega para a página do envelope concluído, aciona o evento de download e salva o arquivo PDF em disco.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador do envelope a ser baixado.
 * @param {string} downloadDir - Caminho do diretório de destino para salvar o arquivo PDF.
 * @param {string} [fileName] - Nome customizado para o arquivo baixado.
 * @returns {Promise<string>} Caminho completo do arquivo PDF salvo localmente.
 * @throws {Error} Lança erro caso page, envelopeId ou downloadDir não sejam informados.
 */
export async function downloadDocument(page, envelopeId, downloadDir, fileName) {
  if (!page || !envelopeId || !downloadDir) {
    throw new Error("Page, envelopeId, and downloadDir are required for download operation");
  }

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const selectors = resolveSelectors();
  const dlSel = selectors.download || {};
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  const envelopeUrl = `${baseUrl}/documents/${envelopeId}`;

  if (typeof page.goto === "function") {
    await page.goto(envelopeUrl);
  }

  const pdfFileName = fileName || `contrato_assinado_${envelopeId}.pdf`;
  const targetPath = path.join(downloadDir, pdfFileName);

  if (typeof page.waitForEvent === "function" && typeof page.click === "function") {
    const downloadPromise = page.waitForEvent("download");
    await page.click(dlSel.download_button || "button[data-testid='download-button']");
    const downloadEvent = await downloadPromise;

    if (downloadEvent && typeof downloadEvent.saveAs === "function") {
      await downloadEvent.saveAs(targetPath);
      return targetPath;
    }
  }

  if (typeof page.click === "function" && dlSel.download_button) {
    await page.click(dlSel.download_button);
  }

  return targetPath;
}
