import { enqueueSingleJob, triggerJob } from "./docusign/enqueueSingleJob.js";
import { enqueueBatchJobs, triggerBatch } from "./docusign/enqueueBatchJobs.js";
import { getJobStatusById, getJobStatus } from "./docusign/getJobStatusById.js";
import { listFilteredJobs, listJobs } from "./docusign/listFilteredJobs.js";
import { getExecutionMetrics, getMetrics } from "./docusign/getExecutionMetrics.js";
import { getJobExecutionLogs, getJobLogs } from "./docusign/getJobExecutionLogs.js";
import { getRobotConfiguration, getConfig } from "./docusign/getRobotConfiguration.js";
import { updateRobotConfiguration, updateConfig } from "./docusign/updateRobotConfiguration.js";
import { testDocusignLogin, testLogin } from "./docusign/testDocusignLogin.js";
import { getPendingJobQueue, getQueue } from "./docusign/getPendingJobQueue.js";
import { processPendingJobs, processPending } from "./docusign/processPendingJobs.js";
import { syncAllContractsStatus, syncAllStatuses } from "./docusign/syncAllContractsStatus.js";
import { streamJobProgressSSE, streamJobProgress } from "./docusign/streamJobProgressSSE.js";

/**
 * Fachada DIP (Dependency Inversion Principle) e Barrel para handlers do DocuSign RPA.
 * Re-exporta todos os submódulos atômicos localizados em `./docusign/` mantendo 100% de compatibilidade
 * retroativa com os roteadores Express e a suíte de testes.
 *
 * @module controllers/robotDocusignController
 */

export {
  enqueueSingleJob,
  triggerJob,
  enqueueBatchJobs,
  triggerBatch,
  getJobStatusById,
  getJobStatus,
  listFilteredJobs,
  listJobs,
  getExecutionMetrics,
  getMetrics,
  getJobExecutionLogs,
  getJobLogs,
  getRobotConfiguration,
  getConfig,
  updateRobotConfiguration,
  updateConfig,
  testDocusignLogin,
  testLogin,
  getPendingJobQueue,
  getQueue,
  processPendingJobs,
  processPending,
  syncAllContractsStatus,
  syncAllStatuses,
  streamJobProgressSSE,
  streamJobProgress,
};

/**
 * Objeto padrão da fachada com todos os handlers do DocuSign.
 * @type {{
 *   enqueueSingleJob: typeof enqueueSingleJob,
 *   triggerJob: typeof triggerJob,
 *   enqueueBatchJobs: typeof enqueueBatchJobs,
 *   triggerBatch: typeof triggerBatch,
 *   getJobStatusById: typeof getJobStatusById,
 *   getJobStatus: typeof getJobStatus,
 *   listFilteredJobs: typeof listFilteredJobs,
 *   listJobs: typeof listJobs,
 *   getExecutionMetrics: typeof getExecutionMetrics,
 *   getMetrics: typeof getMetrics,
 *   getJobExecutionLogs: typeof getJobExecutionLogs,
 *   getJobLogs: typeof getJobLogs,
 *   getRobotConfiguration: typeof getRobotConfiguration,
 *   getConfig: typeof getConfig,
 *   updateRobotConfiguration: typeof updateRobotConfiguration,
 *   updateConfig: typeof updateConfig,
 *   testDocusignLogin: typeof testDocusignLogin,
 *   testLogin: typeof testLogin,
 *   getPendingJobQueue: typeof getPendingJobQueue,
 *   getQueue: typeof getQueue,
 *   processPendingJobs: typeof processPendingJobs,
 *   processPending: typeof processPending,
 *   syncAllContractsStatus: typeof syncAllContractsStatus,
 *   syncAllStatuses: typeof syncAllStatuses,
 *   streamJobProgressSSE: typeof streamJobProgressSSE,
 *   streamJobProgress: typeof streamJobProgress,
 * }}
 */
export default {
  enqueueSingleJob,
  triggerJob,
  enqueueBatchJobs,
  triggerBatch,
  getJobStatusById,
  getJobStatus,
  listFilteredJobs,
  listJobs,
  getExecutionMetrics,
  getMetrics,
  getJobExecutionLogs,
  getJobLogs,
  getRobotConfiguration,
  getConfig,
  updateRobotConfiguration,
  updateConfig,
  testDocusignLogin,
  testLogin,
  getPendingJobQueue,
  getQueue,
  processPendingJobs,
  processPending,
  syncAllContractsStatus,
  syncAllStatuses,
  streamJobProgressSSE,
  streamJobProgress,
};
