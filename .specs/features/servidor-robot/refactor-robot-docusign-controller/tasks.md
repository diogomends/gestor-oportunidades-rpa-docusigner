# Tasks — Refatoração Modular do robotDocusignController (SOLID & Atomic Handlers)

## Checklist de Implementação

- [x] **1. Criação dos Handlers Atômicos sob `backend/src/modules/robot-docusign/controllers/docusign/`**
  - [x] 1.1 Criar `enqueueSingleJob.js` (`POST /trigger`) isolando `triggerSchema`.
  - [x] 1.2 Criar `enqueueBatchJobs.js` (`POST /trigger-batch`) isolando `triggerBatchSchema`.
  - [x] 1.3 Criar `getJobStatusById.js` (`GET /status/:jobId`) com tratamento de `ObjectId` e `CastError`.
  - [x] 1.4 Criar `listFilteredJobs.js` (`GET /jobs`) com paginação e filtros dinâmicos.
  - [x] 1.5 Criar `getExecutionMetrics.js` (`GET /metrics`) com agregação de métricas e instâncias.
  - [x] 1.6 Criar `getJobExecutionLogs.js` (`GET /logs/:jobId`) com steps em ordem reversa.
  - [x] 1.7 Criar `getRobotConfiguration.js` (`GET /config`) para leitura de configuração.
  - [x] 1.8 Criar `updateRobotConfiguration.js` (`PUT /config`) isolando `updateConfigSchema` e `encryptText`.
  - [x] 1.9 Criar `testDocusignLogin.js` (`POST /test-login`) isolando `testLoginSchema` e Playwright lifecycle.
  - [x] 1.10 Criar `getPendingJobQueue.js` (`GET /queue`) para consulta de jobs ativos/pendentes.
  - [x] 1.11 Criar `processPendingJobs.js` (`POST /process-pending`) para acionamento do scheduler.
  - [x] 1.12 Criar `syncAllContractsStatus.js` (`POST /sync-status`) para varredura geral de status.
  - [x] 1.13 Criar `streamJobProgressSSE.js` (`GET /jobs/:jobId/stream`) para streaming SSE em tempo real.

- [x] **2. Refatoração da Fachada / Barrel em `robotDocusignController.js`**
  - [x] 2.1 Importar as 13 funções atômicas de `./docusign/*`.
  - [x] 2.2 Re-exportar todas as 13 funções públicas (nomes semânticos + legados) e `export default`.
  - [x] 2.3 Garantir documentação JSDoc completa `@module` e tipagem.

- [x] **3. Validação e Documentação**
  - [x] 3.1 Validar inventário de rotas via `tools/generate-routes-inventory.js --check`.
  - [x] 3.2 Atualizar `.specs/STATE.md` com a decisão arquitetural AD-072 e status de handoff.
  - [x] 3.3 Atualizar `validation.md` e checklist final.
