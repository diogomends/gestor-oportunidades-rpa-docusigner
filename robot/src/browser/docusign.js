/**
 * @file Facade principal para automação de navegador do DocuSign via Playwright.
 * Centraliza e re-exporta as operações de autenticação, envio de envelopes,
 * consulta de status e extração de acordos respeitando SOLID e PonyTail.
 */

import { randomDelay, isAuthenticationUrl, saveSessionState, ensureAuthenticated } from "./auth.js";
import { sendEnvelope, checkEnvelopeStatus } from "./envelopes.js";
import { extractEnvelopesFromCurrentPage, fetchAgreementsByRepresentative } from "./agreements.js";
import { normalizeText, normalizeEnvelopeStatus, extractPendingSigner } from "./statusParser.js";

export {
  randomDelay,
  isAuthenticationUrl,
  saveSessionState,
  ensureAuthenticated,
  sendEnvelope,
  checkEnvelopeStatus,
  extractEnvelopesFromCurrentPage,
  fetchAgreementsByRepresentative,
  normalizeText,
  normalizeEnvelopeStatus,
  extractPendingSigner,
};

/**
 * Objeto unificado contendo todas as operações da fachada DocuSign.
 * @constant
 * @type {Object}
 */
const docusignFacade = {
  randomDelay,
  isAuthenticationUrl,
  ensureAuthenticated,
  saveSessionState,
  sendEnvelope,
  checkEnvelopeStatus,
  extractEnvelopesFromCurrentPage,
  fetchAgreementsByRepresentative,
  normalizeText,
  normalizeEnvelopeStatus,
  extractPendingSigner,
};

export default docusignFacade;
