# Feature Tasks: Segregação de Dois Robôs (Consulta e Atualização)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/robot/dois-robos-consulta-atualizacao/spec.md`  
**Status**: Completed

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| :--- | :--- | :--- | :--- | :--- |
| Model / Schema | regression | Schema validation, conditional required (`function`) and index correctness | `tests/backend/regression/*.test.js` | `npm run test:backend` |
| Controller / API | regression | 1:1 AC mapping for role filtering, batch reconciliation, metrics, 400 on invalid role | `tests/backend/regression/*.test.js` | `npm run test:backend` |
| Client Config / Runner | regression | Verification of role parsing, session resolution, execution branch, guard before launch | `tests/robot/regression/*.test.js` | `npm run test:robot` |
| Build Pipeline | none | Artifact existence and integrity validation (build gate) | `robot/build/*.js` | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| :--- | :--- | :--- |
| Quick | After tasks with regression tests only | `npm run test:backend` (ou `npm run test:robot`) |
| Full | After controller/integration changes | `npm test` |
| Build | After phase completion or build pipeline tasks | `npm run build:robot` (verifica `dist/robot-query-N/` e `dist/robot-update-N/`) |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Database & Model Foundation

```
T1 -> T2
```

### Phase 2: Backend Orchestration, Filtering & Reconciliation

```
T3 -> T4 -> T5
```

### Phase 3: Robot Client Configuration & Segregation

```
T6 -> T7 -> T8
```

### Phase 4: Build Pipeline & Automation

```
T9 -> T10
```

### Phase 5: Docs & Validation

```
T11
```

---

## Task Breakdown

### Phase 1: Database & Model Foundation

### T1: Modelagem do Campo Role em RobotInstance

**What**: Adicionar campo `role` (`"query" | "update" | "all"`) com default `"all"` no schema do Mongoose.  
**Where**: `backend/src/modules/robot-docusign/models/RobotInstance.js`  
**Depends on**: None  
**Reuses**: Padrões existentes do Mongoose em `RobotInstance.js`  
**Requirement**: ROB2-01  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Campo `role` adicionado ao schema com enum `["query", "update", "all"]`, default `"all"` e `index:true`.
- [x] JSDoc completo adicionado ao typedef e export do model.
- [x] Gate check passes: `npm run test:backend` (valida enum/default)

**Tests**: regression  
**Gate**: quick  
**Commit**: `feat(models): add role field to RobotInstance schema`

---

### T2: Indexação, Tipagem de Actions e Contract Opcional em RobotJob

**What**: Revisar schema de `RobotJob`, estender enum `action` para incluir `query_agreements`, permitir `contract_id` / `contractId` opcional para ações globais (`query_agreements`, `reports`) e otimizar índices compostos.  
**Where**: `backend/src/modules/robot-docusign/models/RobotJob.js`  
**Depends on**: T1  
**Reuses**: Índices existentes no Mongoose  
**Requirement**: ROB2-01, ROB2-09  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Enum `action` estendido para `["send","status","download","resend","reports","query_agreements"]`.
- [x] `contract_id` e `contractId` com `required: function() { return !["query_agreements","reports"].includes(this.action) }` (não `required:false` estático) + validador que rejeita `contract_id` ausente para `send/status/download/resend`.
- [x] Índices compostos `{ status: 1, action: 1, lock_expires_at: 1, createdAt: 1 }` verificados/adicionados (cobrir `findOneAndUpdate` de `getNextJob` com filtro por `action` + lock); índice parcial opcional `{ "documents.originalUrl": 1 }` documentado como future.
- [x] JSDoc completo atualizado.
- [x] Gate check passes: `npm run test:backend` (valida conditional required + enum)

**Tests**: regression  
**Gate**: quick  
**Commit**: `feat(models): optimize action indexing and optional contract support in RobotJob`

---

### Phase 2: Backend Orchestration, Filtering & Reconciliation

### T3: Filtragem de Jobs por Role em getNextJob e Schemas Zod

