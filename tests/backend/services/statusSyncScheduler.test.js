import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";

import statusSyncScheduler, {
  syncAllContractsStatus,
  mapEnvelopeStatusToContractStatus,
  isStatusSyncRunning,
  start,
  stop,
} from "../../../backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js";
import Contract from "../../../backend/src/models/Contract.js";
import SystemConfig from "../../../backend/src/models/SystemConfig.js";
import browserrobot from "../../../backend/src/modules/robot-docusign/browserrobot/index.js";
import { robotEvents } from "../../../backend/src/modules/robot-docusign/seletorApiRobot/orchestratorEvents.js";
import gestorApiClient from "../../../backend/src/services/gestorApiClient.js";

/**
 * Helper para configurar mocks de SystemConfig para os testes.
 *
 * @param {Object} [options={}] - Opções de configuração.
 * @param {Object} [options.robotConfig={}] - Sobrescrita para robot_docusign.
 * @param {Object} [options.accessRestriction=null] - Configuração para access_restriction.
 */
function mockSystemConfigs({ robotConfig = {}, accessRestriction = null } = {}) {
  mock.method(SystemConfig, "findOne", ({ key }) => ({
    lean: async () => {
      if (key === "robot_docusign") {
        return {
          key: "robot_docusign",
          value: {
            enabled: true,
            mode: "robot",
            operations: {
              send: true,
              statusCheck: true,
              download: true,
              reports: true,
              resend: true,
            },
            ...robotConfig,
          },
        };
      }
      if (key === "access_restriction") {
        return accessRestriction;
      }
      return null;
    },
  }));
}

