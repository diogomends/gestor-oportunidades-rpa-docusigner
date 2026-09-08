# Tasks: Refatoração Modular do robotInstanceController (SOLID & Atomic Handlers)

## Implementation Tasks

### T1: Criação dos Handlers de Autenticação e Configuração
- [x] **T1.1** Criar `backend/src/modules/robot-docusign/controllers/instance/authenticateInstance.js` isolando `authSchema`, `parseRoleOr400` e `authenticateInstance` com JSDoc completo.
- [x] **T1.2** Criar `backend/src/modules/robot-docusign/controllers/instance/getInstanceConfig.js` isolando `getInstanceConfig` com JSDoc completo.

### T2: Criação dos Handlers de Despacho e Status de Jobs
- [x] **T2.1** Criar `backend/src/modules/robot-docusign/controllers/instance/getNextJob.js` isolando `nextJobSchema`, helper de signatários e `getNextJob` com JSDoc completo.
- [x] **T2.2** Criar `backend/src/modules/robot-docusign/controllers/instance/updateJobStatus.js` isolando `updateStatusSchema`, validação anti-fantasma UUID v4 e `updateJobStatus` com JSDoc completo.

### T3: Criação dos Handlers de Heartbeat, Telemetria e Download
- [x] **T3.1** Criar `backend/src/modules/robot-docusign/controllers/instance/registerHeartbeat.js` isolando `heartbeatSchema` e `registerHeartbeat` com JSDoc completo.
- [x] **T3.2** Criar `backend/src/modules/robot-docusign/controllers/instance/downloadContractPdf.js` isolando `downloadContractPdf` (disco multi-path + fallback HTTP) com JSDoc completo.
- [x] **T3.3** Criar `backend/src/modules/robot-docusign/controllers/instance/getAllInstances.js` isolando `getAllInstances` com cálculo de `alive` e agregação por role.
- [x] **T3.4** Criar `backend/src/modules/robot-docusign/controllers/instance/getInstanceTelemetry.js` isolando `getInstanceTelemetry` (polling).
- [x] **T3.5** Criar `backend/src/modules/robot-docusign/controllers/instance/streamInstanceTelemetry.js` isolando `streamInstanceTelemetry` (SSE stream).

### T4: Montagem da Fachada (Barrel) e Validação de Integridade
- [x] **T4.1** Refatorar `backend/src/modules/robot-docusign/controllers/robotInstanceController.js` para atuar como barrel/fachada re-exportando os 9 handlers e o default export.
- [x] **T4.2** Validar conformidade estrutural e inventário de rotas via `make routes-inventory-check`.
- [x] **T4.3** Criar `validation.md` e registrar decisão arquitetural em `STATE.md`.
