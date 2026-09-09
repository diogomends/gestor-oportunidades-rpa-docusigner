import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import app from "../../../backend/src/app.js";
import User from "../../../backend/src/models/User.js";
import Contract from "../../../backend/src/models/Contract.js";
import RobotJob from "../../../backend/src/modules/robot-docusign/models/RobotJob.js";
import RobotInstance from "../../../backend/src/modules/robot-docusign/models/RobotInstance.js";
import { robotEvents } from "../../../backend/src/modules/robot-docusign/seletorApiRobot/orchestratorEvents.js";

/**
 * @file Teste de regressão para propagação de logs no endpoint PATCH /instance/job/:jobId/status.
 * Valida o cumprimento do requisito LOG-03 (Task T3).
 */

describe("updateJobStatus - Propagação de Logs SSE (T3 Regression)", () => {
  let tokenAdmin;
  const mockJobId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    mock.restoreAll();
    tokenAdmin = jwt.sign({ id: "admin_user_id" }, process.env.JWT_SECRET || "default_secret_dev");
    mock.method(User, "findById", () => ({
      select: () =>
        Promise.resolve({
          _id: "admin_user_id",
          nome: "Admin",
          email: "admin@test.com",
          cargo: "admin",
          ativo: true,
        }),
    }));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("deve aceitar array logs no payload e propagar no evento job:progress", async () => {
    const fakeJob = {
      _id: mockJobId,
      status: "processing",
      action: "send",
      steps: [{ name: "launch_browser", status: "running" }],
    };

    mock.method(RobotJob, "findById", () => ({ lean: async () => fakeJob }));
    mock.method(RobotJob, "findByIdAndUpdate", async () => ({
      _id: mockJobId,
      status: "processing",
      contract_id: null,
      action: "send",
    }));
    mock.method(RobotInstance, "findOneAndUpdate", async () => ({}));

    let emittedEvent = null;
    const onProgress = (data) => {
      emittedEvent = data;
    };
    robotEvents.on("job:progress", onProgress);

    const testLogs = [
      "[10:00:00] [JobRunner] Iniciando execução do job",
      "[10:00:01] [Browser] Navegador Playwright inicializado",
    ];

    try {
      const res = await request(app)
        .patch(`/api/robot-docusign/instance/job/${mockJobId}/status`)
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({
          instance_id: "instance-test-1",
          status: "processing",
          step: { name: "launch_browser", status: "success" },
          logs: testLogs,
        })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(emittedEvent, "Evento job:progress deve ter sido emitido");
      assert.strictEqual(emittedEvent.jobId, mockJobId);
      assert.deepStrictEqual(emittedEvent.logs, testLogs, "Logs emitidos no evento devem ser idênticos aos enviados");
    } finally {
      robotEvents.off("job:progress", onProgress);
    }
  });

  it("deve emitir logs como array vazio quando o payload não contiver logs (retrocompat)", async () => {
    const fakeJob = {
      _id: mockJobId,
      status: "processing",
      action: "send",
      steps: [],
    };

    mock.method(RobotJob, "findById", () => ({ lean: async () => fakeJob }));
    mock.method(RobotJob, "findByIdAndUpdate", async () => ({
      _id: mockJobId,
      status: "processing",
      contract_id: null,
      action: "send",
    }));
    mock.method(RobotInstance, "findOneAndUpdate", async () => ({}));

    let emittedEvent = null;
    const onProgress = (data) => {
      emittedEvent = data;
    };
    robotEvents.on("job:progress", onProgress);

    try {
      await request(app)
        .patch(`/api/robot-docusign/instance/job/${mockJobId}/status`)
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({
          instance_id: "instance-test-1",
          status: "processing",
          step: { name: "launch_browser", status: "running" },
        })
        .expect(200);

      assert.ok(emittedEvent);
      assert.deepStrictEqual(emittedEvent.logs, []);
    } finally {
      robotEvents.off("job:progress", onProgress);
    }
  });

  it("deve propagar signedDocPath para o Contrato e payload quando action for download e job completed", async () => {
    const fakeContractId = new mongoose.Types.ObjectId().toString();
    const fakeJob = {
      _id: mockJobId,
      status: "processing",
      action: "download",
      contract_id: fakeContractId,
      steps: [],
    };

    mock.method(RobotJob, "findById", () => ({ lean: async () => fakeJob }));
    mock.method(RobotJob, "findByIdAndUpdate", async () => ({
      _id: mockJobId,
      status: "completed",
      contract_id: fakeContractId,
      action: "download",
      signedDocPath: "uploads/test/contrato_assinado.pdf",
    }));
    mock.method(RobotInstance, "findOneAndUpdate", async () => ({}));

    let contractUpdatedArgs = null;
    mock.method(Contract, "findByIdAndUpdate", async (id, update) => {
      contractUpdatedArgs = { id, update };
      return { _id: id, ...update };
    });

    const res = await request(app)
      .patch(`/api/robot-docusign/instance/job/${mockJobId}/status`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({
        instance_id: "instance-test-1",
        status: "completed",
        signedDocPath: "uploads/test/contrato_assinado.pdf",
      })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.ok(contractUpdatedArgs, "Contract.findByIdAndUpdate deveria ser chamado");
    assert.strictEqual(contractUpdatedArgs.id, fakeContractId);
    assert.strictEqual(contractUpdatedArgs.update.status, "assinado");
    assert.strictEqual(
      contractUpdatedArgs.update.signedDocPath,
      "uploads/test/contrato_assinado.pdf",
      "signedDocPath deve ser propagado para o Contrato na conclusão do download"
    );
  });
});
