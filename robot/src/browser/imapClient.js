import tls from "node:tls";
import net from "node:net";

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
 * Extrai o código de 6 dígitos do corpo da mensagem DocuSign.
 * @param {string} text - Texto bruto ou decodificado do e-mail.
 * @returns {string|null} Código de 6 dígitos ou null.
 */
export function extractMfaCodeFromText(text) {
  if (!text || typeof text !== "string") return null;

  // Decodifica Quoted-Printable se houver caracteres ou quebras escapadas
  let processedText = decodeQuotedPrintable(text);

  // Padrões de regex para código de segurança DocuSign
  const patterns = [
    /Seu c[oó]digo de verifica[cç][aã]o da Docusign [eé]:\s*(\d{6})/i,
    /c[oó]digo de verifica[cç][aã]o[^0-9]{1,30}(\d{6})/i,
    /verification code[^0-9]{1,30}(\d{6})/i,
    /security code[^0-9]{1,30}(\d{6})/i,
    /\b(\d{6})\b/,
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
 * Cliente IMAP nativo em socket TCP/TLS sem dependências externas.
 */
export class ImapClient {
  constructor(options = {}) {
    this.host = options.host || "unitynordeste.com.br";
    this.port = Number(options.port) || 993;
    this.tls = options.tls !== false;
    this.timeout = options.timeout || 15000;
    this.socket = null;
    this.tagIndex = 0;
    this.buffer = "";
  }

  /**
   * Conecta ao servidor IMAP e aguarda o greeting inicial (* OK).
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.socket) this.socket.destroy();
        reject(new Error(`Timeout na conexão IMAP com ${this.host}:${this.port}`));
      }, this.timeout);

      const onConnect = () => {
        clearTimeout(timer);
      };

      if (this.tls) {
        this.socket = tls.connect(
          {
            host: this.host,
            port: this.port,
            rejectUnauthorized: false,
          },
          onConnect
        );
      } else {
        this.socket = net.connect(
          {
            host: this.host,
            port: this.port,
          },
          onConnect
        );
      }

      this.socket.setEncoding("utf8");

      let greetingReceived = false;
      this.socket.on("data", (chunk) => {
        this.buffer += chunk;
        if (!greetingReceived && this.buffer.includes("* OK")) {
          greetingReceived = true;
          this.buffer = "";
          resolve(true);
        }
      });

      this.socket.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      this.socket.on("close", () => {
        clearTimeout(timer);
      });
    });
  }

  /**
   * Envia um comando IMAP com tag única e aguarda a resposta final com a mesma tag.
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
        reject(new Error(`Timeout aguardando resposta do comando IMAP: ${command}`));
      }, this.timeout);

      const onData = (chunk) => {
        cmdBuffer += chunk;
        const tagPattern = new RegExp(`^${tag}\\s+(OK|NO|BAD)`, "m");
        if (tagPattern.test(cmdBuffer)) {
          clearTimeout(timer);
          this.socket.off("data", onData);
          resolve({ tag, raw: cmdBuffer });
        }
      };

      this.socket.on("data", onData);
      this.socket.write(fullCommand);
    });
  }

  /**
   * Executa o fluxo de autenticação, seleção da caixa e extração do código MFA.
   * @param {string} email - Usuário/Email IMAP.
   * @param {string} password - Senha da conta.
   * @returns {Promise<string|null>} Código extraído ou null.
   */
  async fetchLatestMfaCode(email, password) {
    // 1. LOGIN
    const loginRes = await this.sendCommand(`LOGIN "${email}" "${password}"`);
    if (!loginRes.raw.includes(" OK")) {
      throw new Error(`Falha no comando IMAP LOGIN: ${loginRes.raw.trim()}`);
    }

    // 2. SELECT INBOX
    const selectRes = await this.sendCommand("SELECT INBOX");
    if (!selectRes.raw.includes(" OK")) {
      throw new Error(`Falha ao selecionar INBOX: ${selectRes.raw.trim()}`);
    }

    // 3. UID SEARCH (busca não lidos ou todos)
    let searchRes = await this.sendCommand('UID SEARCH UNSEEN SUBJECT "Verificar"');
    let uids = this.parseUidsFromSearch(searchRes.raw);

    if (uids.length === 0) {
      searchRes = await this.sendCommand("UID SEARCH UNSEEN");
      uids = this.parseUidsFromSearch(searchRes.raw);
    }

    if (uids.length === 0) {
      searchRes = await this.sendCommand('UID SEARCH ALL SUBJECT "Verificar"');
      uids = this.parseUidsFromSearch(searchRes.raw);
    }

    if (uids.length === 0) {
      searchRes = await this.sendCommand("UID SEARCH ALL");
      uids = this.parseUidsFromSearch(searchRes.raw);
    }

    if (uids.length === 0) {
      return null;
    }

    // Pega o UID mais recente (maior número)
    const latestUid = Math.max(...uids);

    // 4. UID FETCH do corpo da mensagem
    const fetchRes = await this.sendCommand(`UID FETCH ${latestUid} (BODY.PEEK[])`);
    const code = extractMfaCodeFromText(fetchRes.raw);

    if (code) {
      // 5. Marca a mensagem como lida (\Seen)
      await this.sendCommand(`UID STORE ${latestUid} +FLAGS (\\Seen)`).catch(() => {});
    }

    // 6. LOGOUT
    await this.sendCommand("LOGOUT").catch(() => {});

    return code;
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
   * Encerra a conexão do socket com segurança.
   */
  close() {
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy();
    }
  }
}

/**
 * Função utilitária com polling para buscar o código MFA via IMAP.
 *
 * @param {Object} mailCredentials - Objeto { email, password, host, port, tls }.
 * @param {Object} [options] - Opções { maxWaitMs, pollIntervalMs }.
 * @returns {Promise<string|null>} Código de 6 dígitos ou null.
 */
export async function fetchMfaCodeViaImap(mailCredentials, options = {}) {
  const email = mailCredentials?.email;
  const password = mailCredentials?.password;

  if (!email || !password) {
    return null;
  }

  const host = mailCredentials?.host || "unitynordeste.com.br";
  const port = Number(mailCredentials?.port) || 993;
  const tlsEnabled = mailCredentials?.tls !== false;
  const maxWaitMs = options.maxWaitMs || 30000;
  const pollIntervalMs = options.pollIntervalMs || 2500;

  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const client = new ImapClient({
      host,
      port,
      tls: tlsEnabled,
      timeout: 10000,
    });

    try {
      await client.connect();
      const code = await client.fetchLatestMfaCode(email, password);
      client.close();

      if (code) {
        console.log(`[IMAP] Código MFA extraído com sucesso via protocolo IMAP: ${code}`);
        return code;
      }
    } catch (err) {
      client.close();
      console.warn(`[IMAP] Tentativa de consulta IMAP falhou (${err.message}). Aguardando próximo ciclo...`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return null;
}

export default {
  decodeQuotedPrintable,
  decodeBase64,
  extractMfaCodeFromText,
  ImapClient,
  fetchMfaCodeViaImap,
};
