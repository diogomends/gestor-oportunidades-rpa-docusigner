/**
 * @file Barrel e fachada principal do submódulo de automação Playwright (browserrobot).
 * Re-exporta de forma modular todas as operações do robô DocuSign.
 * Segue o padrão de imports atômicos: nenhuma lógica de negócio vive aqui.
 */

// Atomic Imports
import { sendEnvelope as send } from "./steps/sendStep.js";
import { checkStatus as status } from "./steps/statusStep.js";
import { downloadDocument as download } from "./steps/downloadStep.js";
import { resendEnvelope as resend } from "./steps/resendStep.js";
import { extractReports as reports } from "./steps/reportsStep.js";
import { fetchAgreementsByRepresentative as queryAgreements } from "./agreementsService.js";
import { executeWithBrowser } from "./steps/executeWithBrowserStep.js";
import { withRetry } from "./steps/retryStep.js";


export default {
  send,
  status,
  download,
  resend,
  reports,
  queryAgreements,
  executeWithBrowser,
  withRetry,
};
