import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import "../../helpers/setup.js";
import gestorApiClient, {
  validateApiKey,
  fetchPendingContracts,
  updateContractStatus,
} from "../../../backend/src/services/gestorApiClient.js";

describe("Unit Tests: gestorApiClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mock.restoreAll();
    process.env.GESTOR_API_URL = "http://localhost:3000/api";
    process.env.ROBOT_API_KEY = "test_robot_api_key_123";
  });

  afterEach(() => {
    mock.restoreAll();
    process.env = { ...originalEnv };
  });

  describe("validateApiKey", () => {
    it("deve retornar erro se ROBOT_API_KEY não estiver configurada no ambiente", async () => {
      delete process.env.ROBOT_API_KEY;

      const result = await validateApiKey();

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, "ROBOT_API_KEY não configurada");
    });

    it("deve retornar valid true quando o Gestor Central responder 200 com valid: true", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          valid: true,
          cargo: "admin",
          requestedBy: "user_65cb1234",
          active: true,
        }),
      };

      global.fetch = mock.fn(async (url, opts) => {
        assert.strictEqual(url, "http://localhost:3000/api/internal/robot-keys/validate");
        assert.strictEqual(opts.method, "POST");
        assert.strictEqual(opts.headers["x-robot-key"], "test_robot_api_key_123");
        assert.strictEqual(JSON.parse(opts.body).key, "test_robot_api_key_123");
        return mockResponse;
      });

      const result = await validateApiKey();

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.cargo, "admin");
      assert.strictEqual(result.requestedBy, "user_65cb1234");
      assert.strictEqual(result.active, true);
    });

    it("deve retornar valid false quando a API retornar HTTP 401", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: async () => ({ error: "Chave inválida" }),
      };

      global.fetch = mock.fn(async () => mockResponse);

      const result = await validateApiKey({ retries: 0 });

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, "HTTP 401");
    });

    it("deve tratar erro de rede ou timeout graciosamente sem lançar exceção", async () => {
      global.fetch = mock.fn(async () => {
        const err = new Error("Connection refused");
        err.code = "ECONNREFUSED";
        throw err;
      });

      const result = await validateApiKey({ retries: 0 });

      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes("Connection refused"));
    });
  });

  describe("fetchPendingContracts", () => {
    it("deve buscar contratos pendentes com query params e header x-robot-key", async () => {
      const mockContracts = [
        { _id: "c1", status: "gerado", client: { razaoSocial: "Empresa A" } },
        { _id: "c2", status: "gerado", client: { razaoSocial: "Empresa B" } },
      ];

      global.fetch = mock.fn(async (url, opts) => {
        assert.ok(url.includes("/api/contracts?status=gerado"));
        assert.strictEqual(opts.method, "GET");
        assert.strictEqual(opts.headers["x-robot-key"], "test_robot_api_key_123");
        return {
          ok: true,
          status: 200,
          json: async () => ({ contracts: mockContracts }),
        };
      });

      const contracts = await fetchPendingContracts({ status: "gerado" }, { retries: 0 });

      assert.strictEqual(contracts.length, 2);
      assert.strictEqual(contracts[0]._id, "c1");
      assert.strictEqual(contracts[1]._id, "c2");
    });

    it("deve suportar resposta com array direto retornado pela API", async () => {
      const mockContracts = [{ _id: "c3", status: "pending_signature" }];

      global.fetch = mock.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => mockContracts,
      }));

      const contracts = await fetchPendingContracts(undefined, { retries: 0 });

      assert.strictEqual(contracts.length, 1);
      assert.strictEqual(contracts[0]._id, "c3");
    });

    it("deve lançar erro quando a busca de contratos falhar", async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 500,
      }));

      await assert.rejects(
        async () => {
          await fetchPendingContracts({ status: "gerado" }, { retries: 0 });
        },
        /Erro ao buscar contratos: HTTP 500/
      );
    });
  });

  describe("updateContractStatus", () => {
    it("deve atualizar contrato via PUT com payload e header x-robot-key", async () => {
      const payload = { status: "enviado", envelopeId: "env_abc_123" };

      global.fetch = mock.fn(async (url, opts) => {
        assert.strictEqual(url, "http://localhost:3000/api/contracts/contract_xyz");
        assert.strictEqual(opts.method, "PUT");
        assert.strictEqual(opts.headers["x-robot-key"], "test_robot_api_key_123");
        assert.deepStrictEqual(JSON.parse(opts.body), payload);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, contract: { _id: "contract_xyz", status: "enviado" } }),
        };
      });

      const result = await updateContractStatus("contract_xyz", payload, { retries: 0 });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.contract.status, "enviado");
    });

    it("deve lançar erro quando o update retornar erro HTTP", async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 404,
      }));

      await assert.rejects(
        async () => {
          await updateContractStatus("invalid_id", { status: "enviado" }, { retries: 0 });
        },
        /Erro ao atualizar contrato: HTTP 404/
      );
    });
  });
});
