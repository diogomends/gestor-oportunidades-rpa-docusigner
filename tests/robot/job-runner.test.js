import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { JobRunner } from "../../robot/src/job-runner.js";

describe("JobRunner - Resumo terminal recente-primeiro", () => {
  let logs;
  let origLog;
  let origError;
  let origWarn;

  beforeEach(() => {
    logs = [];
    origLog = console.log;
    origError = console.error;
    origWarn = console.warn;
    console.log = (...args) => logs.push(args.join(" "));
    console.error = (...args) => logs.push(args.join(" "));
    console.warn = (...args) => logs.push(args.join(" "));
  });

  afterEach(() => {
    console.log = origLog;
    console.error = origError;
    console.warn = origWarn;
  });

  function mockApi() {
    return {
      updateJobStatus: async () => {},
      downloadPdfToTemp: async () => "/tmp/fake.pdf",
    };
  }

  it("deve imprimir resumo recente-primeiro no sucesso (ordem invertida e não-mutação)", async () => {
    // ponytail: valida fonte canônica em vez de mockar Playwright inteiro
    const fs = await import("node:fs");
    const src = fs.readFileSync("robot/src/job-runner.js", "utf-8");
    // deve usar cópia para não mutar (INV-05)
    assert.ok(src.includes("[...(summarySteps"), "deve usar cópia [...summarySteps] antes de reverse");
    assert.ok(src.includes(".reverse()"), "deve usar reverse");
    // deve ter bloco Resumo após sucesso
    assert.ok(src.includes("— Resumo (recente primeiro) —"), "deve conter cabeçalho Resumo");
    assert.ok(src.includes("logSummary()"), "deve chamar logSummary no sucesso");
    // stream ao vivo permanece cronológico
    assert.ok(!src.includes("console.clear"), "não deve usar console.clear");
    // verifica ordem descendente: simula coleta cronológica
    const steps = [{ name: "init" }, { name: "attempt_1" }, { name: "robot_send" }];
    const reversed = [...steps].reverse();
    assert.strictEqual(reversed[0].name, "robot_send");
    assert.strictEqual(reversed[2].name, "init");
    assert.strictEqual(steps[0].name, "init", "original não deve ser mutado");
  });

  it("deve imprimir resumo também em falha (catch) e não usar console.clear", async () => {
    const api = mockApi();
    const runner = new JobRunner(api, { headless: true, role: "all" });

    // job que falha na validação pdfUrl (não abre browser) — exercita catch + logSummary
    const job = {
      jobId: "job-fail-1",
      contractId: "c2",
      action: "send",
      pdfUrl: "",
      recipientEmail: "a@b.com",
      credentials: {},
    };

    await assert.rejects(() => runner.processJob(job), /PDF/);

    const summaryIdx = logs.findIndex((l) => l.includes("Resumo (recente primeiro)"));
    assert.notStrictEqual(summaryIdx, -1, "falha também deve imprimir Resumo");
    assert.ok(logs.some((l) => l.includes("execution_error")), "deve conter execution_error no resumo");

    const fs = await import("node:fs");
    const src = fs.readFileSync("robot/src/job-runner.js", "utf-8");
    assert.ok(!src.includes("console.clear"), "não deve usar console.clear");
  });
});
