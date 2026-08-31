/**
 * @file Serviço dedicado à execução de ações de contrato utilizando a API oficial do DocuSign.
 * Desacopla as chamadas de API do orquestrador de execução de jobs.
 */

import docusignService from "../../../services/docusignService.js";

/**
 * Executa uma ação utilizando o serviço de API oficial do DocuSign.
 *
 * @param {string} action - Ação solicitada ('send', 'status', 'download', 'resend').
 * @param {Object} [contract] - Dados do contrato.
 * @param {Object} [options={}] - Parâmetros adicionais (arquivos, URLs, destinatário, envelopeId).
 * @returns {Promise<*>} Retorno da operação oficial de API.
 * @throws {Error} Lança erro caso a ação não seja suportada.
 */
export async function executeApiAction(action, contract, options = {}) {
  const envelopeId = options.envelopeId || contract?.envelopeId || contract?.docusign_envelope_id;
  const signer = options.signer || {
    name:
      options.recipientName ||
      contract?.client?.representante?.nome ||
      contract?.signer?.name ||
      contract?.name ||
      contract?.clientName,
    email:
      options.recipientEmail ||
      contract?.client?.representante?.email ||
      contract?.signer?.email ||
      contract?.email ||
      contract?.clientEmail,
    cpf:
      options.cpf ||
      contract?.client?.representante?.cpf ||
      contract?.signer?.cpf ||
      contract?.cpf,
  };
  const pdfFiles = options.pdfFiles || options.files || [];
  const callbackUrl = options.callbackUrl;

  switch (action) {
    case "send":
      if (typeof docusignService.sendEnvelope === "function") {
        return await docusignService.sendEnvelope(signer, pdfFiles, callbackUrl);
      }
      break;
    case "status":
      if (typeof docusignService.getEnvelopeStatus === "function") {
        return await docusignService.getEnvelopeStatus(envelopeId);
      }
      break;
    case "download":
      if (typeof docusignService.getSignedDocuments === "function") {
        return await docusignService.getSignedDocuments(envelopeId);
      }
      break;
    case "resend":
      if (typeof docusignService.resendEnvelope === "function") {
        return await docusignService.resendEnvelope(envelopeId);
      }
      break;
  }

  if (typeof docusignService[action] === "function") {
    return await docusignService[action](envelopeId || signer, options);
  }

  throw new Error(`Ação '${action}' não é suportada pelo docusignService.`);
}

export default {
  executeApiAction,
};
