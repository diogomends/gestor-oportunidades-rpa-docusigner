import fs from "node:fs";
import path from "node:path";
import { assertPage, guardedAction } from "./stepUtils.js";

/**
 * Anexa o documento PDF na página de envio do DocuSign se o caminho for informado.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [sendSel={}] - Seletores da tela de envio.
 * @param {string} [documentPath] - Caminho absoluto ou relativo do arquivo PDF.
 * @param {string} [email] - E-mail do usuário para controle de sessão em caso de redirecionamento.
 * @returns {Promise<void>}
 * @throws {Error} Se o caminho for informado mas o arquivo não existir ou não for um PDF válido.
 */
export async function uploadDocument(page, sendSel = {}, documentPath, email) {
  assertPage(page);

  if (!documentPath) {
    return;
  }

  const resolvedPath = path.resolve(documentPath);
  const ALLOWED_ROOT = path.resolve(process.cwd(), "uploads");
  if (resolvedPath !== ALLOWED_ROOT && !resolvedPath.startsWith(ALLOWED_ROOT + path.sep)) {
    throw new Error(`Documento fora da raiz permitida (uploads): "${resolvedPath}".`);
  }
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Documento para upload não encontrado no caminho: "${resolvedPath}".`);
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext !== ".pdf") {
    throw new Error(`Extensão inválida para upload de contrato: "${ext}". Somente arquivos .pdf são aceitos.`);
  }

  const fileInputSelector = sendSel?.file_input;
  if (!fileInputSelector) {
    throw new Error("Seletor de input de arquivo (file_input) não configurado nos seletores.");
  }

  if (typeof page.setInputFiles === "function") {
    await guardedAction(() => page.setInputFiles(fileInputSelector, resolvedPath), page, email);
  }
}
