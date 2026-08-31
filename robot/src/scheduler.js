import logger from "./utils/logger.js";

/**
 * Scheduler em loop para busca e processamento contínuo de jobs na máquina do agente.
 */
export class Scheduler {
  /**
   * Cria uma instância do Scheduler.
   * @param {import('./api-client.js').ApiClient} apiClient - Cliente da API central.
   * @param {import('./job-runner.js').JobRunner} jobRunner - Executor de jobs Playwright.
   * @param {Object} [initialConfig={}] - Configuração inicial ({ enabled, isAllowedNow }).
   * @param {number} [pollIntervalSeconds=15] - Intervalo de polling em segundos.
   */
  constructor(apiClient, jobRunner, initialConfig = {}, pollIntervalSeconds = 15) {
    this.api = apiClient;
    this.runner = jobRunner;
    this.config = initialConfig;
    this.pollIntervalMs = pollIntervalSeconds * 1000;
    this.running = false;
    this.jobsProcessedCount = 0;
    this.heartbeatTimer = null;
  }

  /**
   * Inicia o loop de polling e o heartbeat periódico.
   * @returns {Promise<void>} Resolve quando o loop é interrompido via stop().
   */
  async start() {
    this.running = true;
    logger.step("Scheduler", `Agendador iniciado com sucesso. Intervalo de verificação: ${this.pollIntervalMs / 1000}s`);

    // Iniciar timer de Heartbeat a cada 30 segundos
    this.heartbeatTimer = setInterval(async () => {
      if (this.running) {
        await this.api.sendHeartbeat("idle", null, this.jobsProcessedCount).catch(() => {});
      }
    }, 30000);

    while (this.running) {
      try {
        await this.tick();
      } catch (error) {
        logger.error("Scheduler", `Erro no ciclo de polling: ${error.message}`);
      }

      if (this.running) {
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      }
    }
  }

  /**
   * Executa um ciclo de verificação: atualiza config, busca e processa próximo job.
   * @returns {Promise<void>} Resolve ao final do ciclo (sem job ou após processar um job).
   */
  async tick() {
    // 1. Atualiza configuração e horários
    try {
      const liveConfig = await this.api.getConfig();
      this.config = liveConfig;
    } catch (e) {
      logger.warn("Scheduler", `Não foi possível atualizar config da API: ${e.message}`);
    }

    if (!this.config.enabled) {
      logger.step("Scheduler", "Robô desabilitado no Gestor de Oportunidades. Aguardando...");
      return;
    }

    if (this.config.isAllowedNow === false) {
      logger.step("Scheduler", "Fora do horário de expediente permitido pelo sistema. Aguardando...");
      return;
    }

    // 2. Busca próximo job com lock atômico
    const jobResponse = await this.api.getNextJob();

    if (!jobResponse.hasJob) {
      if (jobResponse.reason === "contract_missing_pdf_or_email") {
        logger.warn("Scheduler", `Contrato ignorado: ${jobResponse.message || "Falta PDF ou e-mail de destinatário"}`);
      } else if (jobResponse.reason && jobResponse.reason !== "no_pending_jobs") {
        logger.step("Scheduler", `Sem jobs a processar. Motivo: ${jobResponse.reason}${jobResponse.message ? ` (${jobResponse.message})` : ""}`);
      } else {
        logger.step("Scheduler", `Sem jobs pendentes (Motivo: ${jobResponse.reason || "no_pending_jobs"}).`);
      }
      return;
    }

    // 3. Executa o job recebido
    logger.success("Scheduler", `Job recebido da fila: ${jobResponse.jobId} (Contrato: ${jobResponse.contractId})`);
    await this.api.sendHeartbeat("busy", jobResponse.jobId, this.jobsProcessedCount);

    try {
      await this.runner.processJob(jobResponse);
      this.jobsProcessedCount++;
      logger.success("Scheduler", `Job ${jobResponse.jobId} concluído com sucesso. Total processados hoje: ${this.jobsProcessedCount}`);
    } catch (err) {
      logger.error("Scheduler", `Falha na execução do job ${jobResponse.jobId}: ${err.message}`);
    } finally {
      await this.api.sendHeartbeat("idle", null, this.jobsProcessedCount);
    }
  }

  /**
   * Para o loop do agendador e limpa o timer de heartbeat.
   * @returns {void}
   */
  stop() {
    this.running = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    logger.step("Scheduler", "Agendador parado.");
  }
}

export default Scheduler;
