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
    email_input: "input[data-qa='username'], input[name='email'], input[type='email'], #email",
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
  mfa: {
    input: "input[name='security_code'], input[placeholder='Enter code'], input[pattern='[0-9]{6}'], input[type='tel'], input[data-testid='mfa-code'], input[autocomplete='one-time-code'], #code, input[name='code'], input[name='mfa-code']",
    verify_button: "button[data-qa='verify-code'], button:has-text('Verify'), [data-qa='verify-code'], button[data-testid='mfa-submit'], button[data-testid='verify-btn'], button[data-testid='submit-btn'], button[type='submit']",
    text_trigger: "Get Code From Your Email",
    email_option_btn: "button:has-text('Get Code From Your Email'), a:has-text('Get Code From Your Email'), text='Get Code From Your Email'",
  },
  agreements: {
    url: "https://apps.docusign.com/send/documents",
    table: "[data-qa='manage-envelopes-list.table']",
    row: "[data-qa='manage-envelopes-list.table'] tr, tr[data-qa^='manage-envelopes-list.row.']",
    from_recipient: "[data-qa$='-mobile-from']",
    subject_button: "button[data-qa$='-mobile-name'], [data-qa$='-mobile-name-text']",
    status: "[data-qa$='-status-status'], [data-qa$='-mobile-status']",
    pagination_next: "button[data-qa='manage-envelopes-list.footer.pagination-pagination-next']",
  },
};

/**
 * Mescla profundamente (1 nível) seletores padrão e customizados para evitar perda de chaves aninhadas.
 *
 * @param {Object} defaults - Objeto com os seletores padrões.
 * @param {Object} overrides - Objeto com sobreposições do arquivo JSON.
 * @returns {Object} Objeto mesclado.
 */
function deepMergeSelectors(defaults, overrides) {
  if (!overrides || typeof overrides !== "object") return defaults;
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (
      overrides[key] &&
      typeof overrides[key] === "object" &&
      !Array.isArray(overrides[key]) &&
      defaults[key] &&
      typeof defaults[key] === "object" &&
      !Array.isArray(defaults[key])
    ) {
      result[key] = { ...defaults[key], ...overrides[key] };
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

let cachedSelectors = null;
let lastMtimeMs = 0;

/**
 * Carrega os seletores da interface do DocuSign com cache leve invalidado por mtime do arquivo JSON.
 *
 * @returns {Object} Objeto contendo os seletores CSS/data-testid para cada componente da interface.
 */
export function getSelectors() {
  try {
    const stats = fs.statSync(jsonPath, { throwIfNoEntry: false });
    if (stats && stats.isFile()) {
      if (cachedSelectors && stats.mtimeMs === lastMtimeMs) {
        return cachedSelectors;
      }
      const content = fs.readFileSync(jsonPath, "utf-8");
      const parsed = JSON.parse(content);
      cachedSelectors = deepMergeSelectors(defaultSelectors, parsed);
      lastMtimeMs = stats.mtimeMs;
      return cachedSelectors;
    }
  } catch {
    // Em caso de falha de leitura, recorre aos seletores default
  }
  return defaultSelectors;
}

export default getSelectors();
