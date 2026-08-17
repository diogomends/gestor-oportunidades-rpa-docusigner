import fs from "node:fs";
import path from "node:path";

/**
 * Carrega a configuração da máquina a partir de constantes embutidas no build,
 * variáveis de ambiente ou config.json opcional.
 *
 * @returns {Object} Configuração estruturada.
 */
export function loadConfig() {
  // Procura config.json opcional no diretório do executável ou no cwd (para dev/debug)
  const execDir = path.dirname(process.execPath || process.argv[1]);
  const possiblePaths = [
    path.join(process.cwd(), "config.json"),
    path.join(execDir, "config.json"),
    path.join(process.cwd(), "robot-standalone", "config.json"),
  ];

  let fileConfig = {};
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

  const config = {
    API_URL: (process.env.API_URL || fileConfig.API_URL || "http://localhost:3111").replace(/\/$/, ""),
    ROBOT_ID: process.env.ROBOT_ID || fileConfig.ROBOT_ID || `robot-${Math.random().toString(36).substring(2, 7)}`,
    ROBOT_EMAIL: process.env.ROBOT_EMAIL || fileConfig.ROBOT_EMAIL || "robot@gestordeoportunidades.com.br",
    ROBOT_PASS: process.env.ROBOT_PASS || fileConfig.ROBOT_PASS || "",
    HEADLESS: process.env.HEADLESS !== undefined ? (process.env.HEADLESS === "true" || process.env.HEADLESS === true) : (fileConfig.HEADLESS !== false),
    POLL_INTERVAL_SECONDS: parseInt(process.env.POLL_INTERVAL_SECONDS || fileConfig.POLL_INTERVAL_SECONDS || "15", 10),
  };

  return config;
}

export default { loadConfig };

