import tls from "node:tls";
import net from "node:net";

/**
 * Janela máxima de validade de e-mail MFA pré-existente (10 minutos).
 * @constant {number}
 */
export const DEFAULT_MFA_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Timeout padrão de polling MFA (90 segundos).
 * @constant {number}
 */
export const DEFAULT_MFA_MAX_WAIT_MS = 90000;

/**
 * Decodifica texto codificado em Quoted-Printable.
 *
 * @param {string} input - String codificada em Quoted-Printable.
 * @param {BufferEncoding} [encoding="utf8"] - Encoding de destino do buffer.
 * @returns {string} Texto decodificado.
 */
export function decodeQuotedPrintable(input, encoding = "utf8") {
  if (!input || typeof input !== "string") return "";
  const cleaned = input.replace(/=\r?\n/g, "");
  return cleaned.replace(/((?:=[0-9A-Fa-f]{2})+)/g, (match) => {
    try {
      const hexes = match.split("=").filter(Boolean);
      const bytes = hexes.map((h) => parseInt(h, 16));
      return Buffer.from(bytes).toString(encoding);
    } catch {
      return match;
    }
  });
}

/**
 * Decodifica texto codificado em Base64 para UTF-8.
 *
 * @param {string} input - String em Base64.
 * @returns {string} Texto decodificado em UTF-8.
 */
export function decodeBase64(input) {
  if (!input || typeof input !== "string") return "";
  const cleaned = input.replace(/[\r\n\s]/g, "");
  try {
    return Buffer.from(cleaned, "base64").toString("utf8");
  } catch {
    return input;
  }
}

/**
 * Determina o encoding do Buffer a partir do charset informado no cabeçalho MIME.
 *
 * @param {string} charset - Nome do charset.
 * @returns {BufferEncoding} Encoding suportado pelo Buffer do Node.js.
 */
function getBufferEncoding(charset) {
  const cs = (charset || "").toLowerCase();
  if (cs.includes("utf")) return "utf8";
  if (cs === "iso-8859-1" || cs === "latin1" || cs === "ascii" || cs === "windows-1252") return "latin1";
  return "utf8";
}

/**
 * Decodifica cabeçalhos MIME (RFC 2047) codificados em Base64 ou Quoted-Printable.
 *
 * @param {string} header - Valor bruto do cabeçalho de e-mail.
 * @returns {string} Cabeçalho decodificado em UTF-8.
 */
export function decodeMimeHeader(header) {
  if (!header || typeof header !== "string") return "";
  const unfolded = header.replace(/\r?\n[ \t]+/g, " ");
  const collapsedWords = unfolded.replace(/(=\?[^?]+\?[BQbq]\?[^?]+\?=)[ \t]+(?==\?[^?]+\?[BQbq]\?[^?]+\?=)/g, "$1");
  const rfc2047Regex = /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g;
  return collapsedWords.replace(rfc2047Regex, (_, charset, encoding, text) => {
    const enc = encoding.toUpperCase();
    const bufEncoding = getBufferEncoding(charset);
    try {
      if (enc === "B") {
        return Buffer.from(text, "base64").toString(bufEncoding);
      }
      if (enc === "Q") {
        const qp = text.replace(/_/g, " ");
        return decodeQuotedPrintable(qp, bufEncoding);
      }
    } catch {
      return text;
    }
    return text;
  }).trim();
}

/**
 * Extrai metadados (Subject, Date, body) de uma resposta de FETCH IMAP.
 * Realiza unfolding de cabeçalhos RFC 5322 para suportar campos multi-linha.
 *
 * @param {string} raw - Resposta bruta do comando IMAP FETCH.
 * @returns {{ subject: string, date: Date|null, body: string }} Objeto com metadados do e-mail.
 */
export function parseEmailMetadata(raw) {
  if (!raw || typeof raw !== "string") {
    return { subject: "", date: null, body: "" };
  }

  let date = null;
  const internalDateMatch = raw.match(/INTERNALDATE\s+"([^"]+)"/i);
  if (internalDateMatch && internalDateMatch[1]) {
    const parsed = new Date(internalDateMatch[1]);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    }
  }

  const unfoldedRaw = raw.replace(/\r?\n[ \t]+/g, " ");

  let subject = "";
  const subjectMatch = unfoldedRaw.match(/^Subject:\s*(.+)$/im);
  if (subjectMatch && subjectMatch[1]) {
    subject = decodeMimeHeader(subjectMatch[1]);
  }

  if (!date) {
    const dateHeaderMatch = unfoldedRaw.match(/^Date:\s*(.+)$/im);
    if (dateHeaderMatch && dateHeaderMatch[1]) {
      const parsed = new Date(dateHeaderMatch[1].trim());
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
  }

  return { subject, date, body: raw };
}

