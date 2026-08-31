import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  saveSessionState,
  ensureAuthenticated,
  sendEnvelope,
  checkEnvelopeStatus,
  normalizeEnvelopeStatus,
  extractEnvelopesFromCurrentPage,
  fetchAgreementsByRepresentative,
} from "../../../robot/src/browser/docusign.js";

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
        /Falha de autenticação persistente na navegação de consulta de status/
      );
    });
  });

  describe("normalizeEnvelopeStatus", () => {
    it("deve normalizar corretamente todos os status conhecidos", () => {
      assert.deepEqual(normalizeEnvelopeStatus("Concluído"), {
        status: "completed",
        rawStatus: "Concluído",
        unknown_status: false,
      });

      assert.deepEqual(normalizeEnvelopeStatus("concluido"), {
        status: "completed",
        rawStatus: "concluido",
        unknown_status: false,
      });

      assert.deepEqual(normalizeEnvelopeStatus("completed"), {
        status: "completed",
        rawStatus: "completed",
        unknown_status: false,
      });

      assert.deepEqual(normalizeEnvelopeStatus("Aguardando outros"), {
        status: "waiting_others",
        rawStatus: "Aguardando outros",
        unknown_status: false,
      });

      assert.deepEqual(normalizeEnvelopeStatus("Aguardando"), {
        status: "waiting_others",
        rawStatus: "Aguardando",
        unknown_status: false,
      });

      assert.deepEqual(normalizeEnvelopeStatus("Anulado"), {
        status: "voided",
        rawStatus: "Anulado",
        unknown_status: false,
      });

      assert.deepEqual(normalizeEnvelopeStatus("Falha na entrega"), {
        status: "delivery_failed",
        rawStatus: "Falha na entrega",
        unknown_status: false,
      });
    });

    it("deve alertar e preservar texto original para status não catalogados", () => {
      const unknown = normalizeEnvelopeStatus("Em Revisão Jurídica Especial");
      assert.equal(unknown.status, "unknown");
      assert.equal(unknown.rawStatus, "Em Revisão Jurídica Especial");
      assert.equal(unknown.unknown_status, true);
    });

    it("deve tratar entradas vazias ou nulas com unknown_status: true", () => {
      const empty = normalizeEnvelopeStatus("");
      assert.equal(empty.status, "unknown");
      assert.equal(empty.unknown_status, true);

      const nullInput = normalizeEnvelopeStatus(null);
      assert.equal(nullInput.status, "unknown");
      assert.equal(nullInput.unknown_status, true);
    });
  });

  describe("extractEnvelopesFromCurrentPage", () => {
    it("deve filtrar linhas pelo representante e extrair status", async () => {
      const mockRows = [
        {
          $: async (sel) => {
            if (sel.includes("mobile-from")) {
              return { innerText: async () => "João Carlos da Silva" };
            }
            if (sel.includes("status")) {
              return { innerText: async () => "Concluído" };
            }
            if (sel.includes("subject") || sel === "a") {
              return {
                innerText: async () => "Contrato de Prestação #101",
                getAttribute: async (attr) => (attr === "href" ? "/documents/details/env-101" : null),
              };
            }
            return null;
          },
        },
        {
          $: async (sel) => {
            if (sel.includes("mobile-from")) {
              return { innerText: async () => "Maria Oliveira" };
            }
            if (sel.includes("status")) {
              return { innerText: async () => "Aguardando outros" };
            }
            if (sel.includes("subject") || sel === "a") {
              return {
                innerText: async () => "Contrato #102",
                getAttribute: async (attr) => (attr === "href" ? "/documents/details/env-102" : null),
              };
            }
            return null;
          },
        },
        {
          $: async (sel) => {
            if (sel.includes("mobile-from")) {
              return { innerText: async () => "João Carlos da Silva" };
            }
            if (sel.includes("status")) {
              return { innerText: async () => "Status Customizado Inédito" };
            }
            if (sel.includes("subject") || sel === "a") {
              return {
                innerText: async () => "Aditivo #103",
                getAttribute: async (attr) => (attr === "href" ? "/documents/details/env-103" : null),
              };
            }
            return null;
          },
        },
      ];

      const mockPage = {
        $$: async () => mockRows,
      };

      const result = await extractEnvelopesFromCurrentPage(mockPage, "joao carlos");

      assert.equal(result.envelopes.length, 2, "Deveria encontrar 2 envelopes para João Carlos");
      assert.equal(result.envelopes[0].status, "completed");
      assert.equal(result.envelopes[0].envelopeId, "env-101");
      assert.equal(result.envelopes[1].status, "unknown");
      assert.equal(result.envelopes[1].rawStatus, "Status Customizado Inédito");
      assert.equal(result.envelopes[1].unknown_status, true);

      assert.equal(result.unknownStatuses.length, 1);
      assert.equal(result.unknownStatuses[0].rawStatus, "Status Customizado Inédito");
    });
  });

  describe("fetchAgreementsByRepresentative", () => {
    it("deve navegar paginadamente e parar quando o botão estiver desabilitado", async () => {
      let pageClicks = 0;
      let currentPage = 1;

      const mockPage = {
        url: () => "https://apps.docusign.com/send/documents?view=agreements",
        goto: async () => {},
        waitForSelector: async () => {},
        $$: async () => [
          {
            $: async (sel) => {
              if (sel.includes("mobile-from")) {
                return { innerText: async () => `Representante Alfa (Page ${currentPage})` };
              }
              if (sel.includes("status")) {
                return { innerText: async () => "Concluído" };
              }
              if (sel.includes("subject") || sel === "a") {
                return {
                  innerText: async () => `Acordo Page ${currentPage}`,
                  getAttribute: async () => `/documents/details/env-page-${currentPage}`,
                };
              }
              return null;
            },
          },
        ],
        $: async (sel) => {
          if (sel.includes("pagination-next")) {
            return {
              evaluate: async (fn) => {
                // Página 1 está habilitada, Página 2 está desabilitada
                const isDisabled = currentPage >= 2;
                return isDisabled;
              },
              click: async () => {
                pageClicks++;
                currentPage++;
              },
            };
          }
          return null;
        },
      };

      const result = await fetchAgreementsByRepresentative(mockPage, {
        repName: "Alfa",
        daysBack: 5,
      });

      assert.equal(result.success, true);
      assert.equal(result.totalFound, 2, "Deveria acumular 2 envelopes das 2 páginas");
      assert.equal(pageClicks, 1, "Deveria ter clicado 1 vez para ir para a página 2");
      assert.equal(result.envelopes[0].envelopeId, "env-page-1");
      assert.equal(result.envelopes[1].envelopeId, "env-page-2");
    });
  });
});
