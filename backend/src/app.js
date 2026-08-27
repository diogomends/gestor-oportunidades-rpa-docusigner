import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import robotDocusignModule from "./modules/robot-docusign/index.js";

/**
 * Express application instance configured with security, logging, and CORS middleware.
 * @type {import("express").Express}
 */
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

// Mount robot DocuSign routes
app.use("/api/robot-docusign", robotDocusignModule.routes);

/**
 * Public health check endpoint for container and uptime monitoring.
 * @name get/health
 * @function
 * @param {import("express").Request} req - Express request object.
 * @param {import("express").Response} res - Express response object.
 */
app.get("/health", (req, res) => res.status(200).json({ status: "OK", service: "gestor-oportunidades-rpa-docusigner" }));

export default app;

