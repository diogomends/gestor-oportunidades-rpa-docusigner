/**
 * Seletores centralizados para a interface web da DocuSign.
 */
export const selectors = {
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
  mfa: {
    input: "input[type='tel'], input[data-testid='mfa-code'], input[autocomplete='one-time-code'], #code, input[name='code']",
    verify_button: "button[data-testid='mfa-submit'], button[data-testid='verify-btn'], button[data-testid='submit-btn'], button[type='submit']",
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
};

export default selectors;
