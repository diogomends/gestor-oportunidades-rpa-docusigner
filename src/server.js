import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB, { connectContractsDB } from "./config/database.js";
import robotScheduler from "./modules/robot-docusign/services/robotScheduler.js";
import { validateApiKey } from "./services/gestorApiClient.js";

import "./models/User.js";
import "./models/Contract.js";
import "./models/SystemConfig.js";
import "./modules/robot-docusign/models/RobotJob.js";
import "./modules/robot-docusign/models/RobotSession.js";
import "./modules/robot-docusign/models/RobotInstance.js";

const PORT = process.env.PORT || 3111;

const startServer = async () => {
  await connectDB();
  await connectContractsDB();

  // Validação da API Key do Robô junto ao Gestor
  const keyValidation = await validateApiKey();
  if (!keyValidation.valid) {
    console.error("[RPA DocuSigner] Chave de API do robô inválida ou revogada. Verifique o painel do Gestor.");
    process.exit(1);
  }
  console.log(`[RPA DocuSigner] API Key validada com sucesso (Cargo: ${keyValidation.cargo || "N/A"})`);

  // Automatic boot of RPA task scheduler
  robotScheduler.start();
  console.log("[RPA DocuSigner] Agendador de tarefas ativado com sucesso");

  app.listen(PORT, () => {
    console.log(`[RPA DocuSigner] Servidor rodando na porta ${PORT}`);
  });
};

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

startServer();