**What**: Atualizar o método `getNextJob` para entregar apenas jobs correspondentes ao `role` da instância solicitante com mapeamento explícito sem órfãos, e atualizar schemas Zod de disparo manual.  
**Where**: `backend/src/modules/robot-docusign/controllers/robotInstanceController.js` + `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`  
**Depends on**: T2  
**Reuses**: `robotInstanceController.js` logic; `triggerSchema`  
**Requirement**: ROB2-02, ROB2-09  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Se `instance.role === 'query'`, busca apenas jobs com `action` em `['query_agreements', 'status', 'reports', 'download']`.
- [x] Se `instance.role === 'update'`, busca apenas jobs com `action` em `['send', 'resend']`.
- [x] Se `instance.role === 'all'` ou indefinido, mantém comportamento de retornar qualquer job pendente (retrocompat).
- [x] `getNextJob` não falha caso `job.contract_id` seja nulo para `query_agreements`/`reports` (entrega payload de varredura global sem `Contract.findById(null)`); `robotScheduler` ignora `query_agreements`.
- [x] `triggerSchema` e `triggerBatchSchema` em `robotDocusignController.js` aceitam `query_agreements` e liberam `contractId` opcional apenas para `query_agreements`/`reports` (`if (!targetContractId && !["reports","query_agreements"].includes(action)) 400`).
- [x] `role` inválido retorna `400`.
- [x] Testes de regressão cobrem todos os cenários de filtro + fallback `all` + job sem contrato + 400 role inválido.
- [x] Gate check passes: `npm run test:backend`

**Tests**: regression  
**Gate**: quick  
**Commit**: `feat(controller): filter pending jobs by instance role in getNextJob`

---

### T4: Registro de Role na Autenticação, Heartbeat e Métricas de Frota

**What**: Persistir e atualizar o `role` da instância durante o handshake de autenticação e heartbeat, e expor contagem de instâncias agregadas por role em métricas.  
**Where**: `backend/src/modules/robot-docusign/controllers/robotInstanceController.js` + `backend/src/modules/robot-docusign/controllers/robotDocusignController.js` + `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js`  
**Depends on**: T3  
**Reuses**: Rotas de instância do Express; schemas zod existentes  
**Requirement**: ROB2-02, ROB2-09  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `authSchema` e `heartbeatSchema` aceitam `role` opcional (`query|update|all`, default `all`); `X-Robot-Key` path lê `role` de `req.body.role` direto (bypass Zod documentado).
- [x] `authenticateInstance` (`POST /instance/auth` via `X-Robot-Key` ou `email/senha`) persiste `role` em `RobotInstance` (upsert) sem colidir com `JWT.role` (cargo); `role` inválido → `400`.
- [x] `registerHeartbeat` (`POST /instance/heartbeat`) atualiza `role` quando enviado (upsert `last_heartbeat` + `role`).
- [x] `getAllInstances` e `getMetrics` expõem `instances_by_role: { query, update, all, total }` + cada instância expõe `role`.
- [x] JSDoc completo atualizado.
- [x] Gate check passes: `npm run test:backend`

**Tests**: regression  
**Gate**: quick  
**Commit**: `feat(controller): capture instance role on auth and expose fleet metrics`

---

### T5: Enfileiramento em StatusSyncScheduler e Conciliação em Lote no UpdateJobStatus

**What**: Implementar criação periódica de `RobotJob(action: "query_agreements")` pelo scheduler e processamento em lote de `result.envelopes` no retorno do job pelo robô query.  
**Where**: `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js` + `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`  
**Depends on**: T4  
**Reuses**: `syncContractStatus`, `buildDownloadPath` e `contractSyncService.js`  
**Requirement**: ROB2-08  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `statusSyncScheduler.js` enfileira `RobotJob` com `action: "query_agreements"` (sem `contract_id`) quando `mode === "robot"` **e** houver query robot conectado (`RobotInstance.exists({role:{$in:["query","all"]}, last_heartbeat:{$gt: now-60s}})`) **e** não houver job de query pendente/processing (`RobotJob.exists({action:"query_agreements", status:{$in:["pending","processing"]}})`); caso contrário fallback para `executeWithBrowser`; intervalo `5` min; `isRunning` guard mantido.
- [x] `updateJobStatus` (`PATCH /instance/job/:jobId/status`) detecta `job.action === "query_agreements"` concluído com `result.envelopes` (validado Zod `array`) e executa conciliação em lote contra contratos ativos (`Contract.find({ status: { $in: ["enviado", "gerado"] } })`), `syncContractStatus` + auto-download de PDFs assinados; `robotScheduler` não reprocessa batch.
- [x] Atualização de contratos para `assinado`, preenchimento de `envelopeId` e agendamento de download automático realizados para contratos concluídos.
- [x] Testes de regressão cobrem enfileiramento idempotente, fallback sem query robot, e conciliação em lote a partir do resultado do job.
- [x] Gate check passes: `npm run test:backend`

**Tests**: regression  
**Gate**: quick  
**Commit**: `feat(scheduler): handle batch agreement reconciliation on query job completion`

---

### Phase 3: Robot Client Configuration & Segregation

### T6: Suporte a ROBOT_ROLE e Sessões Isoladas no Config + ApiClient

