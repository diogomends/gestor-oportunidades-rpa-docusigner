/**
 * Utilitário de logging formatado com suporte a cores ANSI para o console do robô.
 * Utiliza cores nativas (verde para sucesso, azul/ciano para etapas, vermelho para erros, amarelo para avisos).
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

/**
 * Formata um timestamp curto no formato HH:MM:SS.
 * @returns {string} Timestamp formatado.
 */
function getTimestamp() {
  const now = new Date();
  return now.toTimeString().split(" ")[0];
}

/**
 * Logger colorido para o robô DocuSigner.
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
  },
};

export default logger;
