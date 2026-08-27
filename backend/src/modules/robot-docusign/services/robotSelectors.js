import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.resolve(__dirname, "../selectors/docusign-ui.json");

/**
 * Seletores padrão da interface DocuSign usados como fallback quando o JSON não existe.
 * @type {Object}
 */
const defaultSelectors = {
  baseUrl: "https://app.docusign.com",
  login: {
    email_input: "#email, input[type='email']",
    password_input: "#password, input[type='password']",
    login_button: "button[data-testid='login-button'], button[type='submit']",
  },
  dashboard: {
    url: "https://app.docusign.com/documents",
    search_input: "input[data-testid='search']",
    envelope_row: "tr[data-testid='envelope-row']",
    status_badge: "[data-testid='status-badge'], .status-badge, .envelope-status",
  },
  send: {
    url: "https://app.docusign.com/send",
    file_input: "input[type='file']",
    recipient_name: "input[data-testid='recipient-name'], input[name='recipientName']",
    recipient_email: "input[data-testid='recipient-email'], input[name='recipientEmail']",
    subject_input: "input[data-testid='subject'], input[name='subject']",
    message_textarea: "textarea[data-testid='message'], textarea[name='message']",
    send_button: "button[data-testid='send-button'], button[data-action='send']",
  },
  status: {
    status_badge: "[data-testid='status-badge'], .status-badge, .envelope-status",
  },
  download: {
    download_button: "button[data-testid='download-button'], a[data-action='download']",
  },
  resend: {
    resend_button: "button[data-testid='resend-button'], button[data-action='resend']",
  },
  reports: {
    url: "https://app.docusign.com/reports",
    total_sent: "[data-testid='metric-total-sent']",
    total_completed: "[data-testid='metric-total-completed']",
    total_pending: "[data-testid='metric-total-pending']",
  },
};

/**
 * Carrega os seletores da interface do DocuSign a partir do arquivo JSON ou do fallback padrão.
 *
 * @returns {Object} Objeto contendo os seletores CSS/data-testid para cada componente da interface.
 */
export function getSelectors() {
  try {
    if (fs.existsSync(jsonPath)) {
      const content = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(content);
      return { ...defaultSelectors, ...parsed };
    }
  } catch {
    // Em caso de falha de leitura, retorna seletores default
  }
  return defaultSelectors;
}

export default getSelectors();
