import fs from "node:fs";
import path from "node:path";
import { normalizeRole } from "./utils/roleActions.js";

/**
 * Carrega a configuração da máquina a partir de constantes embutidas no build,
 * variáveis de ambiente ou config.json opcional.
 *
 * @returns {Object} Configuração estruturada.
 */
export function loadConfig() {
  let fileConfig = {};

  // Procura config.json opcional apenas em ambiente de desenvolvimento (dev/debug)
  if (process.env.NODE_ENV === "development") {
    const execDir = path.dirname(process.execPath || process.argv[1]);
    const possiblePaths = [
      path.join(process.cwd(), "config.json"),
      path.join(execDir, "config.json"),
      path.join(process.cwd(), "robot", "config.json"),
      path.join(process.cwd(), "robot-standalone", "config.json"),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, "utf-8");
          fileConfig = JSON.parse(raw);
          console.log(`[Config] Configuração sobrescrita via: ${p}`);
          break;
        } catch (e) {
          console.warn(`[Config] Erro ao ler ${p}:`, e.message);
        }
      }
    }
  }

  // Resolver ROBOT_ROLE de CLI --role ou env
  let robotRole = process.env.ROBOT_ROLE || fileConfig.ROBOT_ROLE || "all";
  for (let i = 0; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith("--role=")) robotRole = a.split("=")[1];
    else if (a === "--role" && process.argv[i + 1]) robotRole = process.argv[++i];
  }
  robotRole = normalizeRole(robotRole) || "all";

  // Resolver HEADLESS: argv --headless > env HEADLESS > fileConfig > true (ponytail: runtime override libera exibir-tela.bat)
  let headlessArg = null;
  for (let i = 0; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith("--headless=")) {
      const v = a.split("=")[1].toLowerCase().trim();
      headlessArg = !(v === "false" || v === "0" || v === "no" || v === "off");
    } else if (a === "--headless" && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith("--")) {
      const v = process.argv[++i].toLowerCase().trim();
      headlessArg = !(v === "false" || v === "0" || v === "no" || v === "off");
    } else if (a === "--headless") {
      headlessArg = true;
    }
  }

  const sessionByRole = {
    query: path.resolve(process.cwd(), "session-query.json"),
    update: path.resolve(process.cwd(), "session-update.json"),
    all: process.env.DOCUSIGN_SESSION_PATH || fileConfig.DOCUSIGN_SESSION_PATH || path.resolve(process.cwd(), "session-docusign.json"),
  };

  const parseHeadlessEnv = (v) => {
    if (v === true) return true;
    const s = String(v).toLowerCase().trim();
    return !(s === "false" || s === "0" || s === "no" || s === "off");
  };
  const config = {
    API_URL: (process.env.API_URL || fileConfig.API_URL || "http://localhost:3111").replace(/\/$/, ""),
    ROBOT_KEY: process.env.ROBOT_KEY || fileConfig.ROBOT_KEY || "",
    ROBOT_ROLE: robotRole,
    HEADLESS: headlessArg !== null ? headlessArg : (process.env.HEADLESS !== undefined ? parseHeadlessEnv(process.env.HEADLESS) : (fileConfig.HEADLESS !== false)),
    POLL_INTERVAL_SECONDS: parseInt(process.env.POLL_INTERVAL_SECONDS || fileConfig.POLL_INTERVAL_SECONDS || "15", 10),
    DOCUSIGN_SESSION_PATH: process.env.DOCUSIGN_SESSION_PATH || fileConfig.DOCUSIGN_SESSION_PATH || sessionByRole[robotRole],
  };

  return config;
}

/**
 * Exportação padrão do módulo de configuração.
 * @type {{loadConfig: typeof loadConfig}}
 */
export default { loadConfig };

