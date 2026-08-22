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

async function bootstrap() {
  console.log("==================================================");
  console.log("🤖 Robô RPA DocuSigner - Gestor de Oportunidades");
  console.log("==================================================");

  const config = loadConfig();
  console.log(`[Main] Conectando a: ${config.API_URL}`);
  console.log(`[Main] Modo Navegador: ${config.HEADLESS ? "Headless (sem janela)" : "Headed (com janela)"}`);

  const api = new ApiClient(config.API_URL);

  try {
    // 1. Autenticação na API central via Chave de API
    if (!config.ROBOT_KEY) {
      throw new Error("ROBOT_KEY não configurada. Defina a chave de API do robô para autenticação.");
    }

    console.log(`[Main] Autenticando com Chave de API (X-Robot-Key: ${config.ROBOT_KEY.substring(0, 8)}...)...`);
    await api.authenticate(config.ROBOT_KEY);
    console.log(`[Main] Instância identificada pelo servidor: ${api.instanceId}`);

    // 2. Busca configuração inicial
    const systemConfig = await api.getConfig();
    console.log(`[Main] Configurações obtidas. Robô habilitado: ${systemConfig.enabled ? "SIM" : "NÃO"}`);

    // 3. Heartbeat inicial
    await api.sendHeartbeat("active", null, 0);

    // 4. Iniciar runner e scheduler
    const runner = new JobRunner(api, { headless: config.HEADLESS });
    const scheduler = new Scheduler(api, runner, systemConfig, config.POLL_INTERVAL_SECONDS);

    process.on("SIGINT", () => {
      console.log("\n[Main] Encerrando robô com segurança...");
      scheduler.stop();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("\n[Main] Encerrando robô...");
      scheduler.stop();
      process.exit(0);
    });

    await scheduler.start();
  } catch (error) {
    console.error("[Main] Erro fatal na inicialização:", error.message);
    process.exit(1);
  }
}

bootstrap();
