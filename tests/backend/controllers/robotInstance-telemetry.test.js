import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "node:events";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../../../backend/src/app.js";
import User from "../../../backend/src/models/User.js";
import RobotInstance from "../../../backend/src/modules/robot-docusign/models/RobotInstance.js";
import { pushLogs, getLogs, pruneIdle } from "../../../backend/src/modules/robot-docusign/utils/telemetryBuffer.js";
import { robotEvents } from "../../../backend/src/modules/robot-docusign/seletorApiRobot/orchestratorEvents.js";
import { streamInstanceTelemetry } from "../../../backend/src/modules/robot-docusign/controllers/robotInstanceController.js";

describe("Telemetria ociosa - RingBuffer", () => {
  it("FIFO cap 100 por instância", () => {
    const id = `inst-fifo-${Date.now()}`;
    pushLogs(id, Array.from({ length: 120 }, (_, i) => `log ${i}`));
    const logs = getLogs(id);
    assert.strictEqual(logs.length, 100);
    assert.strictEqual(logs[0], "log 20");
    assert.strictEqual(logs[99], "log 119");
  });

  it("getLogs retorna cópia (sem alias mutável)", () => {
    const id = `inst-copy-${Date.now()}`;
    pushLogs(id, ["a"]);
    const copy = getLogs(id);
    copy.push("hack");
    assert.strictEqual(getLogs(id).length, 1);
  });

  it("pruneIdle remove instâncias inativas (>10 min)", () => {
    const idActive = `inst-act-${Date.now()}`;
    const idIdle = `inst-idle-${Date.now()}`;
    pushLogs(idActive, ["log active"]);
    pushLogs(idIdle, ["log idle"]);

    const now = Date.now();
    const map = new Map();
    map.set(idActive, now - 1000); // 1s atrás
    map.set(idIdle, now - 700000); // ~11 min atrás

    pruneIdle(map, 600000);
    assert.strictEqual(getLogs(idActive).length, 1);
    assert.strictEqual(getLogs(idIdle).length, 0);
  });
});

describe("Telemetria ociosa - HTTP + SSE", () => {
  let tokenAdmin;

  beforeEach(() => {
    mock.restoreAll();
    tokenAdmin = jwt.sign({ id: "admin_user_id" }, process.env.JWT_SECRET);
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

  it("POST /instance/heartbeat aceita telemetryLogs e GET /instances/:id/telemetry retorna", async () => {
    const instId = `inst-http-${Date.now()}`;
    const doc = { instance_id: instId, status: "idle", last_heartbeat: new Date() };
    mock.method(RobotInstance, "findOneAndUpdate", async () => doc);
    mock.method(RobotInstance, "findOne", () => ({ lean: async () => doc }));

    await request(app)
      .post("/api/robot-docusign/instance/heartbeat")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ instance_id: instId, status: "idle", telemetryLogs: ["[00:00:01] [Scheduler] Sem jobs pendentes (Motivo: no_pending_jobs)"] })
      .expect(200);

    const res = await request(app)
      .get(`/api/robot-docusign/instances/${instId}/telemetry`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .expect(200);
    assert.strictEqual(res.body.instanceId, instId);
    assert.ok(res.body.logs.some((l) => l.includes("no_pending_jobs")));
  });

  it("POST /instance/heartbeat sem telemetryLogs continua 200 (retrocompat)", async () => {
    const doc = { instance_id: "inst-legado", status: "idle", last_heartbeat: new Date() };
    mock.method(RobotInstance, "findOneAndUpdate", async () => doc);
    await request(app)
      .post("/api/robot-docusign/instance/heartbeat")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ instance_id: "inst-legado", status: "idle" })
      .expect(200);
  });

  it("POST /instance/heartbeat rejeita >20 msgs (400)", async () => {
    const res = await request(app)
      .post("/api/robot-docusign/instance/heartbeat")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ instance_id: "x", status: "idle", telemetryLogs: Array.from({ length: 21 }, () => "l") })
      .expect(400);
    assert.ok(res.body.error);
  });

  it("GET /instances?includeLogs=true inclui logs; sem flag omite", async () => {
    const instId = `inst-list-${Date.now()}`;
    pushLogs(instId, ["ping-ocioso"]);
    const docs = [{ instance_id: instId, status: "idle", last_heartbeat: new Date() }];
    mock.method(RobotInstance, "find", () => ({ sort: () => ({ lean: async () => docs }) }));

    const withLogs = await request(app)
      .get("/api/robot-docusign/instances?includeLogs=true")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .expect(200);
    assert.ok(withLogs.body.instances[0].logs.includes("ping-ocioso"));

    const without = await request(app)
      .get("/api/robot-docusign/instances")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .expect(200);
    assert.strictEqual(without.body.instances[0].logs, undefined);
  });

  it("SSE stream: handshake com buffer + evento filtrado por instanceId", async () => {
    const instId = `inst-sse-${Date.now()}`;
    pushLogs(instId, ["buf-1"]);
    mock.method(RobotInstance, "findOne", () => ({
      lean: async () => ({ instance_id: instId, status: "idle", last_heartbeat: new Date() }),
    }));

    const writes = [];
    const req = new EventEmitter();
    req.params = { instanceId: instId };
    const res = {
      setHeader: () => {},
      flushHeaders: () => {},
      write: (c) => writes.push(c),
      end: () => {},
    };

    const promise = streamInstanceTelemetry(req, res);
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(writes.length >= 1, "handshake SSE esperado");
    assert.ok(writes[0].includes("buf-1"));

    robotEvents.emit("instance:telemetry", { instanceId: "outra", logs: ["vazamento"] });
    robotEvents.emit("instance:telemetry", { instanceId: instId, logs: ["ao-vivo"] });
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(!writes.join("").includes("vazamento"), "evento de outra instância não deve vazar");
    assert.ok(writes.join("").includes("ao-vivo"));
    req.emit("close");
    await promise;
  });

  it("SSE stream: encerra de forma limpa caso cliente desconecte antes da inicialização", async () => {
    const instId = `inst-sse-abort-${Date.now()}`;
    const writes = [];
    const req = new EventEmitter();
    req.params = { instanceId: instId };
    req.destroyed = true; // Simula socket abortado
    const res = {
      setHeader: () => {},
      flushHeaders: () => {},
      write: (c) => writes.push(c),
      end: () => {},
    };

    const countBefore = robotEvents.listenerCount("instance:telemetry");
    await streamInstanceTelemetry(req, res);
    const countAfter = robotEvents.listenerCount("instance:telemetry");
    assert.strictEqual(countAfter, countBefore, "não deve registrar listeners no EventEmitter quando o socket já foi destruído");
    assert.strictEqual(writes.length, 0);
  });
});
