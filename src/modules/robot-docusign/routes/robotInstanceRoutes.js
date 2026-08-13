import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import {
  authenticateInstance,
  getInstanceConfig,
  getNextJob,
  updateJobStatus,
  registerHeartbeat,
  downloadContractPdf,
} from "../controllers/robotInstanceController.js";

const router = express.Router();

// 1. Rota pública para autenticação da instância do robô
router.post("/auth", authenticateInstance);

// 2. Rotas protegidas por JWT
router.use(protect);

router.get("/config", getInstanceConfig);
router.get("/next-job", getNextJob);
router.patch("/job/:jobId/status", updateJobStatus);
router.post("/heartbeat", registerHeartbeat);
router.get("/contracts/:contractId/pdf", downloadContractPdf);

export default router;
