import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { sendEnvelope, checkEnvelopeStatus } from "./browser/docusign.js";
import logger from "./utils/logger.js";

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

/**
 * Carrega o Playwright dinamicamente a partir do diretório do executável (.exe)
 * ou do ambiente de execução atual, garantindo compatibilidade com o snapshot virtual do @yao-pkg/pkg.
 * @returns {any} Módulo Playwright resolvido (playwright ou playwright-core).
 */
function resolvePlaywright() {
  const candidateDirs = [
    path.dirname(process.execPath),
    process.cwd(),
    path.resolve("."),
    path.resolve(path.dirname(process.execPath), ".."),
  ];

  for (const dir of candidateDirs) {
    const coreIndex = path.join(dir, "node_modules", "playwright-core", "index.js");
    const playwrightIndex = path.join(dir, "node_modules", "playwright", "index.js");

    if (fs.existsSync(coreIndex)) {
      try {
        const extRequire = createRequire(path.join(dir, "package.json"));
        return extRequire(coreIndex);
      } catch (e) {
        console.warn(`[JobRunner] Warning: failed requiring ${coreIndex}:`, e.message);
      }
    }

    if (fs.existsSync(playwrightIndex)) {
      try {
        const extRequire = createRequire(path.join(dir, "package.json"));
        return extRequire(playwrightIndex);
      } catch (e) {
        console.warn(`[JobRunner] Warning: failed requiring ${playwrightIndex}:`, e.message);
      }
    }
  }

  try {
    const extRequire = createRequire(path.join(process.cwd(), "package.json"));
    return extRequire("playwright-core");
  } catch (_) {
    try {
      const extRequire = createRequire(path.join(process.cwd(), "package.json"));
      return extRequire("playwright");
    } catch (err) {
      console.error("[JobRunner] Fatal: failed to resolve 'playwright' or 'playwright-core' module.", err);
      throw err;
    }
  }
}

/**
 * Obtém a instância Chromium do Playwright resolvido.
 * @returns {import('playwright').Chromium} Objeto chromium para launch.
 */
function getChromium() {
  const playwrightModule = resolvePlaywright();
  return playwrightModule.chromium || playwrightModule.default?.chromium || playwrightModule;
}

/**
 * Executor isolado de tarefas Playwright com controle seguro de lifecycle e limpeza de disco.
 */
export class JobRunner {
  /**
   * Cria uma instância do JobRunner.
   * @param {import('./api-client.js').ApiClient} apiClient - Cliente da API central.
   * @param {Object} [options={}] - Opções de execução.
   * @param {boolean} [options.headless=true] - Se o navegador deve rodar em modo headless.
   */
  constructor(apiClient, options = {}) {
    this.api = apiClient;
    this.headless = options.headless !== false;
  }

  /**
   * Executa um job específico da fila.
   * @param {Object} job - Payload do job retornado por /api/robot-docusign/instance/next-job.
   * @param {string} job.jobId - Identificador do job.
   * @param {string} job.contractId - Identificador do contrato.
   * @param {string} job.action - Ação a executar (send | status).
   * @param {string} [job.pdfUrl] - URL relativa do PDF (quando action=send).
   * @param {Object} job.credentials - Credenciais DocuSign para autenticação.
   * @returns {Promise<{success: boolean, result: any}>} Resultado da execução.
   */
  async processJob(job) {
    const { jobId, contractId, action, pdfUrl, credentials } = job;
    let tempPdfPath = null;
    let browser = null;
    let context = null;

    logger.step("JobRunner", `Iniciando execução do job ${jobId} (Contrato: ${contractId}, Ação: ${action})...`);

    try {
      // 1. Download seguro do PDF se necessário para a ação 'send'
      if (action === "send" && pdfUrl) {
        logger.step("JobRunner", `Baixando PDF do contrato via API central (${pdfUrl})...`);
        await this.api.updateJobStatus(jobId, {
          status: "processing",
          step: { name: "download_temp_pdf", status: "running" },
        });

        tempPdfPath = await this.api.downloadPdfToTemp(pdfUrl);
        logger.success("JobRunner", `PDF baixado com sucesso em arquivo temporário: ${tempPdfPath}`);

        await this.api.updateJobStatus(jobId, {
          status: "processing",
          step: { name: "download_temp_pdf", status: "success" },
        });
      }

      // 2. Inicialização do navegador Playwright
      logger.step("JobRunner", `Inicializando navegador Playwright (Modo: ${this.headless ? "Headless" : "Headed"})...`);
      await this.api.updateJobStatus(jobId, {
        status: "processing",
        step: { name: "launch_browser", status: "running" },
      });

      const chromium = getChromium();
      browser = await chromium.launch({
        headless: this.headless,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-blink-features=AutomationControlled",
        ],
      });

      context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        viewport: { width: 1366, height: 768 },
      });

      const page = await context.newPage();
      logger.success("JobRunner", "Navegador Playwright inicializado com sucesso.");

      await this.api.updateJobStatus(jobId, {
        status: "processing",
        step: { name: "launch_browser", status: "success" },
      });

      // 3. Execução da automação
      let result = null;
      if (action === "send") {
        logger.step("JobRunner", "Executando automação de envio de contrato na DocuSign...");
        await this.api.updateJobStatus(jobId, {
          status: "processing",
          step: { name: "docusign_send", status: "running" },
        });

        result = await sendEnvelope(page, {
          recipientName: job.recipientName,
          recipientEmail: job.recipientEmail,
          subject: job.subject,
          message: job.message,
          pdfPath: tempPdfPath,
          credentials,
        });

        await this.api.updateJobStatus(jobId, {
          status: "completed",
          envelopeId: result.envelopeId,
          result,
          step: { name: "docusign_send", status: "success" },
        });
      } else if (action === "status") {
        logger.step("JobRunner", `Consultando status do envelope ${job.envelopeId}...`);
        result = await checkEnvelopeStatus(page, job.envelopeId, credentials);
        await this.api.updateJobStatus(jobId, {
          status: "completed",
          result,
          step: { name: "docusign_status_check", status: "success" },
        });
      }

      logger.success("JobRunner", `Job ${jobId} finalizado com sucesso!`);
      return { success: true, result };
    } catch (error) {
      logger.error("JobRunner", `Falha no processamento do job ${jobId}: ${error.message}`);

      await this.api
        .updateJobStatus(jobId, {
          status: "failed",
          error: error.message,
          step: { name: "execution_error", status: "failed", error: error.message },
        })
        .catch((e) => logger.warn("JobRunner", `Falha ao reportar erro do job: ${e.message}`));

      throw error;
    } finally {
      // 4. Fechamento de recursos e destruição garantida de arquivos temporários do disco
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});

      if (tempPdfPath && fs.existsSync(tempPdfPath)) {
        try {
          fs.unlinkSync(tempPdfPath);
          logger.step("JobRunner", `Arquivo temporário excluído com sucesso: ${tempPdfPath}`);
        } catch (e) {
          logger.warn("JobRunner", `Falha ao excluir arquivo temporário: ${e.message}`);
        }
      }
    }
  }
}

export default JobRunner;
