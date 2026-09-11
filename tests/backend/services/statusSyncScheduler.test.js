import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";

import statusSyncScheduler, {
  syncAllContractsStatus,
  mapEnvelopeStatusToContractStatus,
  isStatusSyncRunning,
  start,
  stop,
} from "../../../backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js";
import {
  validateExecutionPrerequisites,
  handleDualRobotDelegation,
} from "../../../backend/src/modules/robot-docusign/seletorApiRobot/statusSyncValidator.js";
import RobotJob from "../../../backend/src/modules/robot-docusign/models/RobotJob.js";
import RobotInstance from "../../../backend/src/modules/robot-docusign/models/RobotInstance.js";
import SystemConfig from "../../../backend/src/models/SystemConfig.js";

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

  it("deve delegar para robô de consulta externo quando houver robô online e nenhum job pendente", async () => {
    const mongoose = (await import("mongoose")).default;
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });

    try {
      mock.method(RobotInstance, "exists", async () => true);
      mock.method(RobotJob, "updateMany", async () => ({ modifiedCount: 0 }));
      mock.method(RobotJob, "exists", async () => false);
      let jobCreated = false;
      mock.method(RobotJob, "create", async (payload) => {
        assert.strictEqual(payload.action, "query_agreements");
        jobCreated = true;
        return { _id: "job_query_1", ...payload };
      });

      const delegation = await handleDualRobotDelegation();

      assert.strictEqual(delegation.handled, true);
      assert.strictEqual(delegation.reason, "enqueued_query_robot");
      assert.strictEqual(jobCreated, true);
    } finally {
      Object.defineProperty(mongoose.connection, "readyState", { value: originalReadyState, configurable: true });
    }
  });

  it("deve aguardar robô externo quando já houver job query_agreements pendente", async () => {
    const mongoose = (await import("mongoose")).default;
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });

    try {
      mock.method(RobotInstance, "exists", async () => true);
      mock.method(RobotJob, "updateMany", async () => ({ modifiedCount: 0 }));
      mock.method(RobotJob, "exists", async () => true);

      const delegation = await handleDualRobotDelegation();

      assert.strictEqual(delegation.handled, true);
      assert.strictEqual(delegation.reason, "query_job_pending");
    } finally {
      Object.defineProperty(mongoose.connection, "readyState", { value: originalReadyState, configurable: true });
    }
  });

  it("deve retornar fleet_offline e ignorar sincronização quando não houver robô de consulta ativo", async () => {
    const mongoose = (await import("mongoose")).default;
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, "readyState", { value: 1, configurable: true });

    try {
      mock.method(RobotInstance, "exists", async () => false);
      mock.method(RobotJob, "updateMany", async () => ({ modifiedCount: 0 }));
      mock.method(RobotJob, "exists", async () => false);

      const delegation = await handleDualRobotDelegation();

      assert.strictEqual(delegation.handled, true);
      assert.strictEqual(delegation.reason, "fleet_offline");
    } finally {
      Object.defineProperty(mongoose.connection, "readyState", { value: originalReadyState, configurable: true });
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
});
