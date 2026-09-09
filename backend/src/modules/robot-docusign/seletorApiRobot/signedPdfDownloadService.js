/**
 * @file Serviço de download e persistência em disco de contratos assinados via DocuSign.
 * Responsável pelo fluxo de verificação de arquivos, download via browserrobot e atualização do contrato.
 * Aplica os princípios SOLID (SRP) e PonyTail.
 */

import fs from "node:fs";
import path from "node:path";
import browserrobot from "../browserrobot/index.js";
import { syncContractStatus, buildDownloadPath } from "./contractSyncService.js";

/**
 * Realiza o download do PDF assinado e atualiza o contrato com o caminho do arquivo baixado.
 *
 * @param {Record<string, any>} contract - Dados do contrato.
 * @param {Record<string, any>} matchedEnvelope - Envelope correspondente da DocuSign.
 * @param {Record<string, any>} config - Configuração ativa do robô.
 * @param {string} contractId - Identificador do contrato.
 * @returns {Promise<boolean>} True se o download foi concluído ou o arquivo já existia, false caso contrário.
 * @async
 */
export async function handleSignedContractDownload(contract, matchedEnvelope, config, contractId) {
  if (!matchedEnvelope.envelopeId || config.operations?.download === false) {
    return false;
  }

  try {
    const paths = buildDownloadPath(contract, matchedEnvelope.envelopeId);
    const fullFilePath = path.join(paths.downloadDir, paths.fileName);

    if (fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).size > 0) {
      console.log(`[statusSyncScheduler] PDF já existe e está salvo em: ${paths.relativePath}`);
      await syncContractStatus(contractId, "assinado", {
        envelopeId: matchedEnvelope.envelopeId,
        signedDocPath: paths.relativePath,
      });
      return true;
    }

    console.log(`[statusSyncScheduler] Baixando PDF assinado para o contrato ${contractId}...`);
    const dlResult = await browserrobot.executeWithBrowser("download", {
      envelopeId: matchedEnvelope.envelopeId,
      downloadDir: paths.downloadDir,
      fileName: paths.fileName,
      credentials: {
        ...config.credentials,
        token_notification_email: config.token_notification_email,
        mfa: config.mfa,
      },
    });

    if (dlResult !== null && dlResult !== undefined) {
      console.log(`[statusSyncScheduler] PDF assinado salvo com sucesso em: ${paths.relativePath}`);
      await syncContractStatus(contractId, "assinado", {
        envelopeId: matchedEnvelope.envelopeId,
        signedDocPath: paths.relativePath,
      });
      return true;
    }

    if (fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).size > 0) {
      console.log(`[statusSyncScheduler] PDF assinado salvo com sucesso em: ${paths.relativePath}`);
      await syncContractStatus(contractId, "assinado", {
        envelopeId: matchedEnvelope.envelopeId,
        signedDocPath: paths.relativePath,
      });
      return true;
    }
  } catch (dlErr) {
    console.error(`[statusSyncScheduler] Erro ao baixar PDF assinado do contrato ${contractId}:`, dlErr.message);
  }

  return false;
}

export default {
  handleSignedContractDownload,
};
