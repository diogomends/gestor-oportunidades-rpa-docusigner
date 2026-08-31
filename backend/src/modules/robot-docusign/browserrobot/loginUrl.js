/**
 * @file Definição canônica de detecção de URLs de login/OAuth da DocuSign.
 * Fonte única para isLoginUrl / LOGIN_URL_REGEX — importar daqui evita duplicação
 * e divergência entre stepUtils e robotSession.
 */

/** @constant {RegExp} */
export const LOGIN_URL_REGEX = /account\.docusign\.com|apps\.docusign\.com|\/oauth\/|\/login|\/password|\/auth\?/;

/**
 * @param {string} [url=""] - URL a validar.
 * @returns {boolean} True se for URL de login/OAuth.
 */
export function isLoginUrl(url = "") {
  return LOGIN_URL_REGEX.test(String(url || ""));
}
