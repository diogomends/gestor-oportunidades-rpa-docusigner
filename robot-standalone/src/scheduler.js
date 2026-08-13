/**
 * Scheduler em loop para busca e processamento contínuo de jobs na máquina do agente.
 */
export class Scheduler {
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
   * Inicia o scheduler.
   */
  async start() {
    this.running = true;
    console.log(`[Scheduler] Agendador iniciado. Intervalo de verificação: ${this.pollIntervalMs / 1000}s`);

    // Iniciar timer de Heartbeat a cada 30 segundos
    this.heartbeatTimer = setInterval(async () => {
      if (this.running) {
        await this.api.sendHeartbeat("idle", null, this.jobsProcessedCount);
      }
    }, 30000);

    while (this.running) {
      try {
        await this.tick();
      } catch (error) {
        console.error("[Scheduler] Erro no ciclo de polling:", error.message);
      }

      if (this.running) {
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      }
    }
  }

  /**
   * Executa um ciclo de verificação.
   */
  async tick() {
    // 1. Atualiza configuração e horários
    try {
      const liveConfig = await this.api.getConfig();
      this.config = liveConfig;
    } catch (e) {
      console.warn(`[Scheduler] Não foi possível atualizar config da API: ${e.message}`);
    }

    if (!this.config.enabled) {
      console.log("[Scheduler] Robô desabilitado no Gestor de Oportunidades. Aguardando...");
      return;
    }

    if (this.config.isAllowedNow === false) {
      console.log("[Scheduler] Fora do horário de expediente permitido pelo sistema. Aguardando...");
      return;
    }

    // 2. Busca próximo job com lock atômico
    const jobResponse = await this.api.getNextJob();

    if (!jobResponse.hasJob) {
      // Nenhum job na fila
      return;
    }

    // 3. Executa o job recebido
    console.log(`[Scheduler] Job recebido: ${jobResponse.jobId} (Contrato: ${jobResponse.contractId})`);
    await this.api.sendHeartbeat("busy", jobResponse.jobId, this.jobsProcessedCount);

    try {
      await this.runner.processJob(jobResponse);
      this.jobsProcessedCount++;
    } catch (err) {
      console.error(`[Scheduler] Falha na execução do job ${jobResponse.jobId}:`, err.message);
    } finally {
      await this.api.sendHeartbeat("idle", null, this.jobsProcessedCount);
    }
  }

  /**
   * Para o loop do agendador.
   */
  stop() {
    this.running = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    console.log("[Scheduler] Agendador parado.");
  }
}

export default Scheduler;
