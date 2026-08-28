import { describe, it } from "node:test";
import assert from "node:assert";
import "../../helpers/setup.js";
import RobotSession, { syncSessionAliases } from "../../../backend/src/modules/robot-docusign/models/RobotSession.js";

/**
 * Testes unitários para o model RobotSession do Robô DocuSign.
 * Valida REQ-003 e T03-session.md.
 */
describe("RobotSession Model Unit Tests", () => {
  it("deve criar um documento válido com email e tipos Mixed/Date", () => {
    const expires = new Date();
    const lastUsed = new Date();
    const doc = new RobotSession({
      email: "robot@empresa.com",
      cookies: [{ name: "sid", value: "abc12345" }],
      localStorage: { theme: "dark" },
      user_agent: "Mozilla/5.0",
      expires_at: expires,
      last_used_at: lastUsed,
    });

    const err = doc.validateSync();
    assert.strictEqual(err, undefined, "Validação não deve gerar erros");
    assert.strictEqual(doc.email, "robot@empresa.com");
    assert.deepStrictEqual(doc.cookies, [{ name: "sid", value: "abc12345" }]);
    assert.deepStrictEqual(doc.localStorage, { theme: "dark" });
  });

  it("deve falhar a validação se o email não for fornecido", () => {
    const doc = new RobotSession({
      cookies: [],
    });

    const err = doc.validateSync();
    assert.ok(err, "Deve gerar erro de validação");
    assert.ok(err.errors.email, "Erro deve ser referente ao campo email");
  });

  it("deve sincronizar aliases (expires_at <-> expiresAt, last_used_at <-> lastUsedAt, user_agent <-> userAgent) no pre-save", () => {
    const expires = new Date("2026-12-31T23:59:59Z");
    const lastUsed = new Date("2026-08-11T12:00:00Z");

    const doc = new RobotSession({
      email: "test@example.com",
      expires_at: expires,
      lastUsedAt: lastUsed,
      user_agent: "Playwright-Browser",
    });

    syncSessionAliases(doc);

    assert.strictEqual(doc.expiresAt.getTime(), expires.getTime());
    assert.strictEqual(doc.last_used_at.getTime(), lastUsed.getTime());
    assert.strictEqual(doc.userAgent, "Playwright-Browser");
  });
});
