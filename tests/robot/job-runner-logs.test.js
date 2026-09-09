import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { JobRunner } from "../../robot/src/job-runner.js";
import logger, { clearJobLogs } from "../../robot/src/utils/logger.js";

/**
 * @file Teste de regressão para transmissão de logs de execução no JobRunner.
 * Valida o cumprimento do requisito LOG-02 (Task T2).
 */

describe("JobRunner - Transmissão de Logs (T2 Regression)", () => {
  beforeEach(() => {
    clearJobLogs();
  });

  it("deve incluir array de logs drenados em cada chamada de updateJobStatus durante a execução", async () => {
    const statusCalls = [];

    const mockApiClient = {
      downloadPdfToTemp: async () => "/tmp/fake_contract.pdf",
      updateJobStatus: async (jobId, payload) => {
        statusCalls.push({ jobId, payload });
        return { success: true };
      },
    };

    const mockPage = {
      goto: async () => {},
      waitForSelector: async () => {},
      click: async () => {},
      fill: async () => {},
    };

    const mockContext = {
      newPage: async () => mockPage,
      close: async () => {},
    };

    const mockBrowser = {
      newContext: async () => mockContext,
      close: async () => {},
    };

    const mockChromium = {
      launch: async () => mockBrowser,
    };

    const runner = new JobRunner(mockApiClient, {
      role: "update",
      headless: true,
      chromiumFactory: () => mockChromium,
    });

    const job = {
      jobId: "job_test_logs_123",
      contractId: "contract_test_123",
      action: "send",
      pdfUrl: "/api/robot-docusign/instance/contracts/contract_test_123/pdf",
      recipientName: "Cliente Teste",
      recipientEmail: "cliente@teste.com",
      credentials: { email: "robo@teste.com", password: "123" },
      envelopeId: "12345678-1234-4234-8234-1234567890ab",
    };

    // Mock sendEnvelope to avoid full Playwright automation
    // We simulate logger calls inside processJob
    try {
      await runner.processJob(job);
    } catch (_) {
      // sendEnvelope might fail without full mock, but we inspect the status calls made
    }

    assert.ok(statusCalls.length > 0, "Deve ter realizado chamadas de updateJobStatus");
    for (const call of statusCalls) {
      assert.ok(Array.isArray(call.payload.logs), "Payload de status deve conter o array 'logs'");
    }

    // A primeira chamada de status deve conter logs das etapas iniciais
    const firstCallLogs = statusCalls[0].payload.logs;
    assert.ok(firstCallLogs.length > 0, "Primeira chamada deve conter logs capturados");
    assert.ok(
      firstCallLogs.some((line) => line.includes("Iniciando execução do job") || line.includes("Baixando PDF")),
      "Logs devem refletir as mensagens do logger"
    );
  });

  it("deve drenar logs restantes no payload de erro quando uma falha ocorrer", async () => {
    const statusCalls = [];

    const mockApiClient = {
      downloadPdfToTemp: async () => {
        throw new Error("Erro simulado de download de PDF");
      },
      updateJobStatus: async (jobId, payload) => {
        statusCalls.push({ jobId, payload });
        return { success: true };
      },
    };

    const runner = new JobRunner(mockApiClient, {
      role: "update",
      headless: true,
    });

    const job = {
      jobId: "job_fail_123",
      contractId: "contract_fail_123",
      action: "send",
      pdfUrl: "/api/contracts/fail.pdf",
      recipientEmail: "cliente@teste.com",
      credentials: { email: "robo@teste.com", password: "123" },
    };

    await assert.rejects(
      async () => {
        await runner.processJob(job);
      },
      /Erro simulado de download de PDF/
    );

    const failedCall = statusCalls.find((c) => c.payload.status === "failed");
    assert.ok(failedCall, "Deve registrar status failed na API");
    assert.ok(Array.isArray(failedCall.payload.logs), "Chamada de falha deve conter array de logs");
    assert.ok(
      failedCall.payload.logs.some((line) => line.includes("Falha no processamento do job") || line.includes("Erro simulado")),
      "Logs de falha devem conter a mensagem de erro formatada pelo logger"
    );
  });
});
