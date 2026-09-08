import { describe, it } from "node:test";
import assert from "node:assert";
import { Scheduler } from "../../robot/src/scheduler.js";

const makeApi = (overrides = {}) => ({
  getConfig: async () => ({ enabled: true, isAllowedNow: true }),
  getNextJob: async () => ({ hasJob: false, reason: "no_pending_jobs" }),
  sendHeartbeat: async () => ({ success: true }),
  ...overrides,
});

describe("Scheduler - telemetria ociosa", () => {
  it("tick sem jobs enfileira mensagem no buffer", async () => {
    const sched = new Scheduler(makeApi(), { processJob: async () => {} });
    await sched.tick();
    assert.strictEqual(sched.telemetryBuffer.length, 1);
    assert.match(sched.telemetryBuffer[0], /\[Scheduler\] Sem jobs pendentes.*no_pending_jobs/);
  });

  it("pushTelemetry respeita cap 50 FIFO", () => {
    const sched = new Scheduler(makeApi(), {});
    for (let i = 0; i < 60; i++) sched.pushTelemetry(`msg ${i}`);
    assert.strictEqual(sched.telemetryBuffer.length, 50);
    assert.ok(sched.telemetryBuffer[0].endsWith("msg 10"));
    assert.ok(sched.telemetryBuffer[49].endsWith("msg 59"));
  });

  it("flushHeartbeat esvazia buffer em 2xx", async () => {
    const sched = new Scheduler(makeApi(), {});
    sched.pushTelemetry("a");
    sched.pushTelemetry("b");
    const res = await sched.flushHeartbeat("idle", null);
    assert.ok(res);
    assert.strictEqual(sched.telemetryBuffer.length, 0);
  });

  it("flushHeartbeat retém buffer em falha de rede", async () => {
    const sched = new Scheduler(
      makeApi({ sendHeartbeat: async () => null }),
      {}
    );
    sched.pushTelemetry("a");
    const res = await sched.flushHeartbeat("idle", null);
    assert.strictEqual(res, null);
    assert.strictEqual(sched.telemetryBuffer.length, 1);
  });

  it("sendHeartbeat fatia 20 e trunca 500 chars", async () => {
    let sent = null;
    const { ApiClient } = await import("../../robot/src/api-client.js");
    const api = new ApiClient("http://localhost:9", "inst-1", "all");
    api.token = "t";
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (_url, opts) => {
      sent = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ success: true }) };
    };
    try {
      await api.sendHeartbeat("idle", null, 0, Array.from({ length: 25 }, () => "x".repeat(600)));
      assert.strictEqual(sent.telemetryLogs.length, 20);
      assert.strictEqual(sent.telemetryLogs[0].length, 500);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
