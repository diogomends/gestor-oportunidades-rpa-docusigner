import dotenv from "dotenv";
dotenv.config();

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Obtém a URL base da API do Gestor de Oportunidades.
 * @returns {string} URL base sem barra final.
 */
const getBaseUrl = () => {
  const url = process.env.GESTOR_API_URL || "http://localhost:3000/api";
  return url.replace(/\/+$/, "");
};

/**
 * Obtém a chave de API do robô a partir das variáveis de ambiente.
 * @returns {string} Chave de API ou string vazia se não configurada.
 */
const getRobotApiKey = () => {
  return process.env.ROBOT_API_KEY || "";
};

/**
 * Executa requisição fetch com timeout via AbortSignal e retry exponencial para erros transitórios.
 * @param {string} url
 * @param {RequestInit} options
 * @param {{ retries?: number, baseDelayMs?: number, timeoutMs?: number }} [config={}]
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, config = {}) {
  const retries = config.retries ?? 2;
  const baseDelayMs = config.baseDelayMs ?? 1000;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);
      
      const fetchSignal = typeof AbortSignal.timeout === "function" 
        ? AbortSignal.timeout(timeoutMs) 
        : controller.signal;

      const response = await fetch(url, {
        ...options,
        signal: fetchSignal,
      });

      if (typeof timer !== "undefined") clearTimeout(timer);

      // Não realiza retry para erros de cliente (4xx) exceto se for rate limit (429)
      if (!response.ok && response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      if (response.ok) {
        return response;
      }

      // Se retornou 5xx ou 429 e ainda temos retries
      if (attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (err) {
      lastError = err;
      const isTimeout = err.name === "TimeoutError" || err.name === "AbortError" || err.message?.includes("timed out");
      const isNetworkErr = err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || isTimeout;

      if (isNetworkErr && attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

/**
 * Valida a chave de API do robô junto ao Gestor de Oportunidades.
 * @param {Object} [options={}] - Configurações extras (ex: timeoutMs).
 * @returns {Promise<{ valid: boolean, cargo?: string, requestedBy?: string, active?: boolean, error?: string }>}
 */
export const validateApiKey = async (options = {}) => {
  const apiKey = getRobotApiKey();
  if (!apiKey) {
    console.error("[GestorApiClient] ROBOT_API_KEY não configurada no ambiente.");
    return { valid: false, error: "ROBOT_API_KEY não configurada" };
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/internal/robot-keys/validate`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-robot-key": apiKey,
        },
        body: JSON.stringify({ key: apiKey }),
      },
      { retries: options.retries ?? 1, timeoutMs }
    );

    if (!response.ok) {
      console.warn(`[GestorApiClient] Validação de chave retornou HTTP ${response.status}`);
      return { valid: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      valid: Boolean(data.valid),
      cargo: data.cargo,
      requestedBy: data.requestedBy,
      active: data.active,
    };
  } catch (error) {
    const isTimeout = error.name === "TimeoutError" || error.name === "AbortError" || error.message?.includes("timed out");
    const errMsg = isTimeout ? `Timeout de ${timeoutMs}ms excedido na validação da API Key` : error.message;
    console.error(`[GestorApiClient] Falha na validação da API Key de rede: ${errMsg}`);
    return { valid: false, error: errMsg };
  }
};

/**
 * Busca contratos pendentes no Gestor de Oportunidades.
 * @param {Object} [params={ status: "pending_signature" }]
 * @param {Object} [options={}] - Opções de rede (retries, timeoutMs).
 * @returns {Promise<Array<any>>}
 */
export const fetchPendingContracts = async (params = { status: "pending_signature" }, options = {}) => {
  const apiKey = getRobotApiKey();
  const baseUrl = getBaseUrl();
  const query = new URLSearchParams(params).toString();
  const url = `${baseUrl}/contracts${query ? `?${query}` : ""}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-robot-key": apiKey,
        },
      },
      { retries: options.retries ?? 2, timeoutMs }
    );

    if (!response.ok) {
      throw new Error(`Erro ao buscar contratos: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.contracts || (Array.isArray(data) ? data : []);
  } catch (error) {
    console.error(`[GestorApiClient] Erro ao buscar contratos pendentes: ${error.message}`);
    throw error;
  }
};

/**
 * Atualiza o status e/ou envelope_id de um contrato no Gestor de Oportunidades.
 * @param {string} contractId
 * @param {Object} payload
 * @param {Object} [options={}] - Opções de rede (retries, timeoutMs).
 * @returns {Promise<any>}
 */
export const updateContractStatus = async (contractId, payload, options = {}) => {
  const apiKey = getRobotApiKey();
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/contracts/${encodeURIComponent(contractId)}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-robot-key": apiKey,
        },
        body: JSON.stringify(payload),
      },
      { retries: options.retries ?? 2, timeoutMs }
    );

    if (!response.ok) {
      throw new Error(`Erro ao atualizar contrato: HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[GestorApiClient] Erro ao atualizar status do contrato ${contractId}: ${error.message}`);
    throw error;
  }
};

/**
 * Baixa o stream/buffer de um documento de contrato diretamente do Gestor de Oportunidades.
 * @param {string} relativeUrl - URL relativa ou caminho do documento (ex: /uploads/... ou uploads/...).
 * @param {Object} [options={}] - Opções adicionais de timeout/retry.
 * @returns {Promise<Response>} Resposta fetch contendo o stream do PDF.
 * @throws {Error} Quando a resposta HTTP não for ok ou ocorrer erro de rede.
 */
export const downloadContractDocumentStream = async (relativeUrl, options = {}) => {
  const apiKey = getRobotApiKey();
  const baseUrl = getBaseUrl();
  const cleanPath = relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`;
  const url = `${baseUrl}${cleanPath}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const response = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers: {
        "x-robot-key": apiKey,
      },
    },
    { retries: options.retries ?? 2, timeoutMs }
  );

  if (!response.ok) {
    throw new Error(`Falha ao obter documento do Gestor: HTTP ${response.status}`);
  }

  return response;
};

/**
 * Cliente padrão do Gestor API com métodos de validação e contratos.
 * @type {{validateApiKey: Function, fetchPendingContracts: Function, updateContractStatus: Function, downloadContractDocumentStream: Function}}
 */
export default {
  validateApiKey,
  fetchPendingContracts,
  updateContractStatus,
  downloadContractDocumentStream,
};

