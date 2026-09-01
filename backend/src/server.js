import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import app from "./app.js";
import connectDB, { connectContractsDB } from "./config/database.js";
import robotScheduler from "./modules/robot-docusign/services/robotScheduler.js";
import statusSyncScheduler from "./modules/robot-docusign/services/statusSyncScheduler.js";
import { validateApiKey } from "./services/gestorApiClient.js";

import "./models/User.js";
import "./models/Contract.js";
import "./models/SystemConfig.js";
import "./modules/robot-docusign/models/RobotJob.js";
import "./modules/robot-docusign/models/RobotSession.js";
import "./modules/robot-docusign/models/RobotInstance.js";

/** 
 * Porta do servidor HTTP.
 * @constant 
 * @type {number|string} 
 */
const PORT = process.env.PORT || 3111;

/** 
 * Instância do servidor HTTP.
 * @type {import('http').Server|null} 
 */
let httpServer = null;

/**
 * Bootstraps the backend server:
 * - Connects to primary and contracts MongoDB databases
 * - Validates robot API Key against Gestor API
 * - Starts the RPA background scheduler and status sync scheduler
 * - Binds HTTP server on configured PORT
 * @returns {Promise<void>}
 * @async
 */
const startServer = async () => {
  await connectDB();
  await connectContractsDB();

  // Validação da API Key do Robô junto ao Gestor
  const keyValidation = await validateApiKey();
  if (!keyValidation.valid) {
    if (process.env.NODE_ENV === "production") {
      console.error("[RPA DocuSigner] Chave de API do robô inválida ou revogada. Verifique o painel do Gestor.");
      process.exit(1);
    } else {
      console.warn(`[RPA DocuSigner] [DEV] Validação da API Key não bloqueante em desenvolvimento: ${keyValidation.error || "Chave ausente ou inválida"}`);
    }
  } else {
    console.log(`[RPA DocuSigner] API Key validada com sucesso (Cargo: ${keyValidation.cargo || "N/A"})`);
  }

  // Automatic boot of RPA task scheduler
  robotScheduler.start();
  console.log("[RPA DocuSigner] Agendador de tarefas ativado com sucesso");

  // Automatic boot of RPA status sync scheduler
  await statusSyncScheduler.start();
  console.log("[RPA DocuSigner] Agendador de consulta periódica de status ativado com sucesso");

  httpServer = app.listen(PORT, () => {
    console.log(`[RPA DocuSigner] Servidor rodando na porta ${PORT}`);
  });
};

/**
 * Finaliza as conexões e schedulers de forma graciosa.
 * @param {string} signal - O sinal recebido (SIGTERM, SIGINT).
 * @returns {Promise<void>}
 * @async
 */
const shutdownServer = async (signal) => {
  console.log(`\n[RPA DocuSigner] Recebido sinal ${signal}, iniciando Graceful Shutdown...`);
  statusSyncScheduler.stop();
  robotScheduler.stop();
  if (httpServer) {
    httpServer.close(() => {
      console.log("[RPA DocuSigner] Servidor HTTP fechado.");
    });
  }
  await mongoose.disconnect();
  console.log("[RPA DocuSigner] MongoDB desconectado.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdownServer("SIGTERM"));
process.on("SIGINT", () => shutdownServer("SIGINT"));

startServer();

