import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveSessionState, ensureAuthenticated, sendEnvelope, checkEnvelopeStatus } from "../../../robot/src/browser/docusign.js";

describe("Robot Standalone - DocuSign Browser & Session Hardening Tests", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "docusign-test-"));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  describe("saveSessionState", () => {
    it("deve criar diretórios pais recursivamente e salvar storageState", async () => {
      const nestedPath = path.join(tempDir, "sub", "folder", "session.json");
      let savedPath = "";

      const mockPage = {
        context: () => ({
          storageState: async (opts) => {
            savedPath = opts.path;
            fs.writeFileSync(opts.path, JSON.stringify({ cookies: [] }));
          },
        }),
      };

      await saveSessionState(mockPage, nestedPath);

      assert.equal(savedPath, nestedPath);
      assert.ok(fs.existsSync(nestedPath), "Arquivo de sessão deve ter sido criado");
    });

    it("não deve falhar se page.context for inválido ou não possuir storageState", async () => {
      await assert.doesNotReject(async () => {
        await saveSessionState(null, path.join(tempDir, "none.json"));
        await saveSessionState({}, path.join(tempDir, "none.json"));
        await saveSessionState({ context: () => null }, path.join(tempDir, "none.json"));
      });
    });
  });

  describe("ensureAuthenticated", () => {
    it("deve remover arquivo de sessão expirado ao encontrar página de login", async () => {
      const sessionFile = path.join(tempDir, "session-expired.json");
      fs.writeFileSync(sessionFile, JSON.stringify({ expired: true }));

      let storageStateSaved = false;
      const mockPage = {
        url: () => "https://account.docusign.com/oauth/login",
        goto: async () => {},
        fill: async () => {},
        keyboard: { press: async () => {} },
        waitForSelector: async () => {},
        waitForNavigation: async () => {},
        locator: () => ({
          first: () => ({
            isVisible: async () => false,
          }),
        }),
        $: async () => null,
        context: () => ({
          storageState: async (opts) => {
            storageStateSaved = true;
            fs.writeFileSync(opts.path, JSON.stringify({ cookies: ["new"] }));
          },
        }),
      };

      const creds = { email: "user@test.com", password: "pwd" };
      await ensureAuthenticated(mockPage, creds, { sessionPath: sessionFile });

      assert.ok(storageStateSaved, "Deveria ter salvo novo storageState após login");
    });

    it("deve reutilizar e salvar sessão ativa detectada", async () => {
      const sessionFile = path.join(tempDir, "session-active.json");
      let storageStateSaved = false;

      const mockPage = {
        url: () => "https://app.docusign.com/home",
        goto: async () => {},
        context: () => ({
          storageState: async (opts) => {
            storageStateSaved = true;
            fs.writeFileSync(opts.path, JSON.stringify({ cookies: ["active"] }));
          },
        }),
      };

      const creds = { email: "user@test.com", password: "pwd" };
      await ensureAuthenticated(mockPage, creds, { sessionPath: sessionFile });

      assert.ok(storageStateSaved, "Deveria ter persistido storageState na detecção de sessão ativa");
      assert.ok(fs.existsSync(sessionFile));
    });
  });

  describe("sendEnvelope & checkEnvelopeStatus - Double Redirect Protection", () => {
    it("sendEnvelope deve lançar erro se continuar em página de login após segunda tentativa", async () => {
      const pdfFile = path.join(tempDir, "test.pdf");
      fs.writeFileSync(pdfFile, "%PDF-1.4 mock");

      let currentNavTarget = "";
      const mockPage = {
        url: () => {
          if (currentNavTarget && !currentNavTarget.endsWith("docusign.com")) {
            return "https://account.docusign.com/oauth/login";
          }
          return "https://app.docusign.com/home";
        },
        goto: async (targetUrl) => {
          currentNavTarget = targetUrl;
        },
        fill: async () => {},
        keyboard: { press: async () => {} },
        waitForSelector: async () => {},
        waitForNavigation: async () => {},
        setInputFiles: async () => {},
        click: async () => {},
        locator: () => ({
          first: () => ({
            isVisible: async () => false,
          }),
        }),
        $: async () => null,
        context: () => ({
          storageState: async () => {},
        }),
      };

      const envelopeData = {
        recipientName: "Test User",
        recipientEmail: "test@example.com",
        pdfPath: pdfFile,
        credentials: { email: "robot@test.com", password: "pwd" },
        sessionPath: path.join(tempDir, "session.json"),
      };

      await assert.rejects(
        async () => {
          await sendEnvelope(mockPage, envelopeData);
        },
        /Falha de autenticação persistente na navegação de envio/
      );
    });

    it("checkEnvelopeStatus deve lançar erro se continuar em página de login após segunda tentativa", async () => {
      let currentNavTarget = "";
      const mockPage = {
        url: () => {
          if (currentNavTarget && !currentNavTarget.endsWith("docusign.com")) {
            return "https://account.docusign.com/oauth/login";
          }
          return "https://app.docusign.com/home";
        },
        goto: async (targetUrl) => {
          currentNavTarget = targetUrl;
        },
        fill: async () => {},
        keyboard: { press: async () => {} },
        waitForSelector: async () => {},
        waitForNavigation: async () => {},
        locator: () => ({
          first: () => ({
            isVisible: async () => false,
          }),
        }),
        $: async () => ({ innerText: async () => "Completed" }),
        context: () => ({
          storageState: async () => {},
        }),
      };

      const creds = { email: "robot@test.com", password: "pwd" };
      await assert.rejects(
        async () => {
          await checkEnvelopeStatus(mockPage, "env-123", creds, {
            sessionPath: path.join(tempDir, "session.json"),
          });
        },
        /Falha de autenticação persistente na consulta de status/
      );
    });
  });
});
