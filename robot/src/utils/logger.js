/**
 * Utilitário de logging formatado com suporte a cores ANSI para o console do robô.
 * Utiliza cores nativas (verde para sucesso, azul/ciano para etapas, vermelho para erros, amarelo para avisos).
 * Mantém um buffer em memória para transmissão de logs de execução dos jobs.
 */

const ANSI_RESET = "\x1b[0m";
const ANSI_BRIGHT = "\x1b[1m";

// Cores de texto
const ANSI_GREEN = "\x1b[32m";
const ANSI_CYAN = "\x1b[36m";
const ANSI_BLUE = "\x1b[94m";
const ANSI_RED = "\x1b[91m";
const ANSI_YELLOW = "\x1b[93m";
const ANSI_GRAY = "\x1b[90m";

/** @constant {number} Tamanho máximo do buffer de logs por job (FIFO). */
const MAX_JOB_LOGS = 500;

/**
 * Buffer em memória para retenção temporária dos logs de execução do job atual.
 * // ponytail: cap 500 FIFO unbounded OOM guard — aumentar ou paginar se job >10k linhas, por ora descarta mais antigo
 * @type {string[]}
 */
let jobLogsBuffer = [];

/**
 * Formata um timestamp curto no formato HH:MM:SS.
 * @returns {string} Timestamp formatado.
 */
function getTimestamp() {
  const now = new Date();
  return now.toTimeString().split(" ")[0];
}

/**
 * Registra uma linha de log no buffer em memória do job ativo.
 * @param {string} tag - Identificador do módulo.
 * @param {string} message - Conteúdo da mensagem.
 * @returns {void}
 */
function recordToBuffer(tag, message) {
  const line = `[${getTimestamp()}] [${tag}] ${message}`;
  jobLogsBuffer.push(line);
  if (jobLogsBuffer.length > MAX_JOB_LOGS) jobLogsBuffer.shift();
}

/**
 * Drena e retorna todos os logs acumulados no buffer em memória do job atual.
 * @returns {string[]} Lista de linhas de log drenadas.
 */
export function drainJobLogs() {
  const logs = [...jobLogsBuffer];
  jobLogsBuffer = [];
  return logs;
}

/**
 * Limpa o buffer em memória de logs de jobs.
 * @returns {void}
 */
export function clearJobLogs() {
  jobLogsBuffer = [];
}

/**
 * Logger colorido para o robô DocuSigner com retenção em buffer para streaming.
 */
export const logger = {
  /**
   * Log de etapa em andamento (Azul / Ciano).
   * @param {string} tag - Identificador do módulo (ex: "Browser", "IMAP", "JobRunner").
   * @param {string} message - Mensagem descritiva da etapa.
   * @returns {void}
   */
  step(tag, message) {
    const time = `${ANSI_GRAY}[${getTimestamp()}]${ANSI_RESET}`;
    const header = `${ANSI_CYAN}${ANSI_BRIGHT}[${tag}]${ANSI_RESET}`;
    const text = `${ANSI_BLUE}${message}${ANSI_RESET}`;
    console.log(`${time} ${header} ${text}`);
    recordToBuffer(tag, message);
  },

  /**
   * Log de etapa ou operação concluída com sucesso (Verde).
   * @param {string} tag - Identificador do módulo (ex: "Browser", "IMAP", "JobRunner").
   * @param {string} message - Mensagem de sucesso.
   * @returns {void}
   */
  success(tag, message) {
    const time = `${ANSI_GRAY}[${getTimestamp()}]${ANSI_RESET}`;
    const header = `${ANSI_GREEN}${ANSI_BRIGHT}[${tag}]${ANSI_RESET}`;
    const text = `${ANSI_GREEN}✓ ${message}${ANSI_RESET}`;
    console.log(`${time} ${header} ${text}`);
    recordToBuffer(tag, `✓ ${message}`);
  },

  /**
   * Log de erro (Vermelho).
   * @param {string} tag - Identificador do módulo.
   * @param {string} message - Mensagem de erro.
   * @param {...any} optionalParams - Parâmetros extras ou stack trace.
   * @returns {void}
   */
  error(tag, message, ...optionalParams) {
    const time = `${ANSI_GRAY}[${getTimestamp()}]${ANSI_RESET}`;
    const header = `${ANSI_RED}${ANSI_BRIGHT}[${tag}]${ANSI_RESET}`;
    const text = `${ANSI_RED}✗ ${message}${ANSI_RESET}`;
    console.error(`${time} ${header} ${text}`, ...optionalParams);
    recordToBuffer(tag, `✗ ${message}`);
  },

  /**
   * Log de alerta/aviso (Amarelo).
   * @param {string} tag - Identificador do módulo.
   * @param {string} message - Mensagem de alerta.
   * @returns {void}
   */
  warn(tag, message) {
    const time = `${ANSI_GRAY}[${getTimestamp()}]${ANSI_RESET}`;
    const header = `${ANSI_YELLOW}${ANSI_BRIGHT}[${tag}]${ANSI_RESET}`;
    const text = `${ANSI_YELLOW}⚠ ${message}${ANSI_RESET}`;
    console.warn(`${time} ${header} ${text}`);
    recordToBuffer(tag, `⚠ ${message}`);
  },

  /**
   * Log informativo padrão.
   * @param {string} tag - Identificador do módulo.
   * @param {string} message - Mensagem informativa.
   * @returns {void}
   */
  info(tag, message) {
    const time = `${ANSI_GRAY}[${getTimestamp()}]${ANSI_RESET}`;
    const header = `${ANSI_BRIGHT}[${tag}]${ANSI_RESET}`;
    console.log(`${time} ${header} ${message}`);
    recordToBuffer(tag, message);
  },

  drainJobLogs,
  clearJobLogs,
};

export default logger;
