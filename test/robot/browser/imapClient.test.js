import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import {
  decodeQuotedPrintable,
  decodeBase64,
  decodeMimeHeader,
  parseEmailMetadata,
  extractMfaCodeFromText,
  formatImapDate,
  escapeImapString,
  ImapClient,
  fetchMfaCodeViaImap,
} from "../../../robot/src/browser/imapClient.js";

describe("Robot Standalone - IMAP MFA Client Tests", () => {
  describe("formatImapDate", () => {
    it("deve formatar data no padrão RFC 3501 (DD-Mon-YYYY) com zero-padding para dia < 10", () => {
      const singleDigitDate = new Date(2026, 7, 2); // 2 de Agosto de 2026
      assert.equal(formatImapDate(singleDigitDate), "02-Aug-2026");

      const doubleDigitDate = new Date(2026, 7, 27); // 27 de Agosto de 2026
      assert.equal(formatImapDate(doubleDigitDate), "27-Aug-2026");
    });
  });

  describe("escapeImapString", () => {
    it("deve escapar aspas duplas e barras invertidas no formato RFC 3501", () => {
      const input = 'my\\secret"pass"';
      const escaped = escapeImapString(input);
      assert.equal(escaped, 'my\\\\secret\\"pass\\"');
    });

    it("deve tratar valores não-string retornando string vazia", () => {
      assert.equal(escapeImapString(null), "");
      assert.equal(escapeImapString(undefined), "");
    });
  });

  describe("decodeMimeHeader", () => {
    it("deve decodificar cabeçalho RFC 2047 em Base64", () => {
      const encoded = "=?UTF-8?B?VmVyaWZpY2FyIHVtIG5vdm8gZGlzcG9zaXRpdm8=?=";
      const result = decodeMimeHeader(encoded);
      assert.equal(result, "Verificar um novo dispositivo");
    });

    it("deve decodificar cabeçalho RFC 2047 em Quoted-Printable", () => {
      const encoded = "=?UTF-8?Q?Verificar_um_novo_dispositivo?=";
      const result = decodeMimeHeader(encoded);
      assert.equal(result, "Verificar um novo dispositivo");
    });

    it("deve decodificar cabeçalho com header folding (RFC 5322) e múltiplos blocos MIME", () => {
      const folded = "=?UTF-8?B?VmVyaWZpY2FyIHVt?=\r\n =?UTF-8?B?IG5vdm8gZGlzcG9zaXRpdm8=?=";
      const result = decodeMimeHeader(folded);
      assert.equal(result, "Verificar um novo dispositivo");
    });

    it("deve decodificar cabeçalho com charset ISO-8859-1 / Latin1", () => {
      const encoded = "=?ISO-8859-1?Q?C=F3digo_de_Seguran=E7a?=";
      const result = decodeMimeHeader(encoded);
      assert.equal(result, "Código de Segurança");
    });

    it("deve retornar texto puro se não possuir codificação RFC 2047", () => {
      const plain = "Verificar um novo dispositivo";
      assert.equal(decodeMimeHeader(plain), plain);
      assert.equal(decodeMimeHeader(null), "");
      assert.equal(decodeMimeHeader(""), "");
    });
  });

  describe("parseEmailMetadata", () => {
    it("deve extrair INTERNALDATE e Subject de resposta IMAP", () => {
      const raw = `* 1 FETCH (UID 100 INTERNALDATE "28-Aug-2026 12:00:00 +0000" BODY[] {120}\r\nSubject: =?UTF-8?B?VmVyaWZpY2FyIHVtIG5vdm8gZGlzcG9zaXRpdm8=?=\r\nDate: Fri, 28 Aug 2026 12:00:00 +0000\r\n\r\nCorpo)`;
      const meta = parseEmailMetadata(raw);
      assert.equal(meta.subject, "Verificar um novo dispositivo");
      assert.ok(meta.date instanceof Date);
      assert.equal(meta.date.getUTCFullYear(), 2026);
    });

    it("deve extrair Subject com quebra de linha continuada (header folding RFC 5322)", () => {
      const raw = `* 1 FETCH (UID 100 INTERNALDATE "28-Aug-2026 12:00:00 +0000" BODY[] {120}\r\nSubject: =?UTF-8?B?VmVyaWZpY2FyIHVt?=\r\n =?UTF-8?B?IG5vdm8gZGlzcG9zaXRpdm8=?=\r\nDate: Fri, 28 Aug 2026 12:00:00 +0000\r\n\r\nCorpo)`;
      const meta = parseEmailMetadata(raw);
      assert.equal(meta.subject, "Verificar um novo dispositivo");
    });

    it("deve extrair data do cabeçalho Date quando INTERNALDATE não estiver presente", () => {
      const raw = `Subject: Verificar um novo dispositivo\r\nDate: Fri, 28 Aug 2026 14:30:00 -0300\r\n\r\nCorpo`;
      const meta = parseEmailMetadata(raw);
      assert.equal(meta.subject, "Verificar um novo dispositivo");
      assert.ok(meta.date instanceof Date);
    });
  });

  describe("decodeQuotedPrintable", () => {
    it("deve decodificar quebras suaves de linha (soft line breaks)", () => {
      const input = "Seu c=\r\nódigo de veri=\nficação";
      const result = decodeQuotedPrintable(input);
      assert.match(result, /Seu código de verificação/);
    });

    it("deve decodificar sequências UTF-8 em Quoted-Printable", () => {
      const input = "Seu c=C3=B3digo de verifica=C3=A7=C3=A3o da Docusign =C3=A9: 987654";
      const result = decodeQuotedPrintable(input);
      assert.equal(result, "Seu código de verificação da Docusign é: 987654");
    });

    it("deve retornar string vazia para entrada nula ou inválida", () => {
      assert.equal(decodeQuotedPrintable(null), "");
      assert.equal(decodeQuotedPrintable(undefined), "");
      assert.equal(decodeQuotedPrintable(""), "");
    });
  });

  describe("decodeBase64", () => {
    it("deve decodificar Base64 padrão em UTF-8", () => {
      const plain = "Seu código de verificação da Docusign é: 456789";
      const b64 = Buffer.from(plain, "utf8").toString("base64");
      assert.equal(decodeBase64(b64), plain);
    });

    it("deve retornar string vazia para entrada vazia ou inválida", () => {
      assert.equal(decodeBase64(null), "");
      assert.equal(decodeBase64(""), "");
    });
  });

  describe("extractMfaCodeFromText", () => {
    it("deve extrair código de 6 dígitos no padrão em português oficial", () => {
      const emailBody = `
        Olá,
        Seu código de verificação da Docusign é: 849201
        Este código expira em 10 minutos.
      `;
      const code = extractMfaCodeFromText(emailBody);
      assert.equal(code, "849201");
    });

    it("deve extrair código com variação sem acentuação", () => {
      const emailBody = "Seu codigo de verificacao da Docusign e: 123456";
      const code = extractMfaCodeFromText(emailBody);
      assert.equal(code, "123456");
    });

    it("deve extrair código codificado em Quoted-Printable", () => {
      const qpBody = "Seu c=C3=B3digo de verifica=C3=A7=C3=A3o da Docusign =C3=A9:=20=0D=0A741852";
      const code = extractMfaCodeFromText(qpBody);
      assert.equal(code, "741852");
    });

    it("deve extrair código embutido em bloco Base64", () => {
      const innerText = "Your verification code: 369258";
      const b64 = Buffer.from(innerText, "utf8").toString("base64");
      const rawEmail = `Content-Transfer-Encoding: base64\r\n\r\n${b64}\r\n`;
      const code = extractMfaCodeFromText(rawEmail);
      assert.equal(code, "369258");
    });

    it("não deve extrair números aleatórios de 6 dígitos sem contexto de verificação DocuSign (remoção regex genérica)", () => {
      const emailBody = "O número do seu contrato é 654321 e seu protocolo é 000000.";
      assert.equal(extractMfaCodeFromText(emailBody), null);
    });

    it("deve retornar null se não encontrar código de 6 dígitos", () => {
      const emailBody = "Bem-vindo à DocuSign. Seu documento foi assinado com sucesso.";
      assert.equal(extractMfaCodeFromText(emailBody), null);
      assert.equal(extractMfaCodeFromText(""), null);
      assert.equal(extractMfaCodeFromText(null), null);
    });
  });

  describe("ImapClient Socket Error & Drop Resilience", () => {
    let crashServer = null;
    let crashPort = 0;

    before(async () => {
      await new Promise((resolve) => {
        crashServer = net.createServer((socket) => {
          socket.setEncoding("utf8");
          socket.write("* OK Mock Server Ready\r\n");

          socket.on("data", () => {
            // Fecha abruptamente na primeira mensagem recebida
            socket.destroy();
          });
        });

        crashServer.listen(0, "127.0.0.1", () => {
          crashPort = crashServer.address().port;
          resolve();
        });
      });
    });

    after(async () => {
      if (crashServer) {
        await new Promise((resolve) => crashServer.close(resolve));
      }
    });

    it("deve rejeitar sendCommand imediatamente se o socket fechar sem aguardar timeout", async () => {
      const client = new ImapClient({
        host: "127.0.0.1",
        port: crashPort,
        tls: false,
        timeout: 10000,
      });

      await client.connect();

      const startTime = Date.now();
      await assert.rejects(
        async () => {
          await client.sendCommand("LOGIN test test");
        },
        /Socket IMAP fechado|Erro no socket/
      );

      const elapsed = Date.now() - startTime;
      assert.ok(elapsed < 2000, `Deveria rejeitar imediatamente em < 2s, mas levou ${elapsed}ms`);
      client.close();
    });

    it("deve rejeitar connect imediatamente se o socket fechar antes do greeting", async () => {
      let silentServer = null;
      let silentPort = 0;

      await new Promise((resolve) => {
        silentServer = net.createServer((socket) => {
          // Fecha imediatamente sem enviar * OK
          socket.destroy();
        });
        silentServer.listen(0, "127.0.0.1", () => {
          silentPort = silentServer.address().port;
          resolve();
        });
      });

      const client = new ImapClient({
        host: "127.0.0.1",
        port: silentPort,
        tls: false,
        timeout: 5000,
      });

      await assert.rejects(
        async () => {
          await client.connect();
        },
        /Conexão fechada antes do greeting/
      );

      client.close();
      await new Promise((resolve) => silentServer.close(resolve));
    });
  });

  describe("ImapClient Mock Server", () => {
    let server = null;
    let serverPort = 0;
    const receivedCommands = [];

    before(async () => {
      await new Promise((resolve) => {
        server = net.createServer((socket) => {
          socket.setEncoding("utf8");
          socket.write("* OK [CAPABILITY IMAP4rev1] Mock IMAP Server Ready\r\n");

          socket.on("data", (data) => {
            const lines = data.split("\r\n").filter(Boolean);
            for (const line of lines) {
              receivedCommands.push(line);
              const parts = line.split(" ");
              const tag = parts[0];
              const cmd = parts[1]?.toUpperCase();

              if (cmd === "LOGIN") {
                socket.write(`${tag} OK LOGIN completed\r\n`);
              } else if (cmd === "SELECT") {
                socket.write("* 1 EXISTS\r\n* 1 RECENT\r\n* OK [UIDVALIDITY 1] UIDs valid\r\n");
                socket.write(`${tag} OK [READ-WRITE] SELECT completed\r\n`);
              } else if (cmd === "UID") {
                const subCmd = parts[2]?.toUpperCase();
                if (subCmd === "SEARCH") {
                  socket.write("* SEARCH 101 105 110\r\n");
                  socket.write(`${tag} OK UID SEARCH completed\r\n`);
                } else if (subCmd === "FETCH") {
                  const uid = parts[3];
                  const emailContent = `From: "Docusign Account" <docusign@docusign.net>\r\nSubject: Verificar um novo dispositivo\r\n\r\nSeu código de verificação da Docusign é: 582914\r\n`;
                  socket.write(`* 3 FETCH (UID ${uid} BODY[] {${emailContent.length}}\r\n${emailContent})\r\n`);
                  socket.write(`${tag} OK UID FETCH completed\r\n`);
                } else if (subCmd === "STORE") {
                  socket.write(`* 3 FETCH (FLAGS (\\Seen))\r\n`);
                  socket.write(`${tag} OK UID STORE completed\r\n`);
                }
              } else if (cmd === "LOGOUT") {
                socket.write("* BYE Logging out\r\n");
                socket.write(`${tag} OK LOGOUT completed\r\n`);
                socket.end();
              } else {
                socket.write(`${tag} OK ${cmd} done\r\n`);
              }
            }
          });
        });

        server.listen(0, "127.0.0.1", () => {
          serverPort = server.address().port;
          resolve();
        });
      });
    });

    after(async () => {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it("deve conectar ao servidor mock, enviar comando SINCE e extrair código de 6 dígitos", async () => {
      const client = new ImapClient({
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
        timeout: 5000,
      });

      await client.connect();
      const code = await client.fetchLatestMfaCode("test@unitynordeste.com.br", "secret123");
      await client.logout().catch(() => {});
      client.close();

      assert.equal(code, "582914");
      const searchWithSince = receivedCommands.some((c) => c.includes("UID SEARCH") && c.includes("SINCE"));
      assert.ok(searchWithSince, "Deveria ter enviado UID SEARCH contendo filtro SINCE");
    });

    it("fetchMfaCodeViaImap deve polling e retornar código com sucesso com backoff adaptativo e reuso de conexão", async () => {
      const code = await fetchMfaCodeViaImap(
        {
          email: "test@unitynordeste.com.br",
          password: "secret123",
          host: "127.0.0.1",
          port: serverPort,
          tls: false,
        },
        { maxWaitMs: 3000, pollIntervalMs: 500, backoffFactor: 1.2 }
      );

      assert.equal(code, "582914");
    });

    it("deve iterar UIDs descending e ignorar último sem código até achar MFA anterior", async () => {
      // Servidor já retorna SEARCH 101 105 110; mock responde FETCH com código só no 105
      // Sobrescreve handler FETCH para simular último UID sem código
      const client = new ImapClient({
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
        timeout: 5000,
      });
      // Intercepta sendCommand para UID 110 retornar corpo sem código
      await client.connect();
      const origSend = client.sendCommand.bind(client);
      client.sendCommand = async (cmd) => {
        if (cmd.includes("UID FETCH 110")) {
          const tag = `A${String(client.tagIndex + 1).padStart(4, "0")}`;
          // Simula resposta sem código de 6 dígitos
          return { tag, response: "OK", raw: `* 3 FETCH (UID 110 BODY[] {20}\r\nNo code here\r\n)\r\n${tag} OK UID FETCH completed\r\n` };
        }
        return origSend(cmd);
      };
      const code = await client.fetchLatestMfaCode("test@unitynordeste.com.br", "secret123");
      await client.logout().catch(() => {});
      client.close();
      // Deve ter pulado 110 e achado 105 (582914)
      assert.equal(code, "582914");
    });

    it("fetchMfaCodeViaImap deve usar defaults 3000/1.2/6000/90000 quando options omitidos", async () => {
      const start = Date.now();
      const code = await fetchMfaCodeViaImap({
        email: "test@unitynordeste.com.br",
        password: "secret123",
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
      });
      const elapsed = Date.now() - start;
      assert.equal(code, "582914");
      // Sucesso imediato (< 3s) prova que não ficou preso em defaults errados
      assert.ok(elapsed < 5000, `Deveria retornar rápido com defaults, levou ${elapsed}ms`);
    });

    it("deve ignorar e-mails com assunto diferente de 'Verificar um novo dispositivo'", async () => {
      const client = new ImapClient({
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
        timeout: 5000,
      });
      await client.connect();
      const origSend = client.sendCommand.bind(client);
      client.sendCommand = async (cmd) => {
        if (cmd.includes("UID FETCH")) {
          const tag = `A${String(client.tagIndex + 1).padStart(4, "0")}`;
          // Assunto diferente com código de verificação
          const email = `Subject: Novo Contrato Assinado\r\n\r\nSeu código de verificação da Docusign é: 999999\r\n`;
          return { tag, response: "OK", raw: `* 1 FETCH (UID 101 BODY[] {${email.length}}\r\n${email})\r\n${tag} OK UID FETCH completed\r\n` };
        }
        return origSend(cmd);
      };

      const code = await client.fetchLatestMfaCode("test@unitynordeste.com.br", "secret123");
      await client.logout().catch(() => {});
      client.close();

      assert.equal(code, null, "Deveria retornar null pois o assunto não é 'Verificar um novo dispositivo'");
    });

    it("deve ignorar e-mails recebidos antes de mfaTriggerTime com mais de 10 minutos de idade (expirados)", async () => {
      const client = new ImapClient({
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
        timeout: 5000,
      });
      await client.connect();
      const origSend = client.sendCommand.bind(client);
      client.sendCommand = async (cmd) => {
        if (cmd.includes("UID FETCH")) {
          const tag = `A${String(client.tagIndex + 1).padStart(4, "0")}`;
          // E-mail recebido 11 minutos antes do disparo (fora da janela de 10 minutos)
          const pastDate = new Date(Date.now() - 11 * 60 * 1000).toUTCString();
          const email = `Subject: Verificar um novo dispositivo\r\nDate: ${pastDate}\r\n\r\nSeu código de verificação da Docusign é: 888888\r\n`;
          return { tag, response: "OK", raw: `* 1 FETCH (UID 101 BODY[] {${email.length}}\r\n${email})\r\n${tag} OK UID FETCH completed\r\n` };
        }
        return origSend(cmd);
      };

      const now = Date.now();
      const code = await client.fetchLatestMfaCode("test@unitynordeste.com.br", "secret123", {
        mfaTriggerTime: now,
      });
      await client.logout().catch(() => {});
      client.close();

      assert.equal(code, null, "Deveria ignorar e-mail com 11 minutos de idade (expirado)");
    });

    it("deve aceitar e-mails recebidos antes do mfaTriggerTime dentro da janela de 10 minutos (recuperação de reinício do robô)", async () => {
      const client = new ImapClient({
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
        timeout: 5000,
      });
      await client.connect();
      const origSend = client.sendCommand.bind(client);
      client.sendCommand = async (cmd) => {
        if (cmd.includes("UID FETCH")) {
          const tag = `A${String(client.tagIndex + 1).padStart(4, "0")}`;
          // E-mail recebido 3 minutos antes do disparo do robô reiniciado
          const toleranceDate = new Date(Date.now() - 3 * 60 * 1000).toUTCString();
          const email = `Subject: Verificar um novo dispositivo\r\nDate: ${toleranceDate}\r\n\r\nSeu código de verificação da Docusign é: 777777\r\n`;
          return { tag, response: "OK", raw: `* 1 FETCH (UID 101 BODY[] {${email.length}}\r\n${email})\r\n${tag} OK UID FETCH completed\r\n` };
        }
        return origSend(cmd);
      };

      const now = Date.now();
      const code = await client.fetchLatestMfaCode("test@unitynordeste.com.br", "secret123", {
        mfaTriggerTime: now,
      });
      await client.logout().catch(() => {});
      client.close();

      assert.equal(code, "777777", "Deveria aceitar código de mensagem recebida 3 minutos antes (dentro da janela de 10 minutos)");
    });

    it("deve ignorar código presente em excludedCodes e selecionar mensagem mais recente válida", async () => {
      const client = new ImapClient({
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
        timeout: 5000,
      });
      await client.connect();
      const origSend = client.sendCommand.bind(client);
      client.sendCommand = async (cmd) => {
        if (cmd.includes("UID SEARCH")) {
          const tag = `A${String(client.tagIndex + 1).padStart(4, "0")}`;
          return { tag, response: "OK", raw: `* SEARCH 101 102\r\n${tag} OK UID SEARCH completed\r\n` };
        }
        if (cmd.includes("UID FETCH 102")) {
          const tag = `A${String(client.tagIndex + 1).padStart(4, "0")}`;
          const date = new Date(Date.now() - 1000).toUTCString();
          const email = `Subject: Verificar um novo dispositivo\r\nDate: ${date}\r\n\r\nSeu código de verificação da Docusign é: 111111\r\n`;
          return { tag, response: "OK", raw: `* 2 FETCH (UID 102 BODY[] {${email.length}}\r\n${email})\r\n${tag} OK UID FETCH completed\r\n` };
        }
        if (cmd.includes("UID FETCH 101")) {
          const tag = `A${String(client.tagIndex + 1).padStart(4, "0")}`;
          const date = new Date(Date.now() - 2000).toUTCString();
          const email = `Subject: Verificar um novo dispositivo\r\nDate: ${date}\r\n\r\nSeu código de verificação da Docusign é: 222222\r\n`;
          return { tag, response: "OK", raw: `* 1 FETCH (UID 101 BODY[] {${email.length}}\r\n${email})\r\n${tag} OK UID FETCH completed\r\n` };
        }
        return origSend(cmd);
      };

      const now = Date.now();
      const code = await client.fetchLatestMfaCode("test@unitynordeste.com.br", "secret123", {
        mfaTriggerTime: now,
        excludedCodes: ["111111"],
      });
      await client.logout().catch(() => {});
      client.close();

      assert.equal(code, "222222", "Deveria pular o código rejeitado 111111 e retornar 222222");
    });

    it("deve ignorar e-mail sem data quando mfaTriggerTime estiver definido (prevenção de falso positivo)", async () => {
      const client = new ImapClient({
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
        timeout: 5000,
      });
      await client.connect();
      const origSend = client.sendCommand.bind(client);
      client.sendCommand = async (cmd) => {
        if (cmd.includes("UID FETCH")) {
          const tag = `A${String(client.tagIndex + 1).padStart(4, "0")}`;
          // E-mail sem INTERNALDATE e sem cabeçalho Date
          const email = `Subject: Verificar um novo dispositivo\r\n\r\nSeu código de verificação da Docusign é: 666666\r\n`;
          return { tag, response: "OK", raw: `* 1 FETCH (UID 101 BODY[] {${email.length}}\r\n${email})\r\n${tag} OK UID FETCH completed\r\n` };
        }
        return origSend(cmd);
      };

      const now = Date.now();
      const code = await client.fetchLatestMfaCode("test@unitynordeste.com.br", "secret123", {
        mfaTriggerTime: now,
      });
      await client.logout().catch(() => {});
      client.close();

      assert.equal(code, null, "Deveria ignorar mensagem sem metadados de data quando mfaTriggerTime estiver ativo");
    });

    it("deve aceitar e-mail quando INTERNALDATE estiver ausente mas Date header for posterior ao mfaTriggerTime", async () => {
      const client = new ImapClient({
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
        timeout: 5000,
      });
      await client.connect();
      const origSend = client.sendCommand.bind(client);
      client.sendCommand = async (cmd) => {
        if (cmd.includes("UID FETCH")) {
          const tag = `A${String(client.tagIndex + 1).padStart(4, "0")}`;
          // Sem INTERNALDATE, apenas Date: header com data atual
          const validDate = new Date(Date.now() + 1000).toUTCString();
          const email = `Subject: Verificar um novo dispositivo\r\nDate: ${validDate}\r\n\r\nSeu código de verificação da Docusign é: 555555\r\n`;
          return { tag, response: "OK", raw: `* 1 FETCH (UID 101 BODY[] {${email.length}}\r\n${email})\r\n${tag} OK UID FETCH completed\r\n` };
        }
        return origSend(cmd);
      };

      const now = Date.now();
      const code = await client.fetchLatestMfaCode("test@unitynordeste.com.br", "secret123", {
        mfaTriggerTime: now,
      });
      await client.logout().catch(() => {});
      client.close();

      assert.equal(code, "555555", "Deveria extrair código usando o cabeçalho Date quando INTERNALDATE estiver ausente");
    });

    it("deve aceitar qualquer assunto quando subjectFilter for passado como string vazia (desabilitado)", async () => {
      const client = new ImapClient({
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
        timeout: 5000,
      });
      await client.connect();
      const origSend = client.sendCommand.bind(client);
      client.sendCommand = async (cmd) => {
        if (cmd.includes("UID FETCH")) {
          const tag = `A${String(client.tagIndex + 1).padStart(4, "0")}`;
          const email = `Subject: Outro Assunto Qualquer\r\n\r\nSeu código de verificação da Docusign é: 444444\r\n`;
          return { tag, response: "OK", raw: `* 1 FETCH (UID 101 BODY[] {${email.length}}\r\n${email})\r\n${tag} OK UID FETCH completed\r\n` };
        }
        return origSend(cmd);
      };

      const code = await client.fetchLatestMfaCode("test@unitynordeste.com.br", "secret123", {
        subjectFilter: "",
      });
      await client.logout().catch(() => {});
      client.close();

      assert.equal(code, "444444", "Deveria aceitar mensagem com qualquer assunto quando subjectFilter for string vazia");
    });
  });
});