/**
 * Extrai o código de 6 dígitos do corpo da mensagem DocuSign.
 *
 * @param {string} text - Texto bruto ou decodificado do e-mail.
 * @returns {string|null} Código de 6 dígitos ou null.
 */
export function extractMfaCodeFromText(text) {
  if (!text || typeof text !== "string") return null;

  const processedText = decodeQuotedPrintable(text);
  const patterns = [
    /Seu c[oó]digo de verifica[cç][aã]o da Docusign [eé]:\s*(\d{6})/i,
    /c[oó]digo de verifica[cç][aã]o[^0-9]{1,30}(\d{6})/i,
    /verification code[^0-9]{1,30}(\d{6})/i,
    /security code[^0-9]{1,30}(\d{6})/i,
  ];

  for (const pattern of patterns) {
    const match = processedText.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  const b64BlockMatch = text.match(/(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g);
  if (b64BlockMatch) {
    for (const block of b64BlockMatch) {
      const decoded = decodeBase64(block);
      for (const pattern of patterns) {
        const match = decoded.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  }

  return null;
}

/**
 * Formata um objeto Date para o formato de data IMAP (DD-Mon-YYYY).
 *
 * @param {Date} [date] - Objeto Date a ser formatado. Padrão: data atual.
 * @returns {string} Data formatada para IMAP.
 */
export function formatImapDate(date) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(d.getDate()).padStart(2, "0");
  const mon = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${mon}-${year}`;
}

/**
 * Escapa strings literais para comandos IMAP.
 *
 * @param {string} str - String a ser escapada.
 * @returns {string} String com aspas e barras escapadas.
 */
export function escapeImapString(str) {
  return (str || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Cliente IMAP nativo construído sobre sockets TLS/TCP para polling e leitura de e-mails DocuSign.
 * @class ImapClient
 */
export class ImapClient {
  /**
   * Cria uma instância de ImapClient.
   *
   * @param {Object} options - Configurações de conexão IMAP.
   * @param {string} options.host - Host do servidor IMAP.
   * @param {number} [options.port=993] - Porta do servidor IMAP.
   * @param {boolean} [options.tls=true] - Se deve usar TLS direto (imaps).
   * @param {number} [options.timeout=10000] - Timeout de conexão/comando em ms.
   */
  constructor(options = {}) {
    this.host = options.host || "unitynordeste.com.br";
    this.port = Number(options.port) || 993;
    this.useTls = options.tls !== false;
    this.timeout = options.timeout || 10000;
    this.tagCounter = 0;
    this.socket = null;
    this.authenticated = false;
    this.inboxSelected = false;
  }

  /**
   * Conecta ao servidor IMAP e aguarda o banner inicial de boas-vindas (* OK).
   *
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.close();
          reject(new Error(`Timeout (${this.timeout}ms) ao conectar ao servidor IMAP ${this.host}:${this.port}`));
        }
      }, this.timeout);

      const connectOpts = {
        host: this.host,
        port: this.port,
        rejectUnauthorized: false,
      };

      const onConnect = () => {
        // Conexão TCP/TLS estabelecida; aguarda o banner "* OK"
      };

      const onError = (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          reject(err);
        }
      };

      if (this.useTls) {
        this.socket = tls.connect(connectOpts, onConnect);
      } else {
        this.socket = net.connect(connectOpts, onConnect);
      }

      let buffer = "";
      const onData = (data) => {
        buffer += data.toString("utf8");
        if (buffer.includes("* OK") || buffer.includes("* PREAUTH")) {
          this.socket.removeListener("data", onData);
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timer);
            resolve();
          }
        }
      };

      this.socket.on("data", onData);
      this.socket.on("error", onError);
    });
  }

  /**
   * Envia um comando IMAP com tag única e aguarda a linha de conclusão (OK, NO ou BAD).
   *
   * @param {string} command - Comando IMAP (sem tag).
   * @returns {Promise<string>} Resposta bruta recebida do servidor.
   */
  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        return reject(new Error("Socket IMAP não está conectado"));
      }

      this.tagCounter += 1;
      const tag = `A${String(this.tagCounter).padStart(4, "0")}`;
      const rawCommand = `${tag} ${command}\r\n`;

      let responseBuffer = "";
      let isSettled = false;

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          reject(new Error(`Timeout (${this.timeout}ms) aguardando resposta para o comando: ${command}`));
        }
      }, this.timeout);

      const cleanup = () => {
        clearTimeout(timer);
        if (this.socket) {
          this.socket.removeListener("data", onData);
          this.socket.removeListener("error", onError);
        }
      };

      const onData = (data) => {
        responseBuffer += data.toString("utf8");
        const lines = responseBuffer.split("\r\n");
        for (const line of lines) {
          if (line.startsWith(`${tag} OK`)) {
            if (!isSettled) {
              isSettled = true;
              cleanup();
              resolve(responseBuffer);
            }
            return;
          }
          if (line.startsWith(`${tag} NO`) || line.startsWith(`${tag} BAD`)) {
            if (!isSettled) {
              isSettled = true;
              cleanup();
              reject(new Error(`Comando IMAP falhou (${line.trim()}): ${command}`));
            }
            return;
          }
        }
      };

      const onError = (err) => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          reject(err);
        }
      };

      this.socket.on("data", onData);
      this.socket.on("error", onError);
      this.socket.write(rawCommand);
    });
  }

  /**
   * Autentica no servidor IMAP via LOGIN.
   *
   * @param {string} email - Endereço de e-mail.
   * @param {string} password - Senha da conta.
   * @returns {Promise<void>}
   */
  async login(email, password) {
    const escapedEmail = escapeImapString(email);
    const escapedPassword = escapeImapString(password);
    await this.sendCommand(`LOGIN "${escapedEmail}" "${escapedPassword}"`);
    this.authenticated = true;
  }

  /**
   * Seleciona a caixa de entrada INBOX.
   *
   * @returns {Promise<void>}
   */
  async selectInbox() {
    await this.sendCommand("SELECT INBOX");
    this.inboxSelected = true;
  }

  /**
   * Busca mensagens na INBOX com critérios de assunto e data.
   *
   * @param {Object} [criteria={}] - Critérios de busca.
   * @param {string} [criteria.subject] - Filtro de assunto.
   * @param {Date} [criteria.since] - Data inicial de busca.
   * @returns {Promise<number[]>} Array de Sequence Numbers.
   */
  async search(criteria = {}) {
    let query = "SEARCH";
    if (criteria.subject) {
      query += ` SUBJECT "${escapeImapString(criteria.subject)}"`;
    }
    if (criteria.since instanceof Date && !isNaN(criteria.since.getTime())) {
      query += ` SINCE ${formatImapDate(criteria.since)}`;
    }
    if (query === "SEARCH") {
      query = "SEARCH ALL";
    }

    const res = await this.sendCommand(query);
    const match = res.match(/\*\s+SEARCH\s+([0-9\s]+)/i);
    if (!match || !match[1].trim()) {
      return [];
    }
    return match[1].trim().split(/\s+/).map((n) => parseInt(n, 10)).filter((n) => !isNaN(n) && n > 0);
  }

  /**
   * Busca e extrai o código MFA mais recente da caixa de entrada.
   *
   * @param {string} email - E-mail de autenticação.
   * @param {string} password - Senha de autenticação.
   * @param {Object} [options={}] - Parâmetros adicionais de filtro.
   * @param {string[]} [options.excludedCodes] - Lista de códigos já testados e rejeitados.
   * @param {number} [options.mfaTriggerTime] - Timestamp em ms do instante de disparo do login.
   * @param {number} [options.mfaMaxAgeMs] - Janela máxima em ms para mensagens pré-existentes.
   * @param {number} [options.clockDriftMarginMs=60000] - Margem de tolerância para clock drift em ms.
   * @param {string} [options.subjectFilter] - Filtro opcional de assunto.
   * @returns {Promise<string|null>} Código de 6 dígitos encontrado ou null.
   */
  async fetchLatestMfaCode(email, password, options = {}) {
    if (!this.authenticated) {
      await this.login(email, password);
    }
    if (!this.inboxSelected) {
      await this.selectInbox();
    }

    const {
      excludedCodes = [],
      mfaTriggerTime = null,
      mfaMaxAgeMs = DEFAULT_MFA_MAX_AGE_MS,
      clockDriftMarginMs = 60000,
      subjectFilter = null,
    } = options;

    const todayDate = new Date();
    let ids = await this.search({ since: todayDate });
    if (!ids || ids.length === 0) {
      const fallbackSince = mfaTriggerTime
        ? new Date(mfaTriggerTime - mfaMaxAgeMs)
        : new Date(Date.now() - mfaMaxAgeMs);
      ids = await this.search({ since: fallbackSince });
    }
    if (!ids || ids.length === 0) {
      ids = await this.search();
    }

    if (!ids || ids.length === 0) {
      return null;
    }

    // Analisa dos mais recentes para os mais antigos
    const recentIds = ids.slice(-10).reverse();

    for (const id of recentIds) {
      try {
        const fetchRes = await this.sendCommand(`FETCH ${id} (INTERNALDATE BODY.PEEK[])`);
        const metadata = parseEmailMetadata(fetchRes);

        // Validação de Assunto opcional
        if (subjectFilter && metadata.subject) {
          const matchesSubject = metadata.subject.toLowerCase().includes(subjectFilter.toLowerCase());
          if (!matchesSubject) continue;
        }

        // Validação estrita de Timestamp contra o momento de disparo do login
        if (mfaTriggerTime && metadata.date) {
          const emailTime = metadata.date.getTime();
          // Rejeita e-mails recebidos antes do disparo de login (com margem de clock drift)
          if (emailTime < (mfaTriggerTime - clockDriftMarginMs)) {
            continue;
          }
        }

        const code = extractMfaCodeFromText(metadata.body);

        if (code && /^\d{6}$/.test(code)) {
          if (excludedCodes.includes(code)) {
            continue;
          }
          // Marca a mensagem processada com sucesso como lida (\Seen)
          await this.sendCommand(`STORE ${id} +FLAGS (\\Seen)`).catch(() => {});
          return code;
        }
      } catch (err) {
        console.warn(`[IMAP] Erro ao buscar conteúdo do e-mail ID ${id}: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Envia comando LOGOUT e desativa estado de autenticação.
   *
   * @returns {Promise<void>}
   */
  async logout() {
    if (this.socket && !this.socket.destroyed && this.authenticated) {
      await this.sendCommand("LOGOUT").catch(() => {});
      this.authenticated = false;
      this.inboxSelected = false;
    }
  }

  /**
   * Encerra a conexão do socket com segurança.
   */
  close() {
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy();
    }
    this.authenticated = false;
    this.inboxSelected = false;
  }
}

/**
 * Função utilitária com polling para buscar o código MFA via IMAP.
 *
 * @param {Object} mailCredentials - Objeto { email, password, host, port, tls }.
 * @param {Object} [options={}] - Opções { maxWaitMs, pollIntervalMs, mfaTriggerTime, excludedCodes }.
 * @returns {Promise<string|null>} Código de 6 dígitos ou null.
 */
export async function fetchMfaCodeViaImap(mailCredentials, options = {}) {
  const email = mailCredentials?.email;
  const password = mailCredentials?.password;

  if (!email || !password) {
    console.warn("[IMAP] Credenciais de e-mail não informadas para consulta IMAP.");
    return null;
  }

  const host = mailCredentials?.host || "unitynordeste.com.br";
  const port = Number(mailCredentials?.port) || 993;
  const tlsEnabled = mailCredentials?.tls !== false;
  const maxWaitMs = typeof options.maxWaitMs === "number" ? options.maxWaitMs : DEFAULT_MFA_MAX_WAIT_MS;
  const mfaMaxAgeMs = typeof options.mfaMaxAgeMs === "number" ? options.mfaMaxAgeMs : DEFAULT_MFA_MAX_AGE_MS;
  let currentIntervalMs = options.pollIntervalMs || 3000;
  const excludedCodes = Array.isArray(options.excludedCodes) ? options.excludedCodes : [];
  const mfaTriggerTime = typeof options.mfaTriggerTime === "number" ? options.mfaTriggerTime : Date.now();

  const startedAt = Date.now();
  let client = null;

  console.log(`[IMAP] Iniciando busca automática de código MFA (E-mail: ${email}, Servidor: ${host}:${port})...`);

  try {
    while (Date.now() - startedAt < maxWaitMs) {
      try {
        if (!client || !client.socket || client.socket.destroyed) {
          client = new ImapClient({
            host,
            port,
            tls: tlsEnabled,
            timeout: 10000,
          });
          await client.connect();
        }

        const code = await client.fetchLatestMfaCode(email, password, {
          excludedCodes,
          mfaTriggerTime,
          mfaMaxAgeMs,
        });

        if (code) {
          console.log(`[IMAP] Código de verificação MFA recebido com sucesso: ${code}`);
          await client.logout().catch(() => {});
          client.close();
          client = null;
          return code;
        }
      } catch (err) {
        if (client) {
          client.close();
          client = null;
        }
        console.warn(`[IMAP] Tentativa de consulta IMAP falhou (${err.message}). Tentando novamente...`);
      }

      const remainingMs = maxWaitMs - (Date.now() - startedAt);
      if (remainingMs <= 0) break;

      const waitTime = Math.min(currentIntervalMs, remainingMs);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  } finally {
    if (client) {
      await client.logout().catch(() => {});
      client.close();
      client = null;
    }
  }

  console.error(`[IMAP] Tempo limite esgotado (${maxWaitMs / 1000}s). Nenhum código de verificação recebido via IMAP.`);
  return null;
}

export default {
  decodeQuotedPrintable,
  decodeBase64,
  decodeMimeHeader,
  parseEmailMetadata,
  extractMfaCodeFromText,
  formatImapDate,
  escapeImapString,
  ImapClient,
  fetchMfaCodeViaImap,
};
