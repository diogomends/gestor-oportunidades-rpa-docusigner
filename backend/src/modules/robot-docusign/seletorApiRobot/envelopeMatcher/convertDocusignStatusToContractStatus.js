/**
 * @file Função utilitária para conversão do status de envelope DocuSign em status canônico do modelo Contract.
 * Aplica os princípios Anti-Phantom Success Hardening.
 */

import { normalizeComparisonText } from "./normalizeComparisonText.js";

/**
 * Mapeia o status do envelope extraído da DocuSign para o status canônico do modelo Contract.
 * Retorna null se o status não for reconhecido, for vazio ou rascunho, prevenindo alterações arbitrárias de estado (Anti-Phantom Success).
 *
 * @param {string} [envelopeStatus=""] - Status do envelope na DocuSign.
 * @returns {string|null} Status correspondente no modelo Contract ('enviado', 'assinado', 'cancelado') ou null se não reconhecido.
 */
export function convertDocusignStatusToContractStatus(envelopeStatus = "") {
  const normalized = normalizeComparisonText(envelopeStatus);
  switch (normalized) {
    case "completed":
    case "assinado":
    case "signed":
    case "concluido":
      return "assinado";
    case "declined":
    case "voided":
    case "expired":
    case "recusado":
    case "anulado":
    case "cancelado":
      return "cancelado";
    case "sent":
    case "delivered":
    case "processing":
    case "enviado":
    case "entregue":
    case "waiting_others":
    case "aguardando":
      return "enviado";
    default:
      if (normalized.startsWith("aguardando") || normalized.startsWith("waiting")) {
        return "enviado";
      }
      return null;
  }
}

/** Alias retrocompatível */
export const mapEnvelopeStatusToContractStatus = convertDocusignStatusToContractStatus;

export default convertDocusignStatusToContractStatus;
