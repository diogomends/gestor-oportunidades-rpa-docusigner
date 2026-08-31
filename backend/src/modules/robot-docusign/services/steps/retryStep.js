/**
 * Função utilitária para executar operações assíncronas com tentativas automáticas (retry) em falhas transitórias.
 *
 * @param {Function} operationFn - Função assíncrona a ser executada com tratamento de retry.
 * @param {number} [maxRetries=3] - Quantidade máxima de tentativas permitidas.
 * @param {number} [delayMs=1000] - Tempo de espera em milissegundos entre as tentativas.
 * @returns {Promise<*>} Retorna o resultado da execução bem-sucedida de operationFn.
 * @throws {Error} Lança o último erro ocorrido caso todas as tentativas falhem.
 */
export async function withRetry(operationFn, maxRetries = 3, delayMs = 1000) {
  if (typeof operationFn !== "function") {
    throw new Error("operationFn must be a valid function");
  }

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operationFn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
