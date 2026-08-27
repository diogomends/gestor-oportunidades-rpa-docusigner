import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import {
  decodeQuotedPrintable,
  decodeBase64,
  extractMfaCodeFromText,
  ImapClient,
  fetchMfaCodeViaImap,
} from "./imapClient.js";

describe("Robot Standalone - IMAP MFA Client Tests", () => {
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
  });

  describe("decodeBase64", () => {
    it("deve decodificar Base64 padrão em UTF-8", () => {
      const plain = "Seu código de verificação da Docusign é: 456789";
      const b64 = Buffer.from(plain, "utf8").toString("base64");
      assert.equal(decodeBase64(b64), plain);
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

    it("deve retornar null se não encontrar código de 6 dígitos", () => {
      const emailBody = "Bem-vindo à DocuSign. Seu documento foi assinado com sucesso.";
      assert.equal(extractMfaCodeFromText(emailBody), null);
    });
  });

  describe("ImapClient Mock Server", () => {
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

    it("deve conectar ao servidor mock e extrair código de 6 dígitos", async () => {
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
  });
});