describe("Robot DocuSign - Unit & Regression Tests: statusSyncScheduler", () => {
  const originalRobotApiKey = process.env.ROBOT_API_KEY;

  beforeEach(() => {
    mock.restoreAll();
    stop();
    process.env.ROBOT_API_KEY = "test_robot_api_key";
  });

  afterEach(() => {
    mock.restoreAll();
    stop();
    process.env.ROBOT_API_KEY = originalRobotApiKey;
  });

  it("deve iniciar com a trava isRunning como false", () => {
    assert.strictEqual(isStatusSyncRunning(), false);
  });

  it("deve pular execução se o modo do robô não for 'robot'", async () => {
    mockSystemConfigs({
      robotConfig: { mode: "api", enabled: false },
    });

    const result = await syncAllContractsStatus();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.checked, 0);
    assert.strictEqual(result.reason, "robot_disabled");
    assert.strictEqual(isStatusSyncRunning(), false);
  });

  it("deve pular execução se a operação statusCheck estiver desabilitada", async () => {
    mockSystemConfigs({
      robotConfig: { mode: "robot", operations: { statusCheck: false } },
    });

    const result = await syncAllContractsStatus();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.checked, 0);
    assert.strictEqual(result.reason, "status_check_disabled");
    assert.strictEqual(isStatusSyncRunning(), false);
  });

  it("deve pular execução se estiver fora do horário de expediente permitido", async () => {
    mockSystemConfigs({
      robotConfig: { mode: "robot", operations: { statusCheck: true } },
      accessRestriction: {
        key: "access_restriction",
        value: {
          enabled: true,
          startHour: "00:00",
          endHour: "00:01",
          applyOnWeekends: true,
        },
      },
    });

    const result = await syncAllContractsStatus();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.checked, 0);
    assert.strictEqual(result.reason, "outside_working_hours");
    assert.strictEqual(isStatusSyncRunning(), false);
  });

  it("deve retornar no_active_contracts quando não houver contratos ativos no banco", async () => {
    mockSystemConfigs({
      robotConfig: { mode: "robot", operations: { statusCheck: true } },
    });

    mock.method(Contract, "find", () => ({
      lean: async () => [],
    }));

    const result = await syncAllContractsStatus();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.checked, 0);
    assert.strictEqual(result.reason, "no_active_contracts");
    assert.strictEqual(isStatusSyncRunning(), false);
  });

  it("deve impedir chamadas concorrentes bloqueando com status 'busy' e reason 'already_running'", async () => {
    mockSystemConfigs({
      robotConfig: {
        mode: "robot",
        operations: { statusCheck: true },
        credentials: { email: "test@test.com", password: "pass" },
      },
    });

    const mockContracts = [
      {
        _id: "c1",
        status: "enviado",
        envelopeId: "env-123",
        client: { representante: { email: "rep@test.com", nome: "Rep Test" } },
      },
    ];

    mock.method(Contract, "find", () => ({
      lean: async () => mockContracts,
    }));

    // Simula uma execução longa do Playwright
    let resolveBrowserPromise;
    const browserPromise = new Promise((resolve) => {
      resolveBrowserPromise = resolve;
    });

    mock.method(browserrobot, "executeWithBrowser", async (action) => {
      if (action === "query_agreements") {
        await browserPromise;
        return { envelopes: [] };
      }
      return {};
    });

    // Inicia a primeira chamada (assíncrona)
    const firstCallPromise = syncAllContractsStatus();

    // Aguarda um tick para garantir que a primeira chamada iniciou e setou isRunning = true
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(isStatusSyncRunning(), true);

    // Tenta disparar uma segunda chamada simultânea
    const secondCallResult = await syncAllContractsStatus();

    assert.strictEqual(secondCallResult.success, true);
    assert.strictEqual(secondCallResult.status, "busy");
    assert.strictEqual(secondCallResult.reason, "already_running");
    assert.strictEqual(secondCallResult.checked, 0);

    // Conclui a primeira chamada
    resolveBrowserPromise();
    const firstCallResult = await firstCallPromise;

    assert.strictEqual(firstCallResult.success, true);
    assert.strictEqual(firstCallResult.checked, 1);
    assert.strictEqual(isStatusSyncRunning(), false);
  });

  it("deve liberar obrigatoriamente a trava isRunning no bloco finally mesmo quando executeWithBrowser lança erro", async () => {
    mockSystemConfigs({
      robotConfig: { mode: "robot", operations: { statusCheck: true } },
    });

    mock.method(Contract, "find", () => ({
      lean: async () => [{ _id: "c1", status: "enviado" }],
    }));

    mock.method(browserrobot, "executeWithBrowser", async () => {
      throw new Error("Erro de conexão Playwright");
    });

    const result = await syncAllContractsStatus();

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "Erro de conexão Playwright");
    assert.strictEqual(isStatusSyncRunning(), false);
  });

  it("deve sincronizar contratos atualizados, baixar PDFs assinados e emitir eventos SSE com sucesso", async () => {
    mockSystemConfigs({
      robotConfig: {
        mode: "robot",
        operations: { statusCheck: true, download: true },
        credentials: { email: "test@test.com", password: "pass" },
      },
    });

    const mockContracts = [
      {
        _id: "c_assinado",
        status: "enviado",
        envelopeId: "env_completed_1",
        client: {
          cnpj: "12345678000199",
          razaoSocial: "Empresa Teste",
          representante: { email: "rep@exemplo.com", nome: "Cliente Silva" },
        },
      },
    ];

    mock.method(Contract, "find", () => ({
      lean: async () => mockContracts,
    }));

    let contractUpdated = false;
    mock.method(Contract, "findByIdAndUpdate", async (id, updatePayload) => {
      assert.strictEqual(id, "c_assinado");
      assert.strictEqual(updatePayload.status, "assinado");
      contractUpdated = true;
      return { _id: id, ...updatePayload };
    });

    let syncCalled = false;
    mock.method(gestorApiClient, "updateContractStatus", async (id, payload) => {
      assert.strictEqual(id, "c_assinado");
      assert.strictEqual(payload.status, "assinado");
      assert.strictEqual(payload.envelopeId, "env_completed_1");
      syncCalled = true;
      return { success: true };
    });

    let downloadExecuted = false;
    mock.method(browserrobot, "executeWithBrowser", async (action, params) => {
      if (action === "query_agreements") {
        return {
          envelopes: [
            {
              envelopeId: "env_completed_1",
              status: "completed",
              recipient: "Cliente Silva",
            },
          ],
        };
      }
      if (action === "download") {
        assert.strictEqual(params.envelopeId, "env_completed_1");
        downloadExecuted = true;
        return { success: true };
      }
      return {};
    });

    let sseEmitted = false;
    const sseListener = (event) => {
      if (event.contractId === "c_assinado" && event.status === "assinado") {
        sseEmitted = true;
      }
    };
    robotEvents.on("job:progress", sseListener);

    try {
      const result = await syncAllContractsStatus({ daysBack: 15 });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.checked, 1);
      assert.strictEqual(result.updated, 1);
      assert.strictEqual(result.downloaded, 1);
      assert.strictEqual(contractUpdated, true);
      assert.strictEqual(syncCalled, true);
      assert.strictEqual(downloadExecuted, true);
      assert.strictEqual(sseEmitted, true);
      assert.strictEqual(isStatusSyncRunning(), false);
    } finally {
      robotEvents.removeListener("job:progress", sseListener);
    }
  });

  it("deve iniciar e parar os timers de polling através de start e stop", async () => {
    mockSystemConfigs({
      robotConfig: { schedule: { intervalMinutes: 10 } },
    });

    const timer = await start(60000);
    assert.ok(timer);

    // Chamar start novamente deve retornar o timer já existente
    const timer2 = await start(60000);
    assert.strictEqual(timer, timer2);

    stop();
    // Chamar stop novamente não deve gerar erro
    stop();
  });

  describe("Anti-Phantom Success: mapEnvelopeStatusToContractStatus", () => {
    it("deve mapear status conhecidos de conclusão para 'assinado'", () => {
      assert.strictEqual(mapEnvelopeStatusToContractStatus("completed"), "assinado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("assinado"), "assinado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("signed"), "assinado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("concluido"), "assinado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("Concluído"), "assinado");
    });

    it("deve mapear status conhecidos de cancelamento para 'cancelado'", () => {
      assert.strictEqual(mapEnvelopeStatusToContractStatus("declined"), "cancelado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("voided"), "cancelado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("expired"), "cancelado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("recusado"), "cancelado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("anulado"), "cancelado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("cancelado"), "cancelado");
    });

    it("deve mapear status conhecidos de envio/entrega para 'enviado'", () => {
      assert.strictEqual(mapEnvelopeStatusToContractStatus("sent"), "enviado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("delivered"), "enviado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("processing"), "enviado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("enviado"), "enviado");
      assert.strictEqual(mapEnvelopeStatusToContractStatus("entregue"), "enviado");
    });

    it("deve retornar null para status desconhecido, rascunho ou vazio (evitando coerção indevida para 'enviado')", () => {
      assert.strictEqual(mapEnvelopeStatusToContractStatus("draft"), null);
      assert.strictEqual(mapEnvelopeStatusToContractStatus("rascunho"), null);
      assert.strictEqual(mapEnvelopeStatusToContractStatus("unknown"), null);
      assert.strictEqual(mapEnvelopeStatusToContractStatus("desconhecido"), null);
      assert.strictEqual(mapEnvelopeStatusToContractStatus(""), null);
      assert.strictEqual(mapEnvelopeStatusToContractStatus(null), null);
      assert.strictEqual(mapEnvelopeStatusToContractStatus(undefined), null);
      assert.strictEqual(mapEnvelopeStatusToContractStatus("random_status_123"), null);
    });
  });

  describe("Anti-Phantom Success: syncAllContractsStatus com status desconhecido", () => {
    it("não deve alterar o status do contrato para 'enviado' quando a DocuSign retornar status desconhecido ou rascunho", async () => {
      mockSystemConfigs({
        robotConfig: {
          mode: "robot",
          operations: { statusCheck: true },
          credentials: { email: "test@test.com", password: "pass" },
        },
      });

      const mockContracts = [
        {
          _id: "c_gerado",
          status: "gerado",
          envelopeId: "env_draft_1",
          client: {
            cnpj: "12345678000199",
            razaoSocial: "Empresa Teste",
            representante: { email: "rep@exemplo.com", nome: "Cliente Draft" },
          },
        },
      ];

      mock.method(Contract, "find", () => ({
        lean: async () => mockContracts,
      }));

      let statusUpdated = false;
      mock.method(Contract, "findByIdAndUpdate", async (id, updatePayload) => {
        if (updatePayload.status) {
          statusUpdated = true;
        }
        return { _id: id, ...updatePayload };
      });

      let gestorApiCalled = false;
      mock.method(gestorApiClient, "updateContractStatus", async () => {
        gestorApiCalled = true;
        return { success: true };
      });

      mock.method(browserrobot, "executeWithBrowser", async (action) => {
        if (action === "query_agreements") {
          return {
            envelopes: [
              {
                envelopeId: "env_draft_1",
                status: "draft",
                recipient: "Cliente Draft",
              },
            ],
          };
        }
        return {};
      });

      const result = await syncAllContractsStatus({ daysBack: 15 });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.checked, 1);
      assert.strictEqual(result.updated, 0);
      assert.strictEqual(result.downloaded, 0);
      assert.strictEqual(statusUpdated, false, "Status no MongoDB não deve ser modificado para status desconhecido/draft");
      assert.strictEqual(gestorApiCalled, false, "gestorApiClient.updateContractStatus não deve ser invocado");
      assert.strictEqual(isStatusSyncRunning(), false);
    });
  });
});
