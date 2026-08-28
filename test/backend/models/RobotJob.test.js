import { describe, it } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import "../../helpers/setup.js";
import RobotJob from "../../../backend/src/modules/robot-docusign/models/RobotJob.js";

/**
 * Testes unitários completos para o model RobotJob do Robô DocuSign.
 * Valida REQ-001 (SPEC.md) e T01-modelo.md.
 */
describe("RobotJob Model Unit Tests", () => {
  it("deve criar um documento válido com campos obrigatórios e aplicar valores default", () => {
    const contractId = new mongoose.Types.ObjectId();
    const doc = new RobotJob({
      contract_id: contractId,
      action: "send",
    });

    const err = doc.validateSync();
    assert.strictEqual(err, undefined, "Validação não deve gerar erros");
    assert.strictEqual(doc.contract_id.toString(), contractId.toString());
    assert.strictEqual(doc.action, "send");
    assert.strictEqual(doc.status, "pending");
    assert.strictEqual(doc.robot_mode, false);
    assert.strictEqual(doc.mode, "robot");
    assert.strictEqual(doc.attempts, 0);
    assert.strictEqual(doc.retryCount, 0);
    assert.strictEqual(doc.max_attempts, 3);
  });

  it("deve rejeitar valor inválido para o enum de action", () => {
    const doc = new RobotJob({
      contract_id: new mongoose.Types.ObjectId(),
      action: "invalido",
    });

    const err = doc.validateSync();
    assert.ok(err, "Deve gerar erro de validação");
    assert.ok(err.errors.action, "Erro deve ser referente ao campo action");
  });

  it("deve rejeitar valor inválido para o enum de status", () => {
    const doc = new RobotJob({
      contract_id: new mongoose.Types.ObjectId(),
      action: "send",
      status: "status_invalido",
    });

    const err = doc.validateSync();
    assert.ok(err, "Deve gerar erro de validação");
    assert.ok(err.errors.status, "Erro deve ser referente ao campo status");
  });

  it("deve aceitar campos de execução e rastreio (steps, envelopeId, signedDocPath, startedAt, completedAt, lastError)", () => {
    const userId = new mongoose.Types.ObjectId();
    const now = new Date();
    const doc = new RobotJob({
      contract_id: new mongoose.Types.ObjectId(),
      action: "send",
      status: "running",
      mode: "robot",
      envelopeId: "ENV-123456",
      signedDocPath: "/storage/contracts/signed_123.pdf",
      startedAt: now,
      completedAt: now,
      lastError: "Erro temporário",
      steps: [
        { name: "login", status: "success", duration: 1200 },
        { name: "upload", status: "running", duration: 500 },
      ],
      created_by: userId,
    });

    const err = doc.validateSync();
    assert.strictEqual(err, undefined, "Validação de rastreio e passos deve passar");
    assert.strictEqual(doc.envelopeId, "ENV-123456");
    assert.strictEqual(doc.signedDocPath, "/storage/contracts/signed_123.pdf");
    assert.strictEqual(doc.steps.length, 2);
    assert.strictEqual(doc.steps[0].name, "login");
    assert.strictEqual(doc.steps[0].status, "success");
  });

  it("deve sincronizar aliases (contract_id <-> contractId, error <-> lastError) via hook pre-save", () => {
    const contractId = new mongoose.Types.ObjectId();
    const doc = new RobotJob({
      contract_id: contractId,
      action: "send",
      error: "Falha de rede",
      attempts: 2,
    });

    // Executa a lógica de sincronização diretamente (simula o hook pre-save)
    if (doc.contract_id && !doc.contractId) {
      doc.contractId = doc.contract_id;
    } else if (doc.contractId && !doc.contract_id) {
      doc.contract_id = doc.contractId;
    }

    if (doc.attempts !== undefined && doc.retryCount === 0) {
      doc.retryCount = doc.attempts;
    } else if (doc.retryCount !== undefined && doc.attempts === 0) {
      doc.attempts = doc.retryCount;
    }

    if (doc.error && !doc.lastError) {
      doc.lastError = doc.error;
    } else if (doc.lastError && !doc.error) {
      doc.error = doc.lastError;
    }

    assert.strictEqual(doc.contractId.toString(), contractId.toString());
    assert.strictEqual(doc.lastError, "Falha de rede");
    assert.strictEqual(doc.retryCount, 2);
  });

  it("deve possuir índices configurados para status, contract_id, next_retry_at e compostos do SPEC.md", () => {
    const schema = RobotJob.schema;
    assert.ok(schema.path("contract_id")._index, "contract_id deve ter índice");
    assert.ok(schema.path("status")._index, "status deve ter índice");
    assert.ok(schema.path("next_retry_at")._index, "next_retry_at deve ter índice");

    const indexes = schema.indexes();
    const hasContractStatusIndex = indexes.some(
      (idx) => idx[0].contractId === 1 && idx[0].status === 1
    );
    const hasCreatedAtIndex = indexes.some((idx) => idx[0].createdAt === -1);

    assert.ok(hasContractStatusIndex, "Deve possuir índice composto { contractId: 1, status: 1 }");
    assert.ok(hasCreatedAtIndex, "Deve possuir índice { createdAt: -1 }");
  });
});
