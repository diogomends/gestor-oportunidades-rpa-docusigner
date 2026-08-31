import fs from "node:fs";
import path from "node:path";
import { assertPage, navigateToEnvelope, resolveSelectors } from "./stepUtils.js";

/**
 * Navega para a página do envelope concluído, aciona o evento de download e salva o arquivo PDF em disco com proteção contra path traversal.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador do envelope a ser baixado.
 * @param {string} downloadDir - Caminho do diretório de destino para salvar o arquivo PDF.
 * @param {string} [fileName] - Nome customizado para o arquivo baixado.
 * @param {Object} [selectors] - Seletores pré-resolvidos opcionais.
 * @returns {Promise<string>} Caminho completo do arquivo PDF salvo localmente.
 * @throws {Error} Lança erro caso page, envelopeId ou downloadDir não sejam válidos ou se o download falhar.
 */
export async function downloadDocument(page, envelopeId, downloadDir, fileName, selectors) {
  assertPage(page);

  if (!downloadDir || typeof downloadDir !== "string" || !downloadDir.trim()) {
    throw new Error("Diretório de download (downloadDir) inválido fornecido.");
  }

  const resolvedDir = path.resolve(downloadDir.trim());
  const ALLOWED_ROOT = path.resolve(process.cwd(), "uploads");
  if (resolvedDir !== ALLOWED_ROOT && !resolvedDir.startsWith(ALLOWED_ROOT + path.sep)) {
    throw new Error(`Diretório de download fora da raiz permitida (uploads): "${resolvedDir}".`);
  }
  await fs.promises.mkdir(resolvedDir, { recursive: true });

  const resolvedSelectors = selectors || resolveSelectors();
  const dlSel = resolvedSelectors.download || {};

  await navigateToEnvelope(page, envelopeId, resolvedSelectors);

  const rawFileName = fileName || `contrato_assinado_${envelopeId}.pdf`;
  const sanitizedFileName = path.basename(rawFileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const targetPath = path.join(resolvedDir, sanitizedFileName);

  if (targetPath !== resolvedDir && !targetPath.startsWith(resolvedDir + path.sep)) {
    throw new Error(`Tentativa de path traversal detectada no salvamento do arquivo: "${targetPath}".`);
  }

  const downloadButton = dlSel.download_button || "button[data-testid='download-button'], a[data-action='download']";

  if (typeof page.waitForEvent === "function" && typeof page.click === "function") {
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await page.click(downloadButton);
    const downloadEvent = await downloadPromise;

    if (downloadEvent && typeof downloadEvent.saveAs === "function") {
      await downloadEvent.saveAs(targetPath);
      return targetPath;
    }
  }

  throw new Error(
    "Download do documento não capturado ou não salvo com sucesso. Verifique se o navegador foi iniciado com acceptDownloads: true e se os seletores estão corretos."
  );
}
