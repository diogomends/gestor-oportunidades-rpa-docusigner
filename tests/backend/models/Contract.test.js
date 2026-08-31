import { describe, it } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import Contract from "../../../backend/src/models/Contract.js";

/**
 * Testes unitários e de regressão para o schema Mongoose de Contract.
 * Valida a presença e persistência dos campos envelopeId e docusign_envelope_id.
 */
describe("Contract Model Unit & Regression Tests", () => {
  it("deve conter explicitamente os caminhos de schema envelopeId e docusign_envelope_id", () => {
    assert.ok(Contract.schema.paths.envelopeId, "Campo envelopeId deve estar definido no schema");
    assert.ok(Contract.schema.paths.docusign_envelope_id, "Campo docusign_envelope_id deve estar definido no schema");
    assert.strictEqual(Contract.schema.paths.envelopeId.instance, "String");
    assert.strictEqual(Contract.schema.paths.docusign_envelope_id.instance, "String");
  });

  it("deve instanciar um documento válido com valores default para envelopeId e docusign_envelope_id como null", () => {
    const doc = new Contract({
      status: "gerado",
      client: {
        razaoSocial: "Empresa Teste LTDA",
        cnpj: "12.345.678/0001-90",
      },
    });

    const err = doc.validateSync();
    assert.strictEqual(err, undefined, "Validação de schema não deve retornar erro");
    assert.strictEqual(doc.envelopeId, null, "Default de envelopeId deve ser null");
    assert.strictEqual(doc.docusign_envelope_id, null, "Default de docusign_envelope_id deve ser null");
    assert.strictEqual(doc.status, "gerado");
  });

  it("deve atribuir e manter valores de envelopeId e docusign_envelope_id sem descarte pelo strict mode", () => {
    const testEnvelopeId = "env-docusign-abc-123";
    const testLegacyEnvelopeId = "env-legacy-xyz-789";

    const doc = new Contract({
      status: "enviado",
      envelopeId: testEnvelopeId,
      docusign_envelope_id: testLegacyEnvelopeId,
    });

    assert.strictEqual(doc.envelopeId, testEnvelopeId);
    assert.strictEqual(doc.docusign_envelope_id, testLegacyEnvelopeId);

    const serialized = doc.toObject();
    assert.strictEqual(serialized.envelopeId, testEnvelopeId, "envelopeId deve ser serializado no objeto do documento");
    assert.strictEqual(
      serialized.docusign_envelope_id,
      testLegacyEnvelopeId,
      "docusign_envelope_id deve ser serializado no objeto do documento"
    );
  });

  it("deve validar o enum de status aceitando valores válidos e rejeitando inválidos", () => {
    const validStatuses = ["rascunho", "gerado", "enviado", "assinado", "cancelado"];
    for (const validStatus of validStatuses) {
      const doc = new Contract({ status: validStatus });
      const err = doc.validateSync();
      assert.strictEqual(err, undefined, `Status '${validStatus}' deve ser válido`);
    }

    const invalidDoc = new Contract({ status: "status_invalido_123" });
    const err = invalidDoc.validateSync();
    assert.ok(err, "Status inválido deve falhar na validação");
    assert.ok(err.errors.status, "Erro de validação deve ser atribuído ao campo status");
  });
});
