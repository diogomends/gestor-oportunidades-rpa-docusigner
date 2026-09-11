import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import robotScheduler from "../../../backend/src/modules/robot-docusign/services/robotScheduler.js";
import robotOrchestrator from "../../../backend/src/modules/robot-docusign/services/robotOrchestrator.js";
import RobotJob from "../../../backend/src/modules/robot-docusign/models/RobotJob.js";
import RobotInstance from "../../../backend/src/modules/robot-docusign/models/RobotInstance.js";
import SystemConfig from "../../../backend/src/models/SystemConfig.js";

describe("Robot DocuSign - Unit Tests: robotScheduler", () => {
  beforeEach(() => {
    mock.restoreAll();
    mock.method(SystemConfig, "findOne", () => ({
      lean: async () => null,
    }));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("deve pular execução se o robô estiver desabilitado", async () => {
    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: false,
      mode: "api",
    }));

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.disabled, true);
    assert.strictEqual(result.reason, "robot_disabled");
  });

  it("deve pular execução se o robô estiver em modo API", async () => {
    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: true,
      mode: "api",
    }));

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.reason, "robot_disabled");
  });

  it("deve pular execução se estiver fora do horário de expediente permitido", async () => {
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

  it("deve retornar fleet_active e pular envio inline quando houver robô de envio online", async () => {
    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: true,
      mode: "robot",
      limits: { max_concurrent: 1 },
    }));

    mock.method(SystemConfig, "findOne", () => ({
      lean: async () => ({ value: { enabled: false } }),
    }));

    mock.method(RobotJob, "countDocuments", async () => 0);

    mock.method(RobotInstance, "findOne", () => ({
      lean: async () => ({
        instance_id: "robot-enviar-1",
        role: "update",
        status: "online",
        last_heartbeat: new Date(),
      }),
    }));

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.status, "skipped");
    assert.strictEqual(result.reason, "fleet_active");
    assert.strictEqual(result.activeInstanceId, "robot-enviar-1");
  });

  it("deve retornar fleet_offline e não executar envio no servidor quando a frota estiver offline", async () => {
    mock.method(robotOrchestrator, "getRobotConfig", async () => ({
      enabled: true,
      mode: "robot",
      limits: { max_concurrent: 1 },
    }));

    mock.method(SystemConfig, "findOne", () => ({
      lean: async () => ({ value: { enabled: false } }),
    }));

    mock.method(RobotJob, "countDocuments", async () => 0);

    mock.method(RobotInstance, "findOne", () => ({
      lean: async () => null,
    }));

    const result = await robotScheduler.processPendingJobs();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.status, "skipped");
    assert.strictEqual(result.reason, "fleet_offline");
  });
});
