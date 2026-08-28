import tls from "node:tls";
import net from "node:net";
import logger from "../utils/logger.js";

/**
 * Decodifica texto codificado em Quoted-Printable para UTF-8.
 * @param {string} input - String codificada em Quoted-Printable.
 * @returns {string} Texto decodificado em UTF-8.
 */
export function decodeQuotedPrintable(input) {
  if (!input || typeof input !== "string") return "";
  // 1. Remove quebras de linha suaves (soft line breaks: =\r\n ou =\n)
  const cleaned = input.replace(/=\r?\n/g, "");
  // 2. Converte sequências contíguas de =XX para bytes UTF-8
  return cleaned.replace(/((?:=[0-9A-Fa-f]{2})+)/g, (match) => {
    try {
      const hexes = match.split("=").filter(Boolean);
      const bytes = hexes.map((h) => parseInt(h, 16));
      return Buffer.from(bytes).toString("utf8");
    } catch {
      return match;
    }
  });
}

/**
 * Decodifica texto codificado em Base64 para UTF-8.
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
 * @param {string} charset - Nome do charset (ex: utf-8, iso-8859-1, windows-1252, etc.).
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
 * Trata desdobramento de linhas (header folding - RFC 5322) e múltiplos blocos MIME consecutivos.
 * @param {string} header - Valor bruto do cabeçalho de e-mail.
 * @returns {string} Cabeçalho decodificado em UTF-8.
 */
export function decodeMimeHeader(header) {
  if (!header || typeof header !== "string") return "";
  const unfolded = header.replace(/\r?\n[ \t]+/g, " ");
  const collapsedWords = unfolded.replace(/(=\?[^?]+\?[BQbq]\?[^?]+\?=)[ \t]+(?==\?[^?]+\?[BQbq]\?[^?]+\?=)/g, "$1");
  const rfc2047Regex = /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g;
  const decoded = collapsedWords.replace(rfc2047Regex, (_, charset, encoding, text) => {
    const enc = encoding.toUpperCase();
    const bufEncoding = getBufferEncoding(charset);
    try {
      if (enc === "B") {
        return Buffer.from(text, "base64").toString(bufEncoding);
      }
      if (enc === "Q") {
        const qp = text.replace(/_/g, " ");
        return decodeQuotedPrintable(qp);
      }
    } catch {
      return text;
    }
    return text;
  });
  return decodeQuotedPrintable(decoded).trim();
}

/**
 * Extrai metadados (Subject, Date, body) de uma resposta de FETCH IMAP.
 * Realiza unfolding de cabeçalhos RFC 5322 para suportar campos multi-linha.
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
 * @param {string} text - Texto bruto ou decodificado do e-mail.
 * @returns {string|null} Código de 6 dígitos ou null.
 */