**What**: Adicionar resolução de `ROBOT_ROLE` e caminho de sessão específico por papel no robô standalone e propagar `role` ao backend.  
**Where**: `robot/src/config.js` + `robot/src/api-client.js`  
**Depends on**: T5  
**Reuses**: `config.js` loader; `ApiClient` existente  
**Requirement**: ROB2-03  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `loadConfig` suporta `ROBOT_ROLE` / `--role` (`query` ou `update` ou `all`), atribuindo arquivos de sessão dedicados (`session-query.json` / `session-update.json`, fallback `session-docusign.json` para `all`).
- [x] `ApiClient.authenticate()` e `ApiClient.sendHeartbeat()` enviam `role` no payload (`instance_id` + `role`).
- [x] `ApiClient.getNextJob()` propaga `role` quando disponível.
- [x] JSDoc completo atualizado.
- [x] Gate check passes: `npm run test:robot`

**Tests**: regression  
**Gate**: quick  
**Commit**: `feat(robot-config): support ROBOT_ROLE and dedicated session storage paths`

---

### T7: Isolamento de Execução de Rotinas no JobRunner

**What**: Desacoplar a execução de rotinas de envio e consulta no JobRunner, validando permissão de execução por papel e tratando execução de `query_agreements`.  
**Where**: `robot/src/job-runner.js`  
**Depends on**: T6  
**Reuses**: `job-runner.js` pipeline  
**Requirement**: ROB2-05  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] JobRunner recebe `role` no construtor (`options.role` / `ROBOT_ROLE`) e expõe `allowedActions` (`query=[status,query_agreements,reports,download]`, `update=[send,resend]`, `all=todos`).
- [x] Guard clause rejeita `action` incompatível com `role` antes de `chromium.launch`.
- [x] Métodos de execução desacoplados (`handleSend`/`handleQuery`) respeitando SOLID/SRP.
- [x] `handleQuery` suporta execução de `query_agreements` com retorno de array estruturado `{ envelopes: [...] }` para o backend via `updateJobStatus`.
- [x] Testes de regressão cobrem execução e bloqueio de ações não compatíveis por role.
- [x] Gate check passes: `npm run test:robot`

**Tests**: regression  
**Gate**: quick  
**Commit**: `refactor(job-runner): isolate query and update execution pipelines`

---

### T8: Entrypoints Físicos Dedicados de Inicialização

**What**: Criar entrypoints físicos especializados (wrappers 3L) e manter `main.js` como dispatcher.  
**Where**: `robot/src/main-query.js` + `robot/src/main-update.js` + `robot/src/main.js` (dispatcher)  
**Depends on**: T7  
**Reuses**: `main.js` bootstrap; `config.js` role resolver  
**Requirement**: ROB2-04  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `main-query.js` wrapper: `process.env.ROBOT_ROLE="query"; await import("./main.js")` (ponytail: evita duplicação de bootstrap).
- [x] `main-update.js` wrapper: `process.env.ROBOT_ROLE="update"; await import("./main.js")`.
- [x] `main.js` detecta flag CLI `--role` ou variável `ROBOT_ROLE` e inicializa `JobRunner` com `role` + `sessionFilePath` correspondente.
- [x] JSDoc completo atualizado.
- [x] Gate check passes: `npm run test:robot`

**Tests**: regression  
**Gate**: quick  
**Commit**: `feat(robot): implement specialized bootstrap entrypoints by role`

---

### Phase 4: Build Pipeline & Automation

### T9: Parametrização do Pipeline de Build no build.js e Customização de Scripts

**What**: Adaptar o pipeline de empacotamento para gerar executáveis distintos para cada papel com scripts `run.bat` e documentação contextualizados.  
**Where**: `robot/build/build.js`  
**Depends on**: T8  
**Reuses**: Pipeline esbuild + bytenode + pkg existente  
**Requirement**: ROB2-06  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `parseArgs` aceita `--role=query|update|all` (default `all` = ambos).
- [x] `build.js` gera matriz `ROBOT_API_KEY_N × role` → `dist/robot-query-<N>/` e `dist/robot-update-<N>/` (ex: `robot-query-1.exe`, `robot-update-1.exe`); `all` gera ambos.
- [x] `defineArgs` injeta `process.env.ROBOT_ROLE` no bundle esbuild para embutir papel no `.exe`.
- [x] Entry correto por papel (`main-query.js` vs `main-update.js` vs `main.js` dispatcher).
- [x] Scripts `run.bat` gerados com título de terminal descritivo por papel (ex: `[DocuSign RPA] - Consulta #N` vs `[DocuSign RPA] - Atualização #N`).
- [x] JSDoc completo atualizado.
- [x] Gate check passes: build gate

