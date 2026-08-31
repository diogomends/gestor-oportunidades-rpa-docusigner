import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../../../backend/src/app.js";
import User from "../../../backend/src/models/User.js";
import RobotJob from "../../../backend/src/modules/robot-docusign/models/RobotJob.js";
import Contract from "../../../backend/src/models/Contract.js";
import SystemConfig from "../../../backend/src/models/SystemConfig.js";
import robotOrchestrator from "../../../backend/src/modules/robot-docusign/services/robotOrchestrator.js";

describe("Robot DocuSign - Regressão de Rotas (supertest)", () => {
  let tokenAdmin;
  let tokenVendedor;

  beforeEach(() => {
    mock.restoreAll();

    tokenAdmin = jwt.sign({ id: "admin_user_id" }, process.env.JWT_SECRET);
    tokenVendedor = jwt.sign({ id: "vendedor_user_id" }, process.env.JWT_SECRET);

    mock.method(User, "findById", (id) => {
      let userObj = null;
      if (id === "admin_user_id") {
        userObj = {
          _id: "admin_user_id",
          nome: "Admin Test",
          email: "admin@test.com",
          cargo: "admin",
          ativo: true,
        };
      } else if (id === "vendedor_user_id") {
        userObj = {
          _id: "vendedor_user_id",
          nome: "Vendedor Test",
          email: "vendedor@test.com",
          cargo: "vendedor",
          ativo: true,
        };
      }
      return {
        select: () => Promise.resolve(userObj),
      };
    });

    // Mock SystemConfig.findOne para bypass do timeRestriction (retorna null = sem restrição)
    mock.method(SystemConfig, "findOne", () => ({ lean: async () => null }));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe("POST /api/robot-docusign/trigger", () => {
    it("deve retornar 401 sem token", async () => {
      const res = await request(app).post("/api/robot-docusign/trigger").expect(401);
      assert.ok(res.body.message);
    });

    it("deve retornar 400 se contractId não for fornecido para ação send", async () => {
      mock.method(RobotJob, "countDocuments", async () => 0);
      mock.method(robotOrchestrator, "trigger", async () => ({ success: true, jobId: "j1" }));

      const res = await request(app)
        .post("/api/robot-docusign/trigger")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({ action: "send" })
        .expect(400);

      assert.ok(res.body.error);
    });

    it("deve retornar 400 para action inválida", async () => {
      const res = await request(app)
        .post("/api/robot-docusign/trigger")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({ contractId: "c1", action: "invalid_action" })
        .expect(400);

      assert.ok(res.body.error);
    });

    it("deve chamar robotOrchestrator.trigger com dados válidos", async () => {
      const triggerResult = { success: true, mode: "api", jobId: "job123" };
      mock.method(robotOrchestrator, "trigger", async () => triggerResult);

      const res = await request(app)
        .post("/api/robot-docusign/trigger")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({ contractId: "c1", action: "send" })
        .expect(202);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.jobId, "c1");
    });

    it("deve aceitar contract_id como alias de contractId", async () => {
      mock.method(robotOrchestrator, "trigger", async () => ({ success: true, jobId: "j2" }));

      const res = await request(app)
        .post("/api/robot-docusign/trigger")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({ contract_id: "c2", action: "status" })
        .expect(202);

      assert.strictEqual(res.body.success, true);
    });

    it("deve permitir ação reports sem contractId", async () => {
      mock.method(robotOrchestrator, "trigger", async () => ({ success: true, jobId: "j3" }));

      const res = await request(app)
        .post("/api/robot-docusign/trigger")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({ action: "reports" })
        .expect(202);

      assert.strictEqual(res.body.success, true);
    });
  });

  describe("GET /api/robot-docusign/status/:jobId", () => {
    it("deve retornar 401 sem token", async () => {
      await request(app).get("/api/robot-docusign/status/job123").expect(401);
    });

    it("deve retornar 404 se job não for encontrado", async () => {
      mock.method(RobotJob, "findOne", () => ({
        sort: () => ({ lean: async () => null }),
      }));

      const res = await request(app)
        .get("/api/robot-docusign/status/nonexistent")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(404);

      assert.strictEqual(res.body.error, "Job não encontrado");
    });

    it("deve retornar job existente", async () => {
      const mockJob = { _id: "job123", status: "completed", action: "send" };
      mock.method(RobotJob, "findOne", () => ({
        sort: () => ({ lean: async () => mockJob }),
      }));

      const res = await request(app)
        .get("/api/robot-docusign/status/job123")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.job._id, "job123");
    });
  });

  describe("GET /api/robot-docusign/jobs", () => {
    it("deve retornar 401 sem token", async () => {
      await request(app).get("/api/robot-docusign/jobs").expect(401);
    });

    it("deve listar jobs com paginação padrão", async () => {
      const mockJobs = [{ _id: "j1" }, { _id: "j2" }];
      mock.method(RobotJob, "find", () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => mockJobs,
            }),
          }),
        }),
      }));
      mock.method(RobotJob, "countDocuments", async () => 2);

      const res = await request(app)
        .get("/api/robot-docusign/jobs")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.total, 2);
      assert.strictEqual(res.body.page, 1);
      assert.strictEqual(res.body.limit, 20);
    });

    it("deve filtrar por status e ação", async () => {
      mock.method(RobotJob, "find", () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [],
            }),
          }),
        }),
      }));
      mock.method(RobotJob, "countDocuments", async () => 0);

      const res = await request(app)
        .get("/api/robot-docusign/jobs?status=completed&action=send")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.jobs.length, 0);
    });

    it("deve retornar 500 em caso de erro no banco", async () => {
      mock.method(RobotJob, "find", () => {
        throw new Error("DB error");
      });

      await request(app)
        .get("/api/robot-docusign/jobs")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(500);
    });
  });

  describe("GET /api/robot-docusign/metrics", () => {
    it("deve retornar 401 sem token", async () => {
      await request(app).get("/api/robot-docusign/metrics").expect(401);
    });

    it("deve retornar métricas agregadas", async () => {
      mock.method(RobotJob, "countDocuments", async () => 10);
      mock.method(RobotJob, "aggregate", async () => []);

      const res = await request(app)
        .get("/api/robot-docusign/metrics")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.metrics.totalJobs === "number");
      assert.ok(typeof res.body.metrics.successRate === "number");
    });

    it("deve retornar 500 em caso de erro", async () => {
      mock.method(RobotJob, "countDocuments", async () => {
        throw new Error("Aggregate failed");
      });

      await request(app)
        .get("/api/robot-docusign/metrics")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(500);
    });
  });

  describe("GET /api/robot-docusign/logs/:jobId", () => {
    it("deve retornar 401 sem token", async () => {
      await request(app).get("/api/robot-docusign/logs/job123").expect(401);
    });

    it("deve retornar 404 se job não existir", async () => {
      mock.method(RobotJob, "findById", () => ({
        select: () => ({ lean: async () => null }),
      }));

      const res = await request(app)
        .get("/api/robot-docusign/logs/nonexistent")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(404);

      assert.strictEqual(res.body.error, "Job não encontrado");
    });

    it("deve retornar logs do job com steps", async () => {
      const mockJob = {
        _id: "job123",
        status: "completed",
        action: "send",
        mode: "api",
        attempts: 1,
        max_attempts: 3,
        steps: [{ name: "init", status: "success" }],
        createdAt: new Date(),
        completedAt: new Date(),
      };
      mock.method(RobotJob, "findById", () => ({
        select: () => ({ lean: async () => mockJob }),
      }));

      const res = await request(app)
        .get("/api/robot-docusign/logs/job123")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.steps.length, 1);
      assert.strictEqual(res.body.status, "completed");
    });
  });

  describe("GET /api/robot-docusign/config", () => {
    it("deve retornar 401 sem token", async () => {
      await request(app).get("/api/robot-docusign/config").expect(401);
    });

    it("deve retornar configuração do robô", async () => {
      mock.method(SystemConfig, "findOne", () => ({ lean: async () => null }));

      const res = await request(app)
        .get("/api/robot-docusign/config")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.config);
    });
  });

  describe("PUT /api/robot-docusign/config", () => {
    it("deve retornar 401 sem token", async () => {
      await request(app).put("/api/robot-docusign/config").expect(401);
    });

    it("deve retornar 403 para vendedor (não admin)", async () => {
      const res = await request(app)
        .put("/api/robot-docusign/config")
        .set("Authorization", `Bearer ${tokenVendedor}`)
        .send({ enabled: true })
        .expect(403);

      assert.ok(res.body.message || res.body.error);
    });

    it("deve atualizar config para admin", async () => {
      mock.method(SystemConfig, "findOne", () => ({
        lean: async () => null,
      }));
      mock.method(SystemConfig, "findOneAndUpdate", async () => ({
        value: { enabled: true, mode: "robot" },
      }));

      const res = await request(app)
        .put("/api/robot-docusign/config")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({ enabled: true, mode: "robot" })
        .expect(200);

      assert.strictEqual(res.body.success, true);
    });

    it("deve atualizar config com token_notification_email para admin", async () => {
      mock.method(SystemConfig, "findOne", () => ({
        lean: async () => null,
      }));
      mock.method(SystemConfig, "findOneAndUpdate", async (_query, update) => ({
        value: update.$set ? update.$set.value : update.value,
      }));

      // ponytail: dados fake; em dev real vêm de process.env via .env.dev (nunca hardcode segredo real)
      const testEmail = process.env.TEST_IMAP_EMAIL || "notificacao@example.com";
      const testHost = process.env.TEST_IMAP_HOST || "mail.example.com";
      const res = await request(app)
        .put("/api/robot-docusign/config")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({
          token_notification_email: {
            email: testEmail,
            password: "test_email_password_123",
            host: testHost,
            port: 993,
            tls: true,
          },
        })
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.config);
    });

    it("deve retornar 400 para dados inválidos", async () => {
      const res = await request(app)
        .put("/api/robot-docusign/config")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({ mode: "invalid_mode" })
        .expect(400);

      assert.ok(res.body.error);
    });
  });

  describe("POST /api/robot-docusign/test-login", () => {
    it("deve retornar 401 sem token", async () => {
      await request(app).post("/api/robot-docusign/test-login").expect(401);
    });

    it("deve retornar 403 para vendedor", async () => {
      const res = await request(app)
        .post("/api/robot-docusign/test-login")
        .set("Authorization", `Bearer ${tokenVendedor}`)
        .expect(403);

      assert.ok(res.body.message || res.body.error);
    });

    it("deve retornar 400 quando otpCode não tem exatamente 6 dígitos numéricos", async () => {
      const res = await request(app)
        .post("/api/robot-docusign/test-login")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({ otpCode: "12ab6" })
        .expect(400);

      assert.ok(res.body.details.some((d) => d.path?.includes("otpCode") || d.message.includes("otpCode")));
    });
  });

  describe("GET /api/robot-docusign/queue", () => {
    it("deve retornar 401 sem token", async () => {
      await request(app).get("/api/robot-docusign/queue").expect(401);
    });

    it("deve retornar fila de jobs ativos", async () => {
      const mockQueue = [
        { _id: "j1", status: "pending" },
        { _id: "j2", status: "processing" },
      ];
      mock.method(RobotJob, "find", () => ({
        sort: () => ({ lean: async () => mockQueue }),
      }));

      const res = await request(app)
        .get("/api/robot-docusign/queue")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.count, 2);
      assert.strictEqual(res.body.queue.length, 2);
    });

    it("deve retornar fila vazia", async () => {
      mock.method(RobotJob, "find", () => ({
        sort: () => ({ lean: async () => [] }),
      }));

      const res = await request(app)
        .get("/api/robot-docusign/queue")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(200);

      assert.strictEqual(res.body.count, 0);
    });
  });

  describe("POST /api/robot-docusign/process-pending", () => {
    it("deve retornar 401 sem token", async () => {
      await request(app).post("/api/robot-docusign/process-pending").expect(401);
    });

    it("deve executar processPendingJobs para usuário autenticado", async () => {
      mock.method(robotOrchestrator, "getRobotConfig", async () => ({
        enabled: true,
        mode: "robot",
      }));
      mock.method(RobotJob, "countDocuments", async () => 0);
      mock.method(RobotJob, "findOne", () => ({
        sort: () => ({ lean: async () => null }),
      }));
      mock.method(Contract, "findOne", () => ({
        sort: () => ({ lean: async () => null }),
      }));

      const res = await request(app)
        .post("/api/robot-docusign/process-pending")
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.status, "idle");
    });
  });
});