export function extractMfaCodeFromText(text) {
  if (!text || typeof text !== "string") return null;

  // Decodifica Quoted-Printable se houver caracteres ou quebras escapadas
  let processedText = decodeQuotedPrintable(text);

  // Padrões de regex estritos para código de segurança DocuSign
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

  // Tenta também procurar blocos base64 no texto bruto se nenhum código foi encontrado
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
 * Formata um objeto Date no padrão aceito pelo protocolo IMAP (DD-Mon-YYYY).
 * Ex: 02-Aug-2026 ou 27-Aug-2026
 * @param {Date} [date] - Data de referência.
 * @returns {string} Data formatada no padrão RFC 3501 com dia zero-padded.
 */
export function formatImapDate(date = new Date()) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Escapa caracteres especiais para strings entre aspas no protocolo IMAP (RFC 3501).
 * @param {string} str - String a ser escapada.
 * @returns {string} String com barras invertidas e aspas escapadas.
 */
export function escapeImapString(str) {
  if (typeof str !== "string") return "";
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Cliente IMAP nativo em socket TCP/TLS sem dependências externas.
 */
export class ImapClient {
  /**
   * Cria uma instância do cliente IMAP nativo.
   * @param {Object} [options={}] - Opções de conexão.
   * @param {string} [options.host="unitynordeste.com.br"] - Host do servidor IMAP.
   * @param {number|string} [options.port=993] - Porta do servidor IMAP.
   * @param {boolean} [options.tls=true] - Se deve usar TLS.
   * @param {number} [options.timeout=15000] - Timeout de conexão/comandos em ms.
   */
  constructor(options = {}) {
    this.host = options.host || "unitynordeste.com.br";
    this.port = Number(options.port) || 993;
    this.tls = options.tls !== false;
    this.timeout = options.timeout || 15000;
    this.socket = null;
    this.tagIndex = 0;
    this.buffer = "";
    this.authenticated = false;
    this.inboxSelected = false;
  }

  /**
   * Conecta ao servidor IMAP e aguarda o greeting inicial (* OK).
   * @returns {Promise<boolean>} Retorna true se conectado e recebido o greeting do servidor.
   */
  async connect() {
    logger.step("IMAP", `Iniciando conexão de socket com o servidor de e-mail (${this.host}:${this.port}, TLS: ${this.tls})...`);
    return new Promise((resolve, reject) => {
      let greetingReceived = false;

      const timer = setTimeout(() => {
        cleanup();
        if (this.socket) this.socket.destroy();
        const err = new Error(`Timeout na conexão IMAP com ${this.host}:${this.port}`);
        logger.error("IMAP", err.message);
        reject(err);
      }, this.timeout);

      const cleanup = () => {
        clearTimeout(timer);
        if (this.socket) {
          this.socket.off("data", onData);
          this.socket.off("error", onError);
          this.socket.off("close", onClose);
        }
      };

      const onData = (chunk) => {
        this.buffer += chunk;
        if (!greetingReceived && this.buffer.includes("* OK")) {
          greetingReceived = true;
          this.buffer = "";
          cleanup();
          logger.success("IMAP", `Conexão estabelecida e servidor IMAP pronto (${this.host}:${this.port}).`);
          resolve(true);
        }
      };

      const onError = (err) => {
        cleanup();
        logger.error("IMAP", `Erro na comunicação de socket IMAP: ${err.message}`);
        reject(err);
      };

      const onClose = () => {
        if (!greetingReceived) {
          cleanup();
          const err = new Error(`Conexão fechada antes do greeting inicial do servidor IMAP (${this.host}:${this.port})`);
          logger.error("IMAP", err.message);
          reject(err);
        }
      };

      if (this.tls) {
        this.socket = tls.connect(
          {
            host: this.host,
            port: this.port,
            rejectUnauthorized: false,
          }
        );
      } else {
        this.socket = net.connect(
          {
            host: this.host,
            port: this.port,
          }
        );
      }

      this.socket.setEncoding("utf8");
      this.socket.on("data", onData);
      this.socket.on("error", onError);
      this.socket.on("close", onClose);
    });
  }

  /**
   * Envia um comando IMAP com tag única e aguarda a resposta final com a mesma tag.
   * Possui tratamento imediato de desconexão e encerramento de socket sem reter timeout.
   * @param {string} command - Comando IMAP (sem a tag).
   * @returns {Promise<{ tag: string, response: string, raw: string }>}
   */
  async sendCommand(command) {
    if (!this.socket || this.socket.destroyed) {
      throw new Error("Socket IMAP não está conectado");
    }

    this.tagIndex += 1;
    const tag = `A${String(this.tagIndex).padStart(4, "0")}`;
    const fullCommand = `${tag} ${command}\r\n`;

    return new Promise((resolve, reject) => {
      let cmdBuffer = "";
      const timer = setTimeout(() => {
        cleanup();
        const err = new Error(`Timeout aguardando resposta do comando IMAP: ${command.split(" ")[0]}`);
        logger.error("IMAP", err.message);
        reject(err);
      }, this.timeout);

      const cleanup = () => {
        clearTimeout(timer);
        if (this.socket) {
          this.socket.off("data", onData);
          this.socket.off("error", onError);
          this.socket.off("close", onClose);
        }
      };

      const onError = (err) => {
        cleanup();
        logger.error("IMAP", `Erro no socket durante comando (${command.split(" ")[0]}): ${err.message}`);
        reject(new Error(`Erro no socket durante comando IMAP (${command}): ${err.message}`));
      };

      const onClose = () => {
        cleanup();
        logger.warn("IMAP", `Socket IMAP fechado durante comando: ${command.split(" ")[0]}`);
        reject(new Error(`Socket IMAP fechado inesperadamente durante comando: ${command}`));
      };

      const onData = (chunk) => {
        cmdBuffer += chunk;
        const tagPattern = new RegExp(`(?:^|\\r?\\n)${tag}\\s+(OK|NO|BAD)([^\\r\\n]*)?(?:\\r?\\n|$)`);
        const match = cmdBuffer.match(tagPattern);
        if (match) {
          cleanup();
          resolve({ tag, response: match[1], raw: cmdBuffer });
        }
      };

      this.socket.on("data", onData);
      this.socket.on("error", onError);
      this.socket.on("close", onClose);
      this.socket.write(fullCommand);
    });
  }

  /**
   * Autentica no servidor IMAP caso ainda não autenticado (RFC 3501).
   * @param {string} email - Usuário/Email IMAP.
   * @param {string} password - Senha da conta.
   * @returns {Promise<void>}
   */
  async login(email, password) {
    if (this.authenticated) return;
    logger.step("IMAP", `Enviando credenciais de autenticação IMAP (${email})...`);
    const escapedEmail = escapeImapString(email);
    const escapedPassword = escapeImapString(password);
    const loginRes = await this.sendCommand(`LOGIN "${escapedEmail}" "${escapedPassword}"`);
    if (!loginRes.raw.includes(" OK")) {
      logger.error("IMAP", `Falha na autenticação IMAP: ${loginRes.raw.trim()}`);
      throw new Error(`Falha no comando IMAP LOGIN: ${loginRes.raw.trim()}`);
    }
    this.authenticated = true;
    logger.success("IMAP", `Usuário IMAP autenticado com sucesso (${email}).`);
  }

  /**
   * Seleciona a pasta INBOX caso ainda não selecionada.
   * @returns {Promise<void>}
   */
  async selectInbox() {
    if (this.inboxSelected) return;
    logger.step("IMAP", "Selecionando pasta de entrada (INBOX)...");
    const selectRes = await this.sendCommand("SELECT INBOX");
    if (!selectRes.raw.includes(" OK")) {
      logger.error("IMAP", `Falha ao selecionar INBOX: ${selectRes.raw.trim()}`);
      throw new Error(`Falha ao selecionar INBOX: ${selectRes.raw.trim()}`);
    }
    this.inboxSelected = true;
    logger.success("IMAP", "Pasta INBOX selecionada com sucesso.");
  }

  /**
   * Executa a consulta e extração do código MFA mais recente.
   * Reutiliza autenticação e seleção de caixa caso a conexão já esteja aberta.
   * Utiliza 2 padrões de busca temporal (SINCE e fallback ALL) e filtra no cliente.
   * @param {string} email - Usuário/Email IMAP.
   * @param {string} password - Senha da conta.
   * @param {Object} [options={}] - Opções de busca (ex: excludedCodes, mfaTriggerTime, subjectFilter).
   * @param {string[]} [options.excludedCodes=[]] - Códigos já testados e inválidos a ignorar.
   * @param {number} [options.mfaTriggerTime] - Timestamp (ms) em que o MFA foi disparado na tela.
   * @param {string} [options.subjectFilter="Verificar um novo dispositivo"] - Texto esperado no assunto do e-mail.
   * @returns {Promise<string|null>} Código extraído ou null.
   */
  async fetchLatestMfaCode(email, password, options = {}) {
    await this.login(email, password);
    await this.selectInbox();

    const excludedCodes = Array.isArray(options.excludedCodes) ? options.excludedCodes : [];
    const expectedSubject = typeof options.subjectFilter === "string" ? options.subjectFilter : "Verificar um novo dispositivo";
    const mfaTriggerTime = typeof options.mfaTriggerTime === "number" ? options.mfaTriggerTime : null;

    // 1. Busca mensagens do dia atual (SINCE)
    const todaySince = formatImapDate();
    logger.step("IMAP", `Pesquisando e-mails recentes (SINCE ${todaySince})...`);
    let searchRes = await this.sendCommand(`UID SEARCH SINCE ${todaySince}`);
    let uids = this.parseUidsFromSearch(searchRes.raw);

    // 2. Fallback caso timezone/servidor não corresponda ao SINCE
    if (uids.length === 0) {
      logger.step("IMAP", "Nenhum e-mail retornado com filtro SINCE. Executando busca geral (UID SEARCH ALL)...");
      searchRes = await this.sendCommand("UID SEARCH ALL");
      uids = this.parseUidsFromSearch(searchRes.raw);
    }

    if (uids.length === 0) {
      logger.warn("IMAP", "Nenhum e-mail encontrado na caixa de entrada.");
      return null;
    }

    logger.step("IMAP", `${uids.length} e-mail(s) encontrado(s). Analisando mensagens recentes para extração do código DocuSign...`);

    // 3. Itera UIDs em ordem decrescente — previne falso positivo se última msg não for MFA
    const sortedUids = [...uids].sort((a, b) => b - a);
    for (const uid of sortedUids) {
      logger.step("IMAP", `Lendo mensagem UID ${uid}...`);
      const fetchRes = await this.sendCommand(`UID FETCH ${uid} (INTERNALDATE BODY.PEEK[])`);
      const metadata = parseEmailMetadata(fetchRes.raw);

      // Validação de Assunto (Subject)
      const subjectMatches = metadata.subject.toLowerCase().includes(expectedSubject.toLowerCase());
      if (!subjectMatches) {
        logger.step("IMAP", `Mensagem UID ${uid} ignorada: assunto "${metadata.subject || "(sem assunto)"}" não corresponde a "${expectedSubject}".`);
        continue;
      }

      // Validação de Timestamp (mfaTriggerTime)
      if (mfaTriggerTime) {
        if (!metadata.date) {
          logger.warn("IMAP", `Mensagem UID ${uid} ignorada: sem data/INTERNALDATE para validar mfaTriggerTime.`);
          continue;
        }
        const toleranceMs = 30000; // 30s de tolerância para skew de relógio
        if (metadata.date.getTime() < mfaTriggerTime - toleranceMs) {
          logger.step("IMAP", `Mensagem UID ${uid} ignorada: recebida em ${metadata.date.toISOString()} (anterior ao disparo de MFA ${new Date(mfaTriggerTime).toISOString()}).`);
          continue;
        }
      }

      const code = extractMfaCodeFromText(metadata.body);
      if (code) {
        if (excludedCodes.includes(code)) {
          logger.step("IMAP", `Código ${code} (UID ${uid}) já foi testado e rejeitado. Ignorando para aguardar novo código...`);
          continue;
        }
        logger.success("IMAP", `Código de segurança da DocuSign localizado e extraído com sucesso: ${code}`);
        // 4. Marca apenas a mensagem que continha o código como lida (\Seen)
        await this.sendCommand(`UID STORE ${uid} +FLAGS (\\Seen)`).catch(() => {});
        return code;
      }
    }

    logger.warn("IMAP", "E-mails analisados, mas nenhum novo código de verificação DocuSign foi identificado.");
    return null;
  }

  /**
   * Extrai lista de números UID da resposta do comando UID SEARCH.
   * @param {string} raw - Resposta bruta.
   * @returns {number[]} Array de UIDs.
   */
  parseUidsFromSearch(raw) {
    const match = raw.match(/\*\s+SEARCH\s+([\d\s]+)/i);
    if (!match || !match[1]) return [];
    return match[1]
      .trim()
      .split(/\s+/)
      .map((n) => parseInt(n, 10))
      .filter((n) => !isNaN(n) && n > 0);
  }

  /**
   * Envia comando LOGOUT e desativa estado de autenticação.
   * @returns {Promise<void>}
   */
  async logout() {
    if (this.socket && !this.socket.destroyed && this.authenticated) {
      logger.step("IMAP", "Encerrando sessão IMAP (LOGOUT)...");
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
 * Função utilitária com polling e backoff adaptativo para buscar o código MFA via IMAP.
 * Mantém e reutiliza a mesma conexão IMAP durante as tentativas, reconectando apenas em falha.
 *
 * @param {Object} mailCredentials - Objeto { email, password, host, port, tls }.
 * @param {Object} [options] - Opções { maxWaitMs, pollIntervalMs, backoffFactor, maxPollIntervalMs, excludedCodes, mfaTriggerTime, subjectFilter }.
 * @param {string[]} [options.excludedCodes=[]] - Lista de códigos já testados a ignorar.
 * @param {number} [options.mfaTriggerTime] - Timestamp (ms) do disparo da tela MFA.
 * @param {string} [options.subjectFilter="Verificar um novo dispositivo"] - Texto esperado no assunto.
 * @returns {Promise<string|null>} Código de 6 dígitos ou null.
 */
export async function fetchMfaCodeViaImap(mailCredentials, options = {}) {
  const email = mailCredentials?.email;
  const password = mailCredentials?.password;

  if (!email || !password) {
    logger.warn("IMAP", "Credenciais de e-mail não informadas para consulta IMAP.");
    return null;
  }

  const host = mailCredentials?.host || "unitynordeste.com.br";
  const port = Number(mailCredentials?.port) || 993;
  const tlsEnabled = mailCredentials?.tls !== false;
  const maxWaitMs = options.maxWaitMs || 30000;
  let currentIntervalMs = options.pollIntervalMs || 3000;
  const backoffFactor = options.backoffFactor || 1.2;
  const maxPollIntervalMs = options.maxPollIntervalMs || 6000;
  const excludedCodes = Array.isArray(options.excludedCodes) ? options.excludedCodes : [];
  const mfaTriggerTime = typeof options.mfaTriggerTime === "number" ? options.mfaTriggerTime : null;
  const subjectFilter = options.subjectFilter;

  const startedAt = Date.now();
  let client = null;

  logger.step("IMAP", `Iniciando rotina de verificação de código MFA (E-mail: ${email}, Servidor: ${host}:${port}, Tempo máx: ${maxWaitMs / 1000}s)...`);

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
          subjectFilter,
        });

        if (code) {
          logger.success("IMAP", `Código de verificação MFA recebido com sucesso: ${code}`);
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
        logger.warn("IMAP", `Tentativa de consulta IMAP falhou (${err.message}). Tentando novamente em breve...`);
      }

      const remainingMs = maxWaitMs - (Date.now() - startedAt);
      if (remainingMs <= 0) break;

      const waitTime = Math.min(currentIntervalMs, remainingMs);
      logger.step("IMAP", `Aguardando ${waitTime / 1000}s para checar nova mensagem de verificação da DocuSign...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      currentIntervalMs = Math.min(Math.round(currentIntervalMs * backoffFactor), maxPollIntervalMs);
    }
  } finally {
    if (client) {
      await client.logout().catch(() => {});
      client.close();
      client = null;
    }
  }

  logger.error("IMAP", `Tempo limite esgotado (${maxWaitMs / 1000}s). Nenhum código de verificação recebido via IMAP.`);
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
