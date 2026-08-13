import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB, { connectContractsDB } from "./config/database.js";
import robotScheduler from "./modules/robot-docusign/services/robotScheduler.js";

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
