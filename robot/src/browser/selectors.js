/**
 * Seletores centralizados para a interface web da DocuSign.
 * Centraliza seletores CSS/data-testid para login, envio, status, MFA e Roundcube.
 * @type {{baseUrl: string, login: Object, dashboard: Object, send: Object, status: Object, download: Object, resend: Object, mfa: Object, roundcube: Object}}
 */
export const selectors = {
  baseUrl: "https://app.docusign.com",
  login: {
    email_input: "input[data-qa='username'], input[name='email'], input[type='email'], #email",
    password_input: "input[data-qa='password'], input[name='password'], input[type='password'], #password",
    login_button: "button[data-qa='submit-username'], button[data-qa='submit'], button[type='submit'], button[data-testid='login-button']",
  },
  dashboard: {
    url: "https://app.docusign.com/documents",
    search_input: "input[data-testid='search']",
    envelope_row: "tr[data-testid='envelope-row']",
    status_badge: "[data-testid='status-badge'], .status-badge, .envelope-status",
  },
  send: {
    url: "https://apps.docusign.com/send/prepare/",
    file_input: "input[type='file']",
    upload_button: "button[data-qa='upload-file-button']",
    upload_container: "[data-qa='upload-button-container'][data-hotspot='upload-button-container']",
    drop_icon: "svg[data-qa='file-drop-zone-text-image']",
    recipient_name: "input[data-qa='recipient-name'], input[data-testid='recipient-name'], input[name='recipientName']",
    recipient_email: "input[data-qa='recipient-email'], input[data-testid='recipient-email'], input[name='recipientEmail']",
    delivery_checkbox: "input[data-qa='delivery-email']",
    recipients_add: "button[data-qa='recipients-add']",
    next_button: "button[data-qa='footer-add-fields-link-correct'], [data-qa='footer-prepare-next-action'] button, button:has-text('Avançar')",
    send_button: "button[data-qa='footer-send-button'], button[data-testid='send-button'], button[data-action='send']",
    send_without_fields: "button[data-qa='send-without-fields']",
    subject_input: "input[data-testid='subject'], input[name='subject']",
    message_textarea: "textarea[data-testid='message'], textarea[name='message']",
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
  mfa: {
    input: "input[name='security_code'], input[placeholder='Enter code'], input[pattern='[0-9]{6}'], input[type='tel'], input[data-testid='mfa-code'], input[autocomplete='one-time-code'], #code, input[name='code'], input[name='mfa-code']",
    verify_button: "button[data-qa='verify-code'], button:has-text('Verify'), [data-qa='verify-code'], button[data-testid='mfa-submit'], button[data-testid='verify-btn'], button[data-testid='submit-btn'], button[type='submit']",
    text_trigger: "Get Code From Your Email",
    email_option_btn: "button:has-text('Get Code From Your Email'), a:has-text('Get Code From Your Email'), [role='button']:has-text('Get Code From Your Email'), text='Get Code From Your Email'",
    error_invalid: "text=/The code entered is invalid/i, [data-testid='mfa-error'], p:has-text('The code entered is invalid')",
  },
  roundcube: {
    login_url: "https://unitynordeste.com.br:2096/",
    user_input: "#user, input[name='user']",
    pass_input: "#pass, input[name='pass']",
    login_button: "#login_submit, button[type='submit']",
    roundcube_app_btn: "a#rcmloginroundcube, a[href*='roundcube'], button#open_webmail_client",
    message_list: "#messagelist, table.messagelist, #layout-content table",
    message_row: "tr.message, tr[id^='rcmrow']",
    sender_docusign: "td.from, span.from, .from",
    subject_text: "td.subject, span.subject, .subject",
    refresh_button: "a.button.checkmail, a[data-command='checkmail'], a#rcmbtn101, button.checkmail",
    message_body: "#messagebody, #messagecontframe, iframe#messagecontframe, .message-part, #message-body",
  },
  reports: {
    url: "https://app.docusign.com/reports",
    total_sent: "[data-testid='metric-total-sent']",
    total_completed: "[data-testid='metric-total-completed']",
    total_pending: "[data-testid='metric-total-pending']",
  },
  agreements: {
    url: "https://apps.docusign.com/send/documents",
    table: "[data-qa='manage-envelopes-list.table']",
    row: "tbody[data-qa='manage-envelopes-list.body'] tr, [data-qa='manage-envelopes-list.table'] tr, tr[data-qa^='manage-envelopes-list.row.']",
    from_recipient: "[data-qa$='-mobile-from']",
    subject_button: "button[data-qa$='-mobile-name'], [data-qa$='-mobile-name-text']",
    status: "[data-qa$='-status-status'], [data-qa$='-mobile-status']",
    pagination_next: "button[data-qa='manage-envelopes-list.footer.pagination-pagination-next']",
  },
};

/**
 * Constrói a URL de consulta de acordos/envelopes na DocuSign com intervalo de datas dinâmico.
 * @param {number} [daysBack=5] - Quantidade de dias a subtrair da data atual para o filtro 'from'.
 * @param {string} [baseUrl="https://apps.docusign.com/send/documents"] - URL base da listagem de documentos.
 * @returns {string} URL formatada com os parâmetros view=agreements, from, to e pageSize=50.
 */
export function buildAgreementsUrl(daysBack = 5, baseUrl = "https://apps.docusign.com/send/documents") {
  const targetDate = new Date();
  const toDateStr = targetDate.toISOString().split("T")[0];

  const fromDate = new Date(targetDate.getTime());
  fromDate.setDate(fromDate.getDate() - (typeof daysBack === "number" && daysBack >= 0 ? daysBack : 5));
  const fromDateStr = fromDate.toISOString().split("T")[0];

  return `${baseUrl}?view=agreements&from=${fromDateStr}&to=${toDateStr}&pageSize=50`;
}

export default selectors;
