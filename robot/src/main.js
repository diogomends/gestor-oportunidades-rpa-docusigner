// Compatibility shim for Node.js 18.20.4 up to 20+
if (typeof process !== "undefined" && process.versions && process.versions.node) {
  const currentMajor = parseInt(process.versions.node.split(".")[0], 10);
  if (currentMajor < 20) {
    try {
      Object.defineProperty(process.versions, "node", {
        value: "20.0.0",
        configurable: true,
        writable: true,
      });
    } catch (_) {}
  }
}

import { loadConfig } from "./config.js";
import { ApiClient } from "./api-client.js";
import { JobRunner } from "./job-runner.js";
import { Scheduler } from "./scheduler.js";
import logger from "./utils/logger.js";

/**
 * Bootstraps the standalone RPA DocuSigner robot client process:
 * 1. Loads local configuration and initializes the API client
 * 2. Authenticates against the backend API via ROBOT_KEY
 * 3. Retrieves system configuration and registers initial heartbeat
 * 4. Starts the job runner and polling scheduler with graceful shutdown handlers
 * @param {string} [roleOverride] - Optional role override ("query" | "update" | "all").
 * @returns {Promise<void>}
 */
export async function bootstrap(roleOverride) {
  console.log("==================================================");
  console.log("🤖 Robô RPA DocuSigner - Gestor de Oportunidades");
  console.log("==================================================");

  const config = loadConfig();
  if (roleOverride) {
    config.ROBOT_ROLE = roleOverride;
  }
  logger.step("Main", `Conectando a: ${config.API_URL}`);
  logger.step("Main", `Papel (ROBOT_ROLE): ${config.ROBOT_ROLE} | Sessão: ${config.DOCUSIGN_SESSION_PATH}`);
  logger.step("Main", `Modo Navegador: ${config.HEADLESS ? "Headless (sem janela)" : "Headed (com janela)"}`);

  const api = new ApiClient(config.API_URL, null, config.ROBOT_ROLE);

  try {
    // 1. Autenticação na API central via Chave de API
    if (!config.ROBOT_KEY) {
      throw new Error("ROBOT_KEY não configurada. Defina a chave de API do robô para autenticação.");
    }

    logger.step("Main", `Autenticando com Chave de API (X-Robot-Key: ${config.ROBOT_KEY.substring(0, 8)}...)...`);
    await api.authenticate(config.ROBOT_KEY);
    logger.success("Main", `Instância identificada pelo servidor: ${api.instanceId}`);

    // 2. Busca configuração inicial
    const systemConfig = await api.getConfig();
    logger.success("Main", `Configurações obtidas com sucesso. Robô habilitado: ${systemConfig.enabled ? "SIM" : "NÃO"}`);

    // 3. Heartbeat inicial
    await api.sendHeartbeat("active", null, 0);

    // 4. Iniciar runner e scheduler
    const runner = new JobRunner(api, {
      headless: config.HEADLESS,
      role: config.ROBOT_ROLE,
      sessionFilePath: config.DOCUSIGN_SESSION_PATH || undefined,
    });
    const scheduler = new Scheduler(api, runner, systemConfig, config.POLL_INTERVAL_SECONDS);

    process.on("SIGINT", () => {
      logger.step("Main", "Encerrando robô com segurança...");
      scheduler.stop();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      logger.step("Main", "Encerrando robô...");
      scheduler.stop();
      process.exit(0);
    });

    await scheduler.start();
  } catch (error) {
    logger.error("Main", `Erro fatal na inicialização: ${error.message}`);
    process.exit(1);
  }
}

// Executa bootstrap automaticamente quando executado como script principal
if (typeof process !== "undefined" && process.argv && process.argv[1] && process.argv[1].endsWith("main.js")) {
  bootstrap();
} else if (typeof process !== "undefined" && !process.argv) {
  bootstrap();
}


