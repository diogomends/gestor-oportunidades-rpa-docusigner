import express from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import { authorize } from "../../middlewares/roleMiddleware.js";
import {
  triggerJob,
  triggerBatch,
  getJobStatus,
  listJobs,
  getMetrics,
  getJobLogs,
  getConfig,
  updateConfig,
  testLogin,
  getQueue,
  processPending,
  streamJobProgress,
} from "./controllers/robotDocusignController.js";

import { getAllInstances } from "./controllers/robotInstanceController.js";
import instanceRoutes from "./routes/robotInstanceRoutes.js";

/**
 * Express router exposing operational and administrative endpoints for DocuSign RPA automation.
 * Prefix: /api/robot-docusign
 * @type {import("express").Router}
 */
const router = express.Router();

// Sub-roteador de instâncias do robô (com seu próprio controle de auth pública + protegida sob /instance)
router.use("/instance", instanceRoutes);

// Todas as rotas administrativas e operacionais abaixo exigem autenticação
router.use(protect);

router.get("/instances", authorize("admin"), getAllInstances);

router.post("/trigger", triggerJob);
router.post("/trigger-batch", authorize("admin"), triggerBatch);
router.get("/status/:jobId", getJobStatus);
router.get("/jobs/:jobId/stream", protect, streamJobProgress);
router.get("/jobs", listJobs);
router.get("/metrics", getMetrics);
router.get("/logs/:jobId", getJobLogs);
router.get("/config", getConfig);
router.put("/config", authorize("admin"), updateConfig);
router.post("/test-login", authorize("admin"), testLogin);
router.get("/queue", getQueue);
router.post("/process-pending", processPending);

export default router;

