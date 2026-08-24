import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { sendEnvelope, checkEnvelopeStatus } from "./browser/docusign.js";

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

function getChromium() {
  const playwrightModule = resolvePlaywright();
  return playwrightModule.chromium || playwrightModule.default?.chromium || playwrightModule;
}

/**
 * Executor isolado de tarefas Playwright com controle seguro de lifecycle e limpeza de disco.
 */
export class JobRunner {
  constructor(apiClient, options = {}) {
    this.api = apiClient;
    this.headless = options.headless !== false;
  }

  /**
   * Executa um job específico da fila.
   *
   * @param {Object} job - Payload do job retornado por /api/robot-docusign/instance/next-job
   */
  async processJob(job) {
    const { jobId, contractId, action, pdfUrl, credentials } = job;
    let tempPdfPath = null;
    let browser = null;
    let context = null;

    console.log(`[JobRunner] Iniciando execução do job ${jobId} (Contrato: ${contractId}, Ação: ${action})...`);

    try {
      // 1. Download seguro do PDF se necessário para a ação 'send'
      if (action === "send" && pdfUrl) {
        await this.api.updateJobStatus(jobId, {
          status: "processing",
          step: { name: "download_temp_pdf", status: "running" },
        });

        tempPdfPath = await this.api.downloadPdfToTemp(pdfUrl);

        await this.api.updateJobStatus(jobId, {
          status: "processing",
          step: { name: "download_temp_pdf", status: "success" },
        });
      }

      // 2. Inicialização do navegador Playwright
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

      await this.api.updateJobStatus(jobId, {
        status: "processing",
        step: { name: "launch_browser", status: "success" },
      });

      // 3. Execução da automação
      let result = null;
      if (action === "send") {
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
        result = await checkEnvelopeStatus(page, job.envelopeId, credentials);
        await this.api.updateJobStatus(jobId, {
          status: "completed",
          result,
          step: { name: "docusign_status_check", status: "success" },
        });
      }

      console.log(`[JobRunner] Job ${jobId} finalizado com sucesso!`);
      return { success: true, result };
    } catch (error) {
      console.error(`[JobRunner] Erro no processamento do job ${jobId}:`, error);

      await this.api
        .updateJobStatus(jobId, {
          status: "failed",
          error: error.message,
          step: { name: "execution_error", status: "failed", error: error.message },
        })
        .catch((e) => console.warn(`[JobRunner] Falha ao reportar erro do job: ${e.message}`));

      throw error;
    } finally {
      // 4. Fechamento de recursos e destruição garantida de arquivos temporários do disco
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});

      if (tempPdfPath && fs.existsSync(tempPdfPath)) {
        try {
          fs.unlinkSync(tempPdfPath);
          console.log(`[JobRunner] Arquivo temporário ${tempPdfPath} excluído com sucesso.`);
        } catch (e) {
          console.warn(`[JobRunner] Falha ao excluir arquivo temporário: ${e.message}`);
        }
      }
    }
  }
}

export default JobRunner;
