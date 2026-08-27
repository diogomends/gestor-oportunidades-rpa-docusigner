import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import {
  decodeQuotedPrintable,
  decodeBase64,
  extractMfaCodeFromText,
  ImapClient,
  fetchMfaCodeViaImap,
} from "../../../../../robot/src/browser/imapClient.js";

describe("IMAP MFA Client Unit & Regression Tests", () => {
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

    it("deve retornar null se não encontrar código de 6 dígitos", () => {
      const emailBody = "Bem-vindo à DocuSign. Seu documento foi assinado com sucesso.";
      assert.equal(extractMfaCodeFromText(emailBody), null);
      assert.equal(extractMfaCodeFromText(""), null);
      assert.equal(extractMfaCodeFromText(null), null);
    });
  });

  describe("ImapClient Socket Dialogue (Mock Server)", () => {
    let server = null;
    let serverPort = 0;

    before(async () => {
      await new Promise((resolve) => {
        server = net.createServer((socket) => {
          socket.setEncoding("utf8");
          socket.write("* OK [CAPABILITY IMAP4rev1] Mock IMAP Server Ready\r\n");

          socket.on("data", (data) => {
            const lines = data.split("\r\n").filter(Boolean);
            for (const line of lines) {
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

    it("deve conectar ao servidor mock, autenticar e extrair código de 6 dígitos com sucesso", async () => {
      const client = new ImapClient({
        host: "127.0.0.1",
        port: serverPort,
        tls: false,
        timeout: 5000,
      });

      await client.connect();
      const code = await client.fetchLatestMfaCode("test@unitynordeste.com.br", "secret123");
      client.close();

      assert.equal(code, "582914");
    });

    it("fetchMfaCodeViaImap deve polling e retornar código com sucesso", async () => {
      const code = await fetchMfaCodeViaImap(
        {
          email: "test@unitynordeste.com.br",
          password: "secret123",
          host: "127.0.0.1",
          port: serverPort,
          tls: false,
        },
        { maxWaitMs: 3000, pollIntervalMs: 500 }
      );

      assert.equal(code, "582914");
    });
  });
});
