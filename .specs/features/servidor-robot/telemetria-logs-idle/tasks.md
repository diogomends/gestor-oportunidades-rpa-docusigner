# Tasks: Telemetria de Logs em Modo Ocioso (Heartbeat & Scheduler Idle Logs)

## Implementation Tasks

### T1: Robô standalone (`robot/src/`)
- [x] **T1.1** `scheduler.js`: buffer local `telemetryBuffer: string[]` (cap 50 FIFO) + helper `pushTelemetry(msg)` com prefixo `[HH:mm:ss] [Scheduler]`; hookar os 4 ramos ociosos de `tick()` (`disabled`, `outside_hours`, `no_pending_jobs`/`reason`, `contract_missing_pdf_or_email`) + erros de ciclo; passar buffer no timer 30s e nas transições `busy→idle`.
- [x] **T1.2** `api-client.js`: `sendHeartbeat(status, currentJobId, jobsCount, telemetryLogs = [])` — fatia 20 primeiras, cada uma truncada em 500 chars; retorna `{ ok, sent }`; esvazia buffer do chamador SOMENTE em 2xx (limpeza feita pelo `scheduler.js`, não pelo client).

### T2: Backend (`backend/src/modules/robot-docusign/`)
- [x] **T2.1** `utils/telemetryBuffer.js` (novo, ~40L): `Map` + `pushLogs(instanceId, arr)` (FIFO cap 100) + `getLogs(instanceId)` + `pruneIdle(now, 10min)` + JSDoc.
- [x] **T2.2** `controllers/robotInstanceController.js`: estender `heartbeatSchema` com `telemetryLogs: z.array(z.string().max(500)).max(20).optional()`; em `registerHeartbeat`, após `findOneAndUpdate`, chamar `pushLogs` + `robotEvents.emit("instance:telemetry", { instanceId, status, lastHeartbeat, logs: novosLogs })`.
- [x] **T2.3** `controllers/robotInstanceController.js` (ou novo `streamInstanceTelemetry` em `robotDocusignController.js` ao lado de `streamJobProgress`): SSE `text/event-stream` + handshake buffer + listener `instance:telemetry` filtrado por `instanceId` + `: ping` 15s + `cleanup` em `req close` + suporte `?token=`; `getInstanceTelemetry` (JSON fallback); estender `getAllInstances` com `?includeLogs=true`.
- [x] **T2.4** `routes.js`: `GET /instances/:instanceId/stream` (`protect`), `GET /instances/:instanceId/telemetry` (`protect+authorize("admin")`); `GET /instances` existente ganha query `includeLogs`.
- [x] **T2.5** `seletorApiRobot/orchestratorEvents.js`: documentar novo evento `instance:telemetry` ao lado de `job:progress` (sem mudar API existente).

### T3: Testes + docs
- [x] **T3.1** `tests/robot/scheduler-telemetry.test.js`: buffer capta `no_pending_jobs`, flush esvazia em 2xx e retém em falha, cap 50 FIFO.
- [x] **T3.2** `tests/backend/controllers/robotInstance-telemetry.test.js`: Zod aceita/estoura limites, RingBuffer FIFO 100, SSE handshake contém buffer, evento ao vivo filtrado por instanceId.
- [x] **T3.3** `validation.md` + `routes-inventory.md` + `STATE.md` (AD novo).
