import { describe, it } from "node:test";
import assert from "node:assert";
import contractEligibility, {
  GERADO_ELIGIBLE_FILTER,
  CONTRACT_ELIGIBLE_FILTER,
  ELIGIBLE_CONTRACTS_FILTER,
  hasPdf,
  hasRecipientEmail,
  isEligibleForSend,
} from "../../../backend/src/modules/robot-docusign/utils/contractEligibility.js";

describe("Regression Tests: Contract Eligibility (Non-Draft & Aliases)", () => {
  describe("Filtro MongoDB (GERADO_ELIGIBLE_FILTER e Aliases)", () => {
    it("deve conter a regra de status diferente de rascunho", () => {
      assert.deepStrictEqual(GERADO_ELIGIBLE_FILTER.status, { $ne: "rascunho" });
    });

    it("deve exigir documento originalUrl existente e não-vazio", () => {
      assert.deepStrictEqual(GERADO_ELIGIBLE_FILTER["documents.originalUrl"], {
        $exists: true,
        $ne: null,
        $ne: "",
      });
    });

    it("deve conter fallback de 4 campos de e-mail no $or", () => {
      assert.strictEqual(Array.isArray(GERADO_ELIGIBLE_FILTER.$or), true);
      assert.strictEqual(GERADO_ELIGIBLE_FILTER.$or.length, 4);

      const emailFields = GERADO_ELIGIBLE_FILTER.$or.map((cond) => Object.keys(cond)[0]);
      assert.deepStrictEqual(emailFields, [
        "client.representante.email",
        "signer.email",
        "email",
        "clientEmail",
      ]);
    });

    it("deve garantir que CONTRACT_ELIGIBLE_FILTER e ELIGIBLE_CONTRACTS_FILTER sejam idênticos a GERADO_ELIGIBLE_FILTER", () => {
      assert.strictEqual(CONTRACT_ELIGIBLE_FILTER, GERADO_ELIGIBLE_FILTER);
      assert.strictEqual(ELIGIBLE_CONTRACTS_FILTER, GERADO_ELIGIBLE_FILTER);
      assert.strictEqual(contractEligibility.GERADO_ELIGIBLE_FILTER, GERADO_ELIGIBLE_FILTER);
      assert.strictEqual(contractEligibility.CONTRACT_ELIGIBLE_FILTER, GERADO_ELIGIBLE_FILTER);
      assert.strictEqual(contractEligibility.ELIGIBLE_CONTRACTS_FILTER, GERADO_ELIGIBLE_FILTER);
    });
  });

  describe("Validação em Memória (hasPdf, hasRecipientEmail, isEligibleForSend)", () => {
    it("hasPdf deve validar corretamente documentos válidos e inválidos", () => {
      assert.strictEqual(hasPdf(null), false);
      assert.strictEqual(hasPdf({}), false);
      assert.strictEqual(hasPdf({ documents: [] }), false);
      assert.strictEqual(hasPdf({ documents: [{ originalUrl: "" }] }), false);
      assert.strictEqual(hasPdf({ documents: [{ originalUrl: "   " }] }), false);
      assert.strictEqual(hasPdf({ documents: [{ originalUrl: "https://storage.com/contrato.pdf" }] }), true);
    });

    it("hasRecipientEmail deve validar e-mail nos 4 campos suportados com trim", () => {
      assert.strictEqual(hasRecipientEmail(null), false);
      assert.strictEqual(hasRecipientEmail({}), false);
      assert.strictEqual(hasRecipientEmail({ email: "   " }), false);

      assert.strictEqual(hasRecipientEmail({ client: { representante: { email: "rep@exemplo.com" } } }), true);
      assert.strictEqual(hasRecipientEmail({ signer: { email: "signer@exemplo.com" } }), true);
      assert.strictEqual(hasRecipientEmail({ email: "direct@exemplo.com" }), true);
      assert.strictEqual(hasRecipientEmail({ clientEmail: "client@exemplo.com" }), true);
    });

    it("isEligibleForSend deve aprovar contratos não-rascunho com PDF e e-mail", () => {
      const validContract = {
        status: "pendente",
        documents: [{ originalUrl: "/uploads/contrato-123.pdf" }],
        client: { representante: { email: "cliente@empresa.com" } },
      };

      assert.strictEqual(isEligibleForSend(validContract), true);
    });

    it("isEligibleForSend deve reprovar contratos sem PDF ou sem e-mail", () => {
      const missingPdf = {
        status: "gerado",
        documents: [],
        email: "teste@empresa.com",
      };
      const missingEmail = {
        status: "em_aprovacao",
        documents: [{ originalUrl: "/uploads/contrato-456.pdf" }],
      };

      assert.strictEqual(isEligibleForSend(missingPdf), false);
      assert.strictEqual(isEligibleForSend(missingEmail), false);
    });
  });
});
