import fs from "node:fs";
import logger from "../../utils/logger.js";
import { randomDelay, captureDebugScreenshot } from "./stepUtils.js";

/**
 * Executa o Passo 1 do envio: Upload do arquivo PDF na interface DocuSign Prepare.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {string} pdfPath - Caminho local do arquivo PDF do contrato.
 * @param {Object} sendSel - Seletores de envio da DocuSign.
 * @returns {Promise<void>}
 * @throws {Error} Caso o arquivo não exista ou o campo de upload não seja renderizado.
 */
export async function executeUploadStep(page, pdfPath, sendSel) {
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    throw new Error(`Arquivo PDF do contrato não encontrado localmente: ${pdfPath}`);
  }

  const ext = pdfPath.split(".").pop()?.toLowerCase();
  if (ext !== "pdf") {
    throw new Error(`Extensão de arquivo inválida para upload: .${ext || "desconhecida"}. Somente arquivos .pdf são aceitos.`);
  }

  const prepareUrl = sendSel?.url || "https://apps.docusign.com/send/prepare/";
  logger.step("Browser", `Navegando para a página de preparação de envelope: ${prepareUrl}`);

  await page.goto(prepareUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await randomDelay(1500, 3000);

  // Aguarda presença de indicador de upload ou do próprio input[type='file']
  const fileInputSelector = sendSel?.file_input || "input[type='file']";
  const dropIconSelector = sendSel?.drop_icon || "svg[data-qa='file-drop-zone-text-image']";
  const uploadButtonSelector = sendSel?.upload_button || "button[data-qa='upload-file-button']";

  logger.step("Browser", "Aguardando container de upload da DocuSign ficar disponível...");
  const uploadContainerSelector = [fileInputSelector, dropIconSelector, uploadButtonSelector].join(", ");
  try {
    await page.locator(uploadContainerSelector).first().waitFor({ state: "attached", timeout: 30000 });
  } catch (timeoutErr) {
    await captureDebugScreenshot(page, "upload_timeout");
    throw new Error(`Tempo limite de 30s excedido aguardando tela de upload (${page.url()}): ${timeoutErr.message}`);
  }

  logger.step("Browser", `Anexando arquivo PDF do contrato: ${pdfPath}`);
  const inputLocator = page.locator(fileInputSelector).first();
  await inputLocator.setInputFiles(pdfPath);

  const baseName = pdfPath.split(/[\\/]/).pop() || "";
  const rawPrefix = baseName.replace(/\.pdf$/i, "").slice(0, 15).trim();
  const escapedPrefix = rawPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  logger.step("Browser", `Aguardando processamento e confirmação visual do documento (${baseName})...`);
  let confirmedBranch = null;
  try {
    const promises = [
      page
        .locator("[data-qa*='document'], [data-qa*='file-name']")
        .first()
        .waitFor({ state: "visible", timeout: 25000 })
        .then(() => "attribute"),
    ];

    if (rawPrefix.length > 0) {
      const textPromise = (
        typeof page.getByText === "function"
          ? page.getByText(new RegExp(escapedPrefix, "i")).first()
          : page.locator(`text=/${escapedPrefix}/i`).first()
      )
        .waitFor({ state: "visible", timeout: 25000 })
        .then(() => "text");

      promises.push(textPromise);
    }

    confirmedBranch = await Promise.any(promises);
  } catch {
    confirmedBranch = null;
  }

  if (!confirmedBranch) {
    await captureDebugScreenshot(page, "upload_process_fail");
    throw new Error(`Falha no processamento do documento após upload (${baseName}): elemento ou card de documento não visível no tempo limite de 25s.`);
  }

  logger.step("Browser", `Confirmação visual pós-upload obtida com sucesso via ${confirmedBranch === "attribute" ? "card por atributo" : "texto do documento"}.`);
  await randomDelay(2000, 4000);

  logger.success("Browser", "Arquivo PDF anexado e confirmado com sucesso na DocuSign.");
}
