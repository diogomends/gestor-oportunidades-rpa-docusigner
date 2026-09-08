import { getSelectors } from "../robotSelectors.js";
import robotSession from "../robotSession.js";
import { LOGIN_URL_REGEX, isLoginUrl } from "../loginUrl.js";

export { LOGIN_URL_REGEX, isLoginUrl };

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
      await robotSession.invalidateSession(email).catch((e) => console.warn("[guardedAction] falha ao invalidar sessão:", e?.message || e));
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

/**
 * Regex estrita de UUID de 36 caracteres (Envelope ID DocuSign).
 * @constant
 * @type {RegExp}
 */
export const UUID_REGEX = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

/**
 * Extrai um Envelope ID de uma URL (padrões /envelopes/<id>, details/<id>, /documents/<id>, envelopeId=<id>).
 * @param {string} url - URL a inspecionar.
 * @returns {string|null} ID extraído ou null.
 */
export function extractEnvelopeIdFromUrl(url) {
  if (typeof url !== "string" || url.length === 0) return null;
  if (!url.includes("/envelopes/") && !url.includes("envelopeId=") && !url.includes("details/") && !url.includes("/documents/")) return null;
  const match = url.match(/\/envelopes\/([a-f0-9-]{36})/i)
    || url.match(/details\/([a-f0-9-]{36})/i)
    || url.match(/\/documents\/([a-f0-9-]{36})/i)
    || url.match(/envelopeId=([a-f0-9-]{36})/i);
  if (match && match[1] && UUID_REGEX.test(match[1])) return match[1];
  return null;
}

/**
 * Anexa interceptadores de rede para capturar o ID de envelope trafegado durante o envio com desanexação segura.
 * Escuta URLs de navegação (request) e o corpo JSON do POST de criação (`/restapi/.../envelopes` → `{ envelopeId }`).
 * @param {Object} page - Instância da página do Playwright.
 * @returns {{ getInterceptedId: () => string|null, cleanup: () => void }} Objeto com getter do ID interceptado e função de cleanup.
 */
export function attachNetworkEnvelopeInterceptor(page) {
  let interceptedEnvelopeId = null;

  const onRequest = (request) => {
    try {
      const url = typeof request?.url === "function" ? request.url() : "";
      const id = extractEnvelopeIdFromUrl(url);
      if (id) interceptedEnvelopeId = id;
    } catch (_) {}
  };

  const onResponse = async (response) => {
    try {
      const url = typeof response?.url === "function" ? response.url() : "";
      const idFromUrl = extractEnvelopeIdFromUrl(url);
      if (idFromUrl) {
        interceptedEnvelopeId = idFromUrl;
        return;
      }
      const req = typeof response?.request === "function" ? response.request() : null;
      const method = typeof req?.method === "function" ? req.method() : "";
      if (url.includes("/restapi/") && url.includes("/envelopes") && method === "POST" && typeof response?.json === "function") {
        const body = await response.json().catch(() => null);
        const candidate = body?.envelopeId;
        if (typeof candidate === "string" && UUID_REGEX.test(candidate.trim())) {
          interceptedEnvelopeId = candidate.trim();
        }
      }
    } catch (_) {}
  };

  if (page && typeof page.on === "function") {
    page.on("request", onRequest);
    page.on("response", onResponse);
  }

  return {
    getInterceptedId: () => interceptedEnvelopeId,
    cleanup: () => {
      try {
        if (page && typeof page.off === "function") {
          page.off("request", onRequest);
          page.off("response", onResponse);
        }
      } catch (_) {}
    },
  };
}
