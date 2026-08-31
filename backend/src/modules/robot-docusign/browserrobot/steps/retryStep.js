/**
 * Função utilitária para executar operações assíncronas com tentativas automáticas (retry) em falhas transitórias.
 *
 * @param {Function} operationFn - Função assíncrona a ser executada com tratamento de retry.
 * @param {number|Object} [optionsOrMaxRetries=3] - Quantidade máxima de tentativas ou objeto de opções ({ maxRetries, delayMs, shouldRetry, onRetry }).
 * @param {number} [delayMs=1000] - Tempo base de espera em milissegundos entre as tentativas.
 * @returns {Promise<*>} Retorna o resultado da execução bem-sucedida de operationFn.
 * @throws {Error} Lança o último erro ocorrido caso todas as tentativas falhem ou ocorra erro não-retentável.
 */
export async function withRetry(operationFn, optionsOrMaxRetries = 3, delayMs = 1000) {
  if (typeof operationFn !== "function") {
    throw new TypeError("operationFn deve ser uma função válida.");
  }

  const options = typeof optionsOrMaxRetries === "object" && optionsOrMaxRetries !== null ? optionsOrMaxRetries : {};
  const maxRetries = Math.max(1, Math.floor(Number(options.maxRetries ?? optionsOrMaxRetries) || 3));
  const baseDelayMs = Math.max(50, Number(options.delayMs ?? delayMs) || 1000);

  const defaultShouldRetry = (err) => {
    const code = String(err?.code || err?.message || "");
    if (code.includes("MFA_REQUIRED") || code.includes("OTP_INVALID") || err?.retryable === false) {
      return false;
    }
    return true;
  };

  const shouldRetry = typeof options.shouldRetry === "function" ? options.shouldRetry : defaultShouldRetry;

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operationFn(attempt);
    } catch (err) {
      lastError = err;

      if (!shouldRetry(err) || attempt >= maxRetries) {
        throw err;
      }

      if (typeof options.onRetry === "function") {
        await options.onRetry(err, attempt);
      }

      const backoffDelay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError;
}
