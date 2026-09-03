import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import {
  assertChromiumInstalled,
  resolveCandidateDirs,
  resolveChromiumExecutablePath,
} from "../../robot/src/utils/playwrightResolver.js";

describe("PlaywrightResolver - fail-fast Chromium", () => {
  it("lança erro orientando setup.bat quando o binário não resolve (null)", () => {
    assert.throws(
      () => assertChromiumInstalled({ resolveFn: () => null, existsSync: () => false }),
      /Chromium não encontrado.*setup\.bat/
    );
  });

  it("lança erro com o caminho quando o binário não existe no disco", () => {
    assert.throws(
      () =>
        assertChromiumInstalled({
          resolveFn: () => "C:\\fake\\chrome.exe",
          existsSync: () => false,
        }),
      /Chromium não encontrado em: C:\\fake\\chrome\.exe/
    );
  });

  it("retorna o caminho quando o binário existe (sem lançar)", () => {
    const exe = assertChromiumInstalled({
      resolveFn: () => "C:\\fake\\chrome.exe",
      existsSync: () => true,
    });
    assert.strictEqual(exe, "C:\\fake\\chrome.exe");
  });

  it("resolveChromiumExecutablePath real: string existente ou null (sem browser em CI)", () => {
    const exePath = resolveChromiumExecutablePath();
    assert.ok(
      exePath === null || (typeof exePath === "string" && fs.existsSync(exePath)),
      "deve resolver para binário existente ou null"
    );
  });

  it("candidateDirs deduplicados (sem process.cwd + path.resolve('.') redundantes)", () => {
    const dirs = resolveCandidateDirs();
    assert.strictEqual(new Set(dirs).size, dirs.length, "sem duplicatas");
  });

  it("main.js e job-runner.js reusam o resolver canônico (sem duplicação local)", () => {
    const main = fs.readFileSync("robot/src/main.js", "utf-8");
    const runner = fs.readFileSync("robot/src/job-runner.js", "utf-8");
    const resolver = fs.readFileSync("robot/src/utils/playwrightResolver.js", "utf-8");
    assert.ok(main.includes("utils/playwrightResolver.js"), "main.js deve importar o resolver");
    assert.ok(runner.includes("utils/playwrightResolver.js"), "job-runner.js deve importar o resolver");
    assert.ok(!main.includes("function resolveChromiumExecutablePath"), "main.js sem cópia local");
    assert.ok(!main.includes("function assertChromiumInstalled"), "main.js sem cópia local");
    assert.ok(!runner.includes("function resolvePlaywright"), "job-runner.js sem cópia local");
    assert.ok(!runner.includes("function getChromium"), "job-runner.js sem cópia local");
    assert.ok(resolver.includes("setup.bat"), "mensagem fail-fast deve citar setup.bat");
  });
});