**Tests**: none  
**Gate**: build  
**Commit**: `feat(build): support role-targeted binary compilation for query and update`

---

### T10: Configuração de Scripts NPM e Makefile

**What**: Adicionar scripts de automação de build para geração dos robôs especializados.  
**Where**: `robot/package.json` + `Makefile`  
**Depends on**: T9  
**Reuses**: Scripts existentes no `package.json`; target `build-robot` do Makefile  
**Requirement**: ROB2-07  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `robot/package.json` adiciona scripts `build:robot:query`, `build:robot:update` e `build:robot:all` (repasse de `--role` para `build.js`).
- [x] `Makefile` target `build-robot` aceita `ROLE=query|update|all` (ex: `make build-robot ROLE=query KEY=...`) e repassa `--role` ao `build.js`; `KEY` alias de `ROBOT_API_KEY`.
- [x] `make help` documenta novos targets/variações.
- [x] Gate check passes: build gate

**Tests**: none  
**Gate**: build  
**Commit**: `chore(build): register npm scripts for dual robot compilation`

---

### Phase 5: Docs & Validation

### T11: Inventário de Rotas, STATE e Validation

**What**: Atualizar documentação, inventário e artefatos de validação da feature.  
**Where**: `.specs/routes-inventory.md` + `.specs/STATE.md` + `.specs/features/robot/dois-robos-consulta-atualizacao/validation.md`  
**Depends on**: T10  
**Reuses**: `tools/generate-routes-inventory.js`, `STATE.md` AD pattern  
**Requirement**: ROB2-01..09 (docs)  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `make routes-inventory` regenerado (se rotas alteradas).
- [x] `.specs/STATE.md` com AD-0XX da feature (role, fila, build matrix) + handoff atualizado.
- [x] `.specs/features/robot/dois-robos-consulta-atualizacao/validation.md` criado (evidências por AC, gate results).
- [x] Gate check passes: build gate

**Tests**: none  
**Gate**: build  
**Commit**: `docs(specs): finalize dual-robot validation and inventory`

---

## Phase Execution Map

```
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5

Phase 1:  T1 -> T2
Phase 2:  T3 -> T4 -> T5
Phase 3:  T6 -> T7 -> T8
Phase 4:  T9 -> T10
Phase 5:  T11
```

---

## Task Granularity Check

| Task | Scope | Status |
| :--- | :--- | :--- |
| T1: Modelagem do Campo Role em RobotInstance | 1 model | ✅ Granular |
| T2: Indexação, Tipagem de Actions e Contract Opcional em RobotJob | 1 model | ✅ Granular |
| T3: Filtragem de Jobs por Role em getNextJob e Schemas Zod | 2 controllers | ✅ Granular |
| T4: Registro de Role na Autenticação, Heartbeat e Métricas de Frota | controllers + routes | ✅ Granular |
| T5: Enfileiramento em StatusSyncScheduler e Conciliação em Lote | scheduler + controller | ✅ Granular |
| T6: Suporte a ROBOT_ROLE e Sessões Isoladas no Config + ApiClient | config + api-client | ✅ Granular |
| T7: Isolamento de Execução de Rotinas no JobRunner | 1 runner class | ✅ Granular |
| T8: Entrypoints Físicos Dedicados de Inicialização | 3 entrypoints (query/update/dispatcher) | ✅ Granular |
| T9: Parametrização do Pipeline de Build no build.js | 1 build script | ✅ Granular |
| T10: Configuração de Scripts NPM e Makefile | package + Makefile | ✅ Granular |
| T11: Inventário de Rotas, STATE e Validation | docs (3 arquivos) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| :--- | :--- | :--- | :--- |
| T1 | None | None | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 (Phase 1) → T3 (Phase 2) | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 (Phase 2) → T6 (Phase 3) | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T8 | T8 (Phase 3) → T9 (Phase 4) | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T10 | T10 (Phase 4) → T11 (Phase 5) | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| :--- | :--- | :--- | :--- | :--- |
| T1 | Model / Schema | regression | regression | ✅ OK |
| T2 | Model / Schema | regression | regression | ✅ OK |
| T3 | Controller / API | regression | regression | ✅ OK |
| T4 | Controller / API | regression | regression | ✅ OK |
| T5 | Controller / Scheduler | regression | regression | ✅ OK |
| T6 | Client Config / Runner | regression | regression | ✅ OK |
| T7 | Client Config / Runner | regression | regression | ✅ OK |
| T8 | Client Config / Runner | regression | regression | ✅ OK |
| T9 | Build Pipeline | none | none | ✅ OK |
| T10 | Build Pipeline | none | none | ✅ OK |
| T11 | Docs / Validation | none | none | ✅ OK |
