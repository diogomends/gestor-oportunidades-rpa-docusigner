import { getSelectors } from "../robotSelectors.js";
import robotSession from "../robotSession.js";

/**
 * Expressão regular centralizada para detecção de URLs de autenticação e telas de login/OAuth da DocuSign.
 * @constant {RegExp}
 */
export const LOGIN_URL_REGEX = /account\.docusign\.com|apps\.docusign\.com|\/oauth\/|\/login|\/password|\/auth\?/;

/**
 * Valida se uma determinada URL pertence ao fluxo de login/autenticação DocuSign.
 *
 * @param {string} [url=""] - URL a ser validada.
 * @returns {boolean} True se a URL for de autenticação/login.
 */
export function isLoginUrl(url = "") {
  return LOGIN_URL_REGEX.test(String(url || ""));
}

/**
 * Valida se a instância fornecida de Page do Playwright é válida.
 *
 * @param {Object} page - Instância de Page do Playwright.
 * @throws {TypeError} Lança TypeError caso page seja inválida.
 */
export function assertPage(page) {
  if (!page || typeof page.goto !== "function" || typeof page.url !== "function") {
    throw new TypeError("Uma instância válida de Page do Playwright é obrigatória para executar a operação.");
  }
}

/**
 * Obtém os seletores atualizados do robô DocuSign.
 *
 * @returns {Object} Objeto com mapeamento dos seletores CSS/XPath.
 */
export function resolveSelectors() {
  return getSelectors();
}

/**
 * Executa uma ação Playwright e detecta se houve redirecionamento para OAuth/login durante a execução.
 * Em caso de redirect, invalida a sessão e lança erro descritivo preservando a causa original.
 *
 * @param {Function} action - Função assíncrona da ação Playwright a executar.
 * @param {Object} page - Instância da página do Playwright.
 * @param {string} [email] - E-mail para invalidação da sessão caso ocorra redirecionamento.
 * @returns {Promise<void>}
 * @throws {Error} Lança erro caso a ação falhe ou redirecione para autenticação.
 */
export async function guardedAction(action, page, email) {
  if (typeof action !== "function") {
    throw new TypeError("Ação (action) deve ser uma função executável.");
  }

  let executionError = null;
  try {
    await action();
  } catch (err) {
    executionError = err;
  }

  const url = page && typeof page.url === "function" ? page.url() : "";
  if (isLoginUrl(url)) {
    if (email) {
      await robotSession.invalidateSession(email).catch(() => {});
    }
    const redirectMsg = `Redirecionado para OAuth durante interação com a página (${url}). Sessão invalidada — o robô realizará novo login na próxima tentativa.`;
    throw new Error(redirectMsg, executionError ? { cause: executionError } : undefined);
  }

  if (executionError) {
    throw executionError;
  }
}

/**
 * Preenche um campo de formulário se o seletor e o valor estiverem presentes, com suporte a guardedAction.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} [selector] - Seletor CSS do elemento input/textarea.
 * @param {string} [value] - Valor a ser preenchido.
 * @param {string} [email] - E-mail do usuário para controle de sessão.
 * @param {boolean} [isRequired=false] - Indica se o campo é obrigatório.
 * @returns {Promise<void>}
 * @throws {Error} Se o campo for obrigatório e o seletor não estiver presente.
 */
export async function fillIfPresent(page, selector, value, email, isRequired = false) {
  if (isRequired && !selector) {
    throw new Error("Seletor obrigatório não configurado para preenchimento de campo.");
  }
  if (value !== undefined && value !== null && value !== "" && selector && typeof page.fill === "function") {
    await guardedAction(() => page.fill(selector, String(value)), page, email);
  }
}

/**
 * Constrói a URL completa para visualização/detalhes de um envelope na DocuSign.
 *
 * @param {string} envelopeId - Identificador único do envelope.
 * @param {Object} [selectors={}] - Seletores contendo baseUrl.
 * @returns {string} URL construída do envelope.
 * @throws {Error} Lança erro se envelopeId for inválido.
 */
export function buildEnvelopeUrl(envelopeId, selectors = {}) {
  const cleanId = String(envelopeId || "").trim();
  if (!cleanId || !/^[a-zA-Z0-9-]{10,}$/.test(cleanId)) {
    throw new Error(`envelopeId inválido fornecido: "${envelopeId}". Esperado identificador com pelo menos 10 caracteres.`);
  }
  const baseUrl = selectors.baseUrl || "https://app.docusign.com";
  return `${baseUrl}/documents/${cleanId}`;
}

/**
 * Navega até a página de detalhes de um envelope DocuSign com tratamento defensivo.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {string} envelopeId - Identificador único do envelope.
 * @param {Object} [selectors={}] - Seletores contendo baseUrl.
 * @returns {Promise<string>} URL navegada.
 */
export async function navigateToEnvelope(page, envelopeId, selectors = {}) {
  assertPage(page);
  const envelopeUrl = buildEnvelopeUrl(envelopeId, selectors);
  await page.goto(envelopeUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  return envelopeUrl;
}
