import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import * as robotSessionModule from "./robotSession.js";
import { send } from "./robotBrowser.js";

describe("robotBrowser Service", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("ensureAuthenticated and send regression tests", () => {
    it("ensureAuthenticated - sucesso: navega para targetUrl sem login quando URL ja esta autenticada", async () => {
      let currentUrl = "https://app.docusign.com/send";
      const mockPage = {
        goto: async (url) => {
          currentUrl = url;
        },
        url: () => currentUrl,
        fill: async () => {},
        click: async () => {},
      };

      const loginSpy = mock.method(robotSessionModule, "loginAndSaveSession", async () => {});

      const envelopeData = {
        recipientName: "John Doe",
        recipientEmail: "john@example.com",
      };

      const result = await send(mockPage, envelopeData);
      assert.strictEqual(loginSpy.mock.callCount(), 0);
      assert.ok(result);
    });

    it("ensureAuthenticated - login necessario + sucesso: redireciona apos login bem sucedido", async () => {
      let currentUrl = "https://account.docusign.com/oauth/auth";
      const mockPage = {
        goto: async (url) => {
          if (url === "https://app.docusign.com/send") {
            currentUrl = "https://app.docusign.com/send";
          }
        },
        url: () => currentUrl,
        fill: async () => {},
        click: async () => {},
        context: () => ({}),
      };

      let loginCalled = false;
      mock.method(robotSessionModule, "loginAndSaveSession", async () => {
        loginCalled = true;
      });

      const envelopeData = {
        recipientName: "John Doe",
        recipientEmail: "john@example.com",
        credentials: { email: "robot@docusign.com", password: "Password123" },
      };

      const result = await send(mockPage, envelopeData);
      assert.strictEqual(loginCalled, true);
      assert.strictEqual(currentUrl, "https://app.docusign.com/send");
      assert.ok(result);
    });

    it("Correcao B/D - login necessario + falha: URL permanece em /oauth/, invalidateSession eh chamado e erro eh lancado", async () => {
      const mockPage = {
        goto: async () => {},
        url: () => "https://account.docusign.com/oauth/auth",
        context: () => ({}),
      };

      mock.method(robotSessionModule, "loginAndSaveSession", async () => {});
      let invalidatedEmail = null;
      mock.method(robotSessionModule, "invalidateSession", async (email) => {
        invalidatedEmail = email;
        return true;
      });

      const envelopeData = {
        recipientName: "John Doe",
        recipientEmail: "john@example.com",
        credentials: { email: "robot@docusign.com", password: "Password123" },
      };

      await assert.rejects(
        async () => {
          await send(mockPage, envelopeData);
        },
        (err) => {
          assert.strictEqual(
            err.message.includes("Falha na autenticação do robô DocuSign: A navegação permaneceu na tela de login/OAuth"),
            true
          );
          return true;
        }
      );

      assert.strictEqual(invalidatedEmail, "robot@docusign.com");
    });

    it("Correcao C - send lanca erro quando URL permanece em login apos ensureAuthenticated", async () => {
      let callCount = 0;
      const mockPage = {
        goto: async () => {},
        url: () => {
          callCount++;
          if (callCount === 1) return "https://app.docusign.com/send";
          return "https://account.docusign.com/login";
        },
      };

      const envelopeData = {
        recipientName: "John Doe",
        recipientEmail: "john@example.com",
      };

      await assert.rejects(
        async () => {
          await send(mockPage, envelopeData);
        },
        (err) => {
          assert.strictEqual(
            err.message.includes("Não é possível preencher os dados do contrato: o navegador continua na tela de login da DocuSign"),
            true
          );
          return true;
        }
      );
    });

    it("ensureAuthenticated - sem credenciais configuradas: lanca erro explicito", async () => {
      const mockPage = {
        goto: async () => {},
        url: () => "https://account.docusign.com/oauth/auth",
      };

      const envelopeData = {
        recipientName: "John Doe",
        recipientEmail: "john@example.com",
        credentials: {},
      };

      await assert.rejects(
        async () => {
          await send(mockPage, envelopeData);
        },
        {
          name: "Error",
          message:
            "Redirecionado para autenticação na DocuSign, porém as credenciais do robô (e-mail e senha) não foram configuradas nas Configurações do Sistema.",
        }
      );
    });
  });
});
