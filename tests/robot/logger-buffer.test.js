import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import logger, { drainJobLogs, clearJobLogs } from "../../robot/src/utils/logger.js";

/**
 * @file Teste de regressão para bufferização de logs em memória do robô standalone.
 * Valida o cumprimento do requisito LOG-01 (Task T1).
 */

describe("Robot Logger - Buffer em Memória (T1 Regression)", () => {
  beforeEach(() => {
    clearJobLogs();
  });

  it("deve acumular mensagens formatadas de todos os níveis de log no buffer", () => {
    logger.step("TestModule", "Iniciando etapa 1");
    logger.success("TestModule", "Operação concluída com sucesso");
    logger.warn("TestModule", "Aviso de teste");
    logger.error("TestModule", "Falha de teste");
    logger.info("TestModule", "Informação geral");

    const logs = drainJobLogs();
    assert.strictEqual(logs.length, 5);

    assert.ok(logs[0].includes("[TestModule] Iniciando etapa 1"));
    assert.ok(logs[1].includes("[TestModule] ✓ Operação concluída com sucesso"));
    assert.ok(logs[2].includes("[TestModule] ⚠ Aviso de teste"));
    assert.ok(logs[3].includes("[TestModule] ✗ Falha de teste"));
    assert.ok(logs[4].includes("[TestModule] Informação geral"));

    // Valida padrão de timestamp [HH:MM:SS]
    const timestampRegex = /^\[\d{2}:\d{2}:\d{2}\]/;
    for (const logLine of logs) {
      assert.match(logLine, timestampRegex);
    }
  });

  it("drainJobLogs deve esvaziar o buffer após a drenagem", () => {
    logger.step("DrainTest", "Mensagem de teste");
    const firstDrain = drainJobLogs();
    assert.strictEqual(firstDrain.length, 1);

    const secondDrain = drainJobLogs();
    assert.strictEqual(secondDrain.length, 0);
  });

  it("clearJobLogs deve limpar o buffer sem retornar valores", () => {
    logger.step("ClearTest", "Mensagem para limpar");
    clearJobLogs();
    const logs = drainJobLogs();
    assert.strictEqual(logs.length, 0);
  });
});
