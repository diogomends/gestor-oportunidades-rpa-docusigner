import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import robotDocusignModule from "./modules/robot-docusign/index.js";

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.use("/api/robot-docusign", robotDocusignModule.routes);

app.get("/health", (req, res) => res.status(200).json({ status: "OK", service: "gestor-oportunidades-rpa-docusigner" }));

export default app;
