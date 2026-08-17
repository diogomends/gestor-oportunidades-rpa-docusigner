import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Cliente HTTP para comunicação segura com a API Central do Gestor de Oportunidades.
 */
export class ApiClient {
  constructor(baseUrl, instanceId) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.instanceId = instanceId;
    this.token = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Autentica na API via Chave de API (X-Robot-Key) e armazena o token JWT.
   */
  async authenticate(robotKey) {
    if (!robotKey) {
      throw new Error("Chave de API (robotKey) não fornecida para autenticação.");
    }

    const url = `${this.baseUrl}/api/robot-docusign/instance/auth`;
    const headers = {
      "Content-Type": "application/json",
      "X-Robot-Key": robotKey,
    };

    const payload = {
      instance_id: this.instanceId,
      robot_key: robotKey,
      machine_info: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        app_version: "1.0.0",
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Falha na autenticação HTTP ${response.status}`);
    }

    const data = await response.json();
    this.token = data.token;
    // Expira em ~29 dias para segurança
    this.tokenExpiresAt = Date.now() + 29 * 24 * 60 * 60 * 1000;
    const userDesc = data.user?.nome ? `${data.user.nome} (${data.user.cargo || "Robô"})` : "Service Account";
    console.log(`[API] Autenticado com sucesso via Chave de API como ${userDesc}`);
    return data;
  }

  /**
   * Helper para headers autenticados.
   */
  getHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }

  /**
   * Obtém as configurações de sistema (horários, limites, intervalo de polling).
   */
  async getConfig() {
    const url = `${this.baseUrl}/api/robot-docusign/instance/config`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`Erro ao buscar configurações: HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Busca atomicamente o próximo job atribuído a esta instância.
   */
  async getNextJob() {
    const url = `${this.baseUrl}/api/robot-docusign/instance/next-job?instance_id=${encodeURIComponent(this.instanceId)}`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error(`Erro ao buscar próximo job: HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Atualiza o status e os steps do job.
   */
  async updateJobStatus(jobId, statusPayload) {
    const url = `${this.baseUrl}/api/robot-docusign/instance/job/${jobId}/status`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify({
        instance_id: this.instanceId,
        ...statusPayload,
      }),
    });
    if (!res.ok) {
      throw new Error(`Erro ao atualizar status do job: HTTP ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Envia heartbeat informando estado da máquina.
   */
  async sendHeartbeat(status = "idle", currentJobId = null, jobsCount = 0) {
    const url = `${this.baseUrl}/api/robot-docusign/instance/heartbeat`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          instance_id: this.instanceId,
          status,
          current_job_id: currentJobId,
          jobs_processed_today: jobsCount,
          machine_info: {
            hostname: os.hostname(),
            platform: os.platform(),
          },
        }),
      });
      return await res.json();
    } catch (e) {
      console.warn(`[API] Heartbeat falhou: ${e.message}`);
    }
  }

  /**
   * Baixa o arquivo PDF do contrato para um arquivo temporário no os.tmpdir().
   */
  async downloadPdfToTemp(relativePdfUrl) {
    const fullUrl = `${this.baseUrl}${relativePdfUrl.startsWith("/") ? "" : "/"}${relativePdfUrl}`;
    const res = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Falha ao baixar PDF do servidor: HTTP ${res.status}`);
    }

    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `rpa_contract_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.pdf`);

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(tempFile, buffer);

    console.log(`[API] PDF temporário baixado em: ${tempFile} (${buffer.length} bytes)`);
    return tempFile;
  }
}

export default ApiClient;
