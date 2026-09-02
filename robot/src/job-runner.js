import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { sendEnvelope, checkEnvelopeStatus, fetchAgreementsByRepresentative } from "./browser/docusign.js";
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
   * @param {string} [options.sessionFilePath] - Caminho do arquivo storageState de persistência da sessão.
   */
  constructor(apiClient, options = {}) {
    this.api = apiClient;
    this.headless = options.headless !== false;
    this.role = options.role || process.env.ROBOT_ROLE || "all";
    // Mapa de ações permitidas por papel (dual-robot)
    const ROLE_ACTIONS = {
      query: ["status", "query_agreements", "reports", "download"],
      update: ["send", "resend"],
      all: ["send", "status", "download", "resend", "reports", "query_agreements"],
    };
    this.allowedActions = ROLE_ACTIONS[this.role] || ROLE_ACTIONS.all;
    this.sessionFilePath =
      options.sessionFilePath ||
      options.sessionPath ||
      process.env.DOCUSIGN_SESSION_PATH ||
      path.resolve(process.cwd(), this.role === "query" ? "session-query.json" : this.role === "update" ? "session-update.json" : "session-docusign.json");
    // ponytail: injeção para teste (evita chromium real)
    this._getChromium = options.chromiumFactory || getChromium;
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
    const { jobId, contractId, action, pdfUrl, recipientEmail, credentials } = job;
    // Guard: rejeita action incompatível com role antes de chromium.launch (ponytail)
    if (!this.allowedActions.includes(action)) {
      const msg = `Ação '${action}' não permitida para role '${this.role}' (permitidas: ${this.allowedActions.join(",")})`;
      logger.error("JobRunner", msg);
      await this.api.updateJobStatus(jobId, { status: "failed", error: msg, step: { name: "role_guard", status: "failed", error: msg } }).catch(() => {});
      throw new Error(msg);
    }
    let tempPdfPath = null;
    let browser = null;
    let context = null;
    // ponytail: coleta cronológica para sumário invertido (headless=false vê recente no topo)
    const summarySteps = [];
    const trackStep = (s) => summarySteps.push({ ...s, timestamp: new Date() });
    const logSummary = () => {
      const ordered = [...(summarySteps || [])].reverse();
      logger.info("JobRunner", "— Resumo (recente primeiro) —");
      for (const s of ordered) {
        const icon = s.status === "success" ? "✓" : s.status === "failed" ? "✗" : "→";
        logger.info("JobRunner", `  ${icon} ${s.name} [${s.status}]`);
      }
    };

    logger.step("JobRunner", `Iniciando execução do job ${jobId} (Contrato: ${contractId}, Ação: ${action})...`);

    try {
      // 1. Validação preventiva antes de abrir o navegador (economiza Playwright + download)
      if (action === "send") {
        if (!pdfUrl || (typeof pdfUrl === "string" && pdfUrl.trim().length === 0)) {
          throw new Error("Contrato sem documento PDF anexado ou sem e-mail do destinatário.");
        }
        // ponytail: valida e-mail também no robô local para alinhar com backend (getNextJob)
        const emailOk = typeof recipientEmail === "string" && recipientEmail.trim().length > 0;
        // Se payload não trouxe recipientEmail mas é elegível, o backend já teria barrado; aqui bloqueia vazio explícito
        if (recipientEmail !== undefined && !emailOk) {
          throw new Error("Contrato sem documento PDF anexado ou sem e-mail do destinatário.");
        }

        logger.step("JobRunner", `Baixando PDF do contrato via API central (${pdfUrl})...`);
        trackStep({ name: "download_temp_pdf", status: "running" });
        await this.api.updateJobStatus(jobId, {
          status: "processing",
          step: { name: "download_temp_pdf", status: "running" },
        });

        tempPdfPath = await this.api.downloadPdfToTemp(pdfUrl);
        logger.success("JobRunner", `PDF baixado com sucesso em arquivo temporário: ${tempPdfPath}`);

        trackStep({ name: "download_temp_pdf", status: "success" });
        await this.api.updateJobStatus(jobId, {
          status: "processing",
          step: { name: "download_temp_pdf", status: "success" },
        });
      }

      // 2. Inicialização do navegador Playwright
      logger.step("JobRunner", `Inicializando navegador Playwright (Modo: ${this.headless ? "Headless" : "Headed"})...`);
      trackStep({ name: "launch_browser", status: "running" });
      await this.api.updateJobStatus(jobId, {
        status: "processing",
        step: { name: "launch_browser", status: "running" },
      });

      const chromium = this._getChromium();
      browser = await chromium.launch({
        headless: this.headless,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-blink-features=AutomationControlled",
        ],
      });

      const contextOptions = {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        viewport: { width: 1366, height: 768 },
      };

      if (this.sessionFilePath) {
        try {
          const dir = path.dirname(this.sessionFilePath);
          if (dir && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        } catch (dirErr) {
          logger.warn("JobRunner", `Não foi possível criar o diretório de sessão '${path.dirname(this.sessionFilePath)}': ${dirErr.message}`);
        }
      }

      if (this.sessionFilePath && fs.existsSync(this.sessionFilePath)) {
        logger.step("JobRunner", `Carregando sessão persistida (storageState) de: ${this.sessionFilePath}`);
        contextOptions.storageState = this.sessionFilePath;
      }

      try {
        context = await browser.newContext(contextOptions);
      } catch (ctxErr) {
        if (contextOptions.storageState) {
          logger.warn("JobRunner", `Falha ao instanciar contexto com storageState corrompido (${ctxErr.message}). Criando novo contexto limpo...`);
          try {
            fs.unlinkSync(this.sessionFilePath);
          } catch (_) {}
          delete contextOptions.storageState;
          context = await browser.newContext(contextOptions);
        } else {
          throw ctxErr;
        }
      }

      const page = await context.newPage();
      logger.success("JobRunner", "Navegador Playwright inicializado com sucesso.");

      trackStep({ name: "launch_browser", status: "success" });
      await this.api.updateJobStatus(jobId, {
        status: "processing",
        step: { name: "launch_browser", status: "success" },
      });

      // 3. Execução da automação
      let result = null;
      if (action === "send") {
        logger.step("JobRunner", "Executando automação de envio de contrato na DocuSign...");
        trackStep({ name: "docusign_send", status: "running" });
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
          sessionPath: this.sessionFilePath,
        });

        trackStep({ name: "docusign_send", status: "success" });
        await this.api.updateJobStatus(jobId, {
          status: "completed",
          envelopeId: result.envelopeId,
          result,
          step: { name: "docusign_send", status: "success" },
        });
      } else if (action === "status") {
        logger.step("JobRunner", `Consultando status do envelope ${job.envelopeId}...`);
        trackStep({ name: "docusign_status_check", status: "running" });
        result = await checkEnvelopeStatus(page, job.envelopeId, credentials, {
          sessionPath: this.sessionFilePath,
        });
        trackStep({ name: "docusign_status_check", status: "success" });
        await this.api.updateJobStatus(jobId, {
          status: "completed",
          result,
          step: { name: "docusign_status_check", status: "success" },
        });
      } else if (action === "query_agreements") {
        logger.step("JobRunner", `Consultando acordos para representante: ${job.repName || job.representativeName || "Todos"}...`);
        trackStep({ name: "query_agreements", status: "running" });
        await this.api.updateJobStatus(jobId, {
          status: "processing",
          step: { name: "query_agreements", status: "running" },
        });

        result = await fetchAgreementsByRepresentative(page, {
          repName: job.repName || job.representativeName || "",
          daysBack: job.daysBack || 5,
          credentials,
          sessionPath: this.sessionFilePath,
        });

        trackStep({ name: "query_agreements", status: "success" });
        await this.api.updateJobStatus(jobId, {
          status: "completed",
          result,
          step: { name: "query_agreements", status: "success" },
        });
      }

      logger.success("JobRunner", `Job ${jobId} finalizado com sucesso!`);
      logSummary();
      return { success: true, result };
    } catch (error) {
      logger.error("JobRunner", `Falha no processamento do job ${jobId}: ${error.message}`);
      trackStep({ name: "execution_error", status: "failed" });
      logSummary();

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
