/**
 * @file Serviço responsável pela gestão de configurações, resolução de modo de execução (Robot vs API) e cálculo de retentativas.
 * Aplica o Princípio de Responsabilidade Única (SRP) e desacopla a configuração do pipeline de execução.
 */

import SystemConfig from "../../../models/SystemConfig.js";
import { decryptText } from "../../../utils/crypto.js";

/**
 * Configuração padrão fallback para o Robô DocuSign.
 */
export const DEFAULT_ROBOT_DOCUSIGN_CONFIG = {
  enabled: true,
  mode: "robot",
  operations: {
    send: true,
    statusCheck: true,
    download: true,
    reports: true,
    resend: true,
  },
  schedule: {
    enabled: true,
    intervalMinutes: 15,
    startHour: "07:00",
    endHour: "19:00",
  },
  limits: {
    max_concurrent: 1,
  },
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
  },
  credentials: {
    email: "",
    password: "",
  },
  token_notification_email: {
    email: "",
    password: "",
    host: "unitynordeste.com.br",
    port: 993,
    tls: true,
  },
  mfa: {
    maxWaitMs: 90000,
    maxAgeMs: 10 * 60 * 1000,
  },
};

/**
 * Busca e retorna as configurações salvas do Robô DocuSign no banco de dados, mesclando com valores padrão.
 *
 * @returns {Promise<Object>} Objeto com a configuração mesclada e senhas descriptografadas.
 */
export async function getRobotConfig() {
  const doc = await SystemConfig.findOne({ key: "robot_docusign" }).lean();
  const savedValue = doc?.value || {};

  const config = {
    ...DEFAULT_ROBOT_DOCUSIGN_CONFIG,
    ...savedValue,
    operations: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.operations,
      ...(savedValue.operations || {}),
    },
    schedule: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.schedule,
      ...(savedValue.schedule || {}),
    },
    limits: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.limits,
      ...(savedValue.limits || {}),
    },
    retry: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.retry,
      ...(savedValue.retry || {}),
    },
    credentials: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.credentials,
      ...(savedValue.credentials || {}),
    },
    token_notification_email: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.token_notification_email,
      ...(savedValue.token_notification_email || {}),
    },
    mfa: {
      ...DEFAULT_ROBOT_DOCUSIGN_CONFIG.mfa,
      ...(savedValue.mfa || {}),
    },
  };

  if (config.credentials?.password) {
    config.credentials.password = decryptText(config.credentials.password);
  }

  if (config.token_notification_email?.password) {
    config.token_notification_email.password = decryptText(config.token_notification_email.password);
  }

  return config;
}

/**
 * Avalia se o modo Robô deve ser utilizado para a operação ou se deve recorrer à API oficial.
 *
 * @param {Object|string} contract - Objeto do contrato ou ID de referência.
 * @param {Object} [options={}] - Opções fornecidas pelo chamador.
 * @returns {Promise<boolean>} Retorna true para modo Robô e false para modo API.
 */
export async function shouldUseRobot(contract, options = {}) {
  if (options?.forceMode === "api" || options?.mode === "api") {
    return false;
  }
  if (options?.forceMode === "robot" || options?.mode === "robot" || options?.forceRobot) {
    return true;
  }

  const config = await getRobotConfig();
  if (config.mode !== "robot") {
    return false;
  }

  const action = options?.action || "send";
  const opMap = {
    send: config.operations?.send,
    status: config.operations?.statusCheck,
    download: config.operations?.download,
    reports: config.operations?.reports,
    resend: config.operations?.resend,
  };

  if (opMap[action] === false) {
    return false;
  }

  return true;
}

/**
 * Calcula o tempo de atraso (delay) em milissegundos para a tentativa usando algoritmo exponencial.
 *
 * @param {number} attempt - Número da tentativa (1-indexed).
 * @param {number} [baseDelayMs=1000] - Delay base em milissegundos.
 * @returns {number} Tempo de delay calculado.
 */
export function calculateRetryDelay(attempt, baseDelayMs = 1000) {
  const base = typeof baseDelayMs === "number" && baseDelayMs > 0 ? baseDelayMs : 1000;
  const exp = Math.max(0, attempt - 1);
  return base * Math.pow(2, exp);
}

/**
 * Calcula a data/hora para o agendamento da próxima tentativa (next_retry_at).
 *
 * @param {number} attempt - Número da tentativa (1-indexed).
 * @param {number} [baseDelayMs=1000] - Delay base em milissegundos.
 * @returns {Date} Instância de Date com a hora futura.
 */
export function calculateNextRetryAt(attempt, baseDelayMs = 1000) {
  const delayMs = calculateRetryDelay(attempt, baseDelayMs);
  return new Date(Date.now() + delayMs);
}

export default {
  DEFAULT_ROBOT_DOCUSIGN_CONFIG,
  getRobotConfig,
  shouldUseRobot,
  calculateRetryDelay,
  calculateNextRetryAt,
};
