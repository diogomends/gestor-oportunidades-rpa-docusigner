import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "node:events";
import mongoose from "mongoose";

import RobotJob from "../../../backend/src/modules/robot-docusign/models/RobotJob.js";
import { robotEvents } from "../../../backend/src/modules/robot-docusign/seletorApiRobot/orchestratorEvents.js";
import { streamJobProgress } from "../../../backend/src/modules/robot-docusign/controllers/robotDocusignController.js";

/**
 * @file Teste de regressão para streaming SSE de progresso de jobs com logs e evento de encerramento gracioso.
 * Valida o cumprimento do requisito LOG-04 (Task T4).
 */

describe("streamJobProgress - Logs SSE e Evento Done (T4 Regression)", () => {
  const mockJobId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("deve transmitir logs recebidos em tempo real e emitir 'event: done' ao concluir", async () => {
    mock.method(RobotJob, "findOne", () => ({
      sort: () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(mockJobId),
          status: "processing",
          steps: [],
        }),
      }),
    }));

    const writes = [];
    let ended = false;
    const req = new EventEmitter();
    req.params = { jobId: mockJobId };

    const res = {
      setHeader: () => {},
      flushHeaders: () => {},
      write: (data) => writes.push(data),
      end: () => {
        ended = true;
      },
    };

    const promise = streamJobProgress(req, res);
    await new Promise((r) => setTimeout(r, 20));

    assert.ok(writes.length >= 1, "Snapshot inicial deve ter sido enviado");
    assert.ok(writes[0].includes(`"logs":[]`), "Snapshot inicial deve conter logs array");

    // Simula evento emitido com logs e finalização
    const sampleLogs = ["[10:00:00] [Browser] Página carregada", "[10:00:02] [Auth] Login validado"];
    robotEvents.emit("job:progress", {
      jobId: mockJobId,
      status: "completed",
      steps: [{ name: "docusign_send", status: "success" }],
      logs: sampleLogs,
    });

    await new Promise((r) => setTimeout(r, 20));

    const allWrites = writes.join("");
    assert.ok(allWrites.includes("Login validado"), "Logs transmitidos devem conter mensagem do evento");
    assert.ok(allWrites.includes("event: done\ndata: {}\n\n"), "Deve emitir evento gracioso 'event: done'");
    assert.strictEqual(ended, true, "Conexão SSE deve ser encerrada após status completed");

    req.emit("close");
    await promise;
  });

  it("deve emitir 'event: done' imediatamente se o job já estiver finalizado na abertura do stream", async () => {
    mock.method(RobotJob, "findOne", () => ({
      sort: () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(mockJobId),
          status: "completed",
          steps: [{ name: "finish", status: "success" }],
        }),
      }),
    }));

    const writes = [];
    let ended = false;
    const req = new EventEmitter();
    req.params = { jobId: mockJobId };

    const res = {
      setHeader: () => {},
      flushHeaders: () => {},
      write: (data) => writes.push(data),
      end: () => {
        ended = true;
      },
    };

    await streamJobProgress(req, res);

    const allWrites = writes.join("");
    assert.ok(allWrites.includes("event: done\ndata: {}\n\n"), "Deve emitir 'event: done' para job já concluído");
    assert.strictEqual(ended, true, "Conexão deve ser encerrada imediatamente");
  });
});
