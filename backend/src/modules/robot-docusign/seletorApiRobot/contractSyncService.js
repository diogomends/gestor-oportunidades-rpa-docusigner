/**
 * @file Serviço dedicado à sincronização de status de contratos e formatação de diretórios de arquivos.
 * Aplica o Princípio de Responsabilidade Única (SRP) e desacopla a persistência externa do orquestrador.
 */

import path from "node:path";
import Contract from "../../../models/Contract.js";
import gestorApiClient from "../../../services/gestorApiClient.js";

/**
 * Atualiza o status do contrato de forma desacoplada via GestorApiClient com fallback para Mongoose.
 *
 * @param {string} contractId - Identificador único do contrato.
 * @param {string} status - Novo status a ser atribuído ('enviado', 'assinado', etc.).
 * @param {Object} [extraPayload={}] - Dados adicionais para sincronização (ex: envelopeId).
 * @returns {Promise<void>}
 */
export async function syncContractStatus(contractId, status, extraPayload = {}) {
  if (!contractId) return;

  // 1. Tenta atualizar via GestorApiClient (HTTP desacoplado) — sempre tenta para compatibilidade com mocks de teste
  try {
    await gestorApiClient.updateContractStatus(contractId, {
      status,
      ...extraPayload,
    });
  } catch (apiErr) {
    console.warn(
      `[contractSyncService] GestorApiClient falhou para ${contractId}: ${apiErr?.message || apiErr}. Tentando fallback Mongoose.`
    );
  }

  // 2. Fallback direto via Mongoose caso o cliente HTTP não esteja configurado ou falhe
  try {
    await Contract.findByIdAndUpdate(contractId, { status, ...extraPayload });
  } catch (cErr) {
    console.error(
      `[contractSyncService] Erro ao atualizar status do contrato para ${status} via Mongoose:`,
      cErr.message
    );
  }
}

/**
 * Constrói o caminho de diretório e nome de arquivo padrão para download de PDFs assinados.
 *
 * @param {Object} [contractObj] - Objeto com os metadados do contrato.
 * @param {string} [envelopeId="doc"] - Identificador do envelope DocuSign.
 * @returns {{ downloadDir: string, fileName: string, relativePath: string }} Informações formatadas de caminho de download.
 */
export function buildDownloadPath(contractObj, envelopeId = "doc") {
  const cnpj = (contractObj?.client?.cnpj || "").replace(/\D/g, "");
  const razao = (contractObj?.client?.razaoSocial || "empresa").replace(/[^a-zA-Z0-9]/g, "_");
  const envId = envelopeId || contractObj?.envelopeId || contractObj?.docusign_envelope_id || "doc";
  const downloadDir = path.join("uploads", `${cnpj}_${razao}`).replace(/\\/g, "/");
  const fileName = `contrato_assinado_${envId}.pdf`;
  const relativePath = `${downloadDir}/${fileName}`;

  return { downloadDir, fileName, relativePath };
}

export default {
  syncContractStatus,
  buildDownloadPath,
};
