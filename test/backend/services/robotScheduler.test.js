import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import "../../helpers/setup.js";
import robotScheduler from "../../../backend/src/modules/robot-docusign/services/robotScheduler.js";
import robotOrchestrator from "../../../backend/src/modules/robot-docusign/services/robotOrchestrator.js";
import RobotJob from "../../../backend/src/modules/robot-docusign/models/RobotJob.js";
import Contract from "../../../backend/src/models/Contract.js";
import SystemConfig from "../../../backend/src/models/SystemConfig.js";

describe("Robot DocuSign - Unit Tests: robotScheduler", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("deve pulamento se o robô estiver desabilitado", async () => {
    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: false,
      mode: "robot",
    }));

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.disabled, true);
    assert.strictEqual(result.reason, "robot_disabled");
  });

  it("deve pulamento se o robô estiver em modo API", async () => {
    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: true,
      mode: "api",
    }));

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.reason, "robot_disabled");
  });

  it("deve pulamento se estiver fora do horário de expediente permitido", async () => {
    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: true,
      mode: "robot",
    }));

    mock.method(SystemConfig, "findOne", () => ({
      lean: async () => ({
        key: "access_restriction",
        value: {
          enabled: true,
          startHour: "00:00",
          endHour: "00:01",
          applyOnWeekends: true,
        },
      }),
    }));

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.status, "skipped");
    assert.strictEqual(result.reason, "outside_working_hours");
  });

  it("deve retornar busy se o limite de concorrência for atingido", async () => {
    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: true,
      mode: "robot",
      limits: { max_concurrent: 1 },
    }));

    mock.method(SystemConfig, "findOne", () => ({
      lean: async () => ({ value: { enabled: false } }),
    }));

    mock.method(RobotJob, "countDocuments", async () => 1);

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.status, "busy");
    assert.strictEqual(result.reason, "max_concurrent_reached");
  });

  it("deve retornar idle se não houver jobs pendentes na fila", async () => {
    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: true,
      mode: "robot",
      limits: { max_concurrent: 1 },
    }));

    mock.method(SystemConfig, "findOne", () => ({
      lean: async () => ({ value: { enabled: false } }),
    }));

    mock.method(RobotJob, "countDocuments", async () => 0);
    mock.method(RobotJob, "findOne", () => ({
      sort: () => ({
        lean: async () => null,
      }),
    }));

    mock.method(Contract, "findOne", () => ({
      sort: () => ({
        lean: async () => null,
      }),
    }));

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.status, "idle");
    assert.strictEqual(result.reason, "no_pending_jobs");
  });

  it("deve disparar o robô com sucesso para 1 job pendente", async () => {
    const mockPendingJob = {
      _id: "job_pending_1",
      contract_id: "contract_abc",
      action: "send",
      status: "pending",
    };

    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: true,
      mode: "robot",
      limits: { max_concurrent: 1 },
    }));

    mock.method(SystemConfig, "findOne", () => ({
      lean: async () => ({ value: { enabled: false } }),
    }));

    mock.method(RobotJob, "countDocuments", async () => 0);
    mock.method(RobotJob, "findOne", () => ({
      sort: () => ({
        lean: async () => mockPendingJob,
      }),
    }));

    mock.method(robotOrchestrator, "trigger", async (contractId, action, options) => {
      assert.strictEqual(contractId, "contract_abc");
      assert.strictEqual(action, "send");
      assert.strictEqual(options.jobId, "job_pending_1");
      return { success: true, jobId: "job_pending_1" };
    });

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 1);
    assert.strictEqual(result.jobId, "job_pending_1");
    assert.strictEqual(result.contractId, "contract_abc");
  });

  it("deve tratar erros se o trigger do orchestrator falhar", async () => {
    const mockPendingJob = {
      _id: "job_err_1",
      contractId: "contract_xyz",
      action: "status",
      status: "pending",
    };

    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: true,
      mode: "robot",
    }));

    mock.method(SystemConfig, "findOne", () => ({
      lean: async () => ({ value: { enabled: false } }),
    }));

    mock.method(RobotJob, "countDocuments", async () => 0);
    mock.method(RobotJob, "findOne", () => ({
      sort: () => ({
        lean: async () => mockPendingJob,
      }),
    }));

    mock.method(robotOrchestrator, "trigger", async () => {
      throw new Error("Erro de execução no robô");
    });

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.processed, 1);
    assert.strictEqual(result.error, "Erro de execução no robô");
  });
});
