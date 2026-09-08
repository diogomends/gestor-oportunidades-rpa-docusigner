import { authenticateInstance } from "./instance/authenticateInstance.js";
import { getInstanceConfig } from "./instance/getInstanceConfig.js";
import { getNextJob } from "./instance/getNextJob.js";
import { updateJobStatus } from "./instance/updateJobStatus.js";
import { registerHeartbeat } from "./instance/registerHeartbeat.js";
import { downloadContractPdf } from "./instance/downloadContractPdf.js";
import { getAllInstances } from "./instance/getAllInstances.js";
import { getInstanceTelemetry } from "./instance/getInstanceTelemetry.js";
import { streamInstanceTelemetry } from "./instance/streamInstanceTelemetry.js";

/**
 * Fachada DIP (Dependency Inversion Principle) e Barrel para handlers de instância do robô.
 * Re-exporta todos os submódulos atômicos localizados em `./instance/` mantendo 100% de compatibilidade
 * retroativa com os roteadores Express e a suíte de testes.
 *
 * @module controllers/robotInstanceController
 */

export {
  authenticateInstance,
  getInstanceConfig,
  getNextJob,
  updateJobStatus,
  registerHeartbeat,
  downloadContractPdf,
  getAllInstances,
  getInstanceTelemetry,
  streamInstanceTelemetry,
};

/**
 * Objeto padrão da fachada com todos os handlers de instância.
 * @type {{
 *   authenticateInstance: typeof authenticateInstance,
 *   getInstanceConfig: typeof getInstanceConfig,
 *   getNextJob: typeof getNextJob,
 *   updateJobStatus: typeof updateJobStatus,
 *   registerHeartbeat: typeof registerHeartbeat,
 *   downloadContractPdf: typeof downloadContractPdf,
 *   getAllInstances: typeof getAllInstances,
 *   getInstanceTelemetry: typeof getInstanceTelemetry,
 *   streamInstanceTelemetry: typeof streamInstanceTelemetry,
 * }}
 */
export default {
  authenticateInstance,
  getInstanceConfig,
  getNextJob,
  updateJobStatus,
  registerHeartbeat,
  downloadContractPdf,
  getAllInstances,
  getInstanceTelemetry,
  streamInstanceTelemetry,
};
