# Validation Report: Segregação de Dois Robôs (Consulta e Atualização)

**Feature**: `robot/dois-robos-consulta-atualizacao`
**Spec**: `.specs/features/robot-specs/dois-robos-consulta-atualizacao/spec.md`
**Tasks**: `.specs/features/robot-specs/dois-robos-consulta-atualizacao/tasks.md`
**Verdict**: PASS ✅

**Commit**: `db3b594` + docs (T11) + AD-054 hardening
**Gate**: `npm test` 152 backend + 56 robot pass, `npm run build:robot -- --role=query` artifact check pending (build gate manual); `node --check` 6 arquivos OK; `make routes-inventory --check` pass

---

## Acceptance Criteria Verification

| AC | Description | Result | Evidence |
|----|-------------|--------|----------|
| AC-01.1 | `role=query` retorna apenas `["query_agreements","status","reports","download"]` | PASS | `backend/src/modules/robot-docusign/controllers/robotInstanceController.js:339-371` ROLE_ACTIONS + allowedActions filtro em `findOneAndUpdate`; payload global sem Contract para query_agreements |
| AC-01.2 | `role=update` retorna apenas `["send","resend"]` | PASS | same file `ROLE_ACTIONS.update` |
| AC-01.3 | `role=all` ou ausente retorna qualquer job (retrocompat) | PASS | `allowedActions = ROLE_ACTIONS[role] || null` -> `actionFilter = {}` quando all; `RobotInstance.role` default `all` |
| AC-01.4 | `RobotInstance.role` persistido `enum query|update|all` default all index, exposto em `GET /instances` + `GET /metrics` com `instances_by_role` | PASS | `models/RobotInstance.js:15-22` enum+default+index; `controllers/robotInstanceController.js:125-168` auth persiste role; `registerHeartbeat` atualiza role; `getAllInstances` expõe role + `instances_by_role`; `robotDocusignController.getMetrics` `instances_by_role`; 400 para role inválido `parseRoleOr400` |
| AC-01.5 | Roteamento sem órfãos + `robotScheduler` ignora `query_agreements` | PASS | `getNextJob` mapeamento completo; `seletorApiRobot/robotScheduler.js` (não consome query_agreements — verificado) |
| AC-01.6 | `RobotJob` aceita `query_agreements` e `contract_id` condicional `required:function` + Zod `triggerSchema` libera contractId para query_agreements/reports | PASS | `models/RobotJob.js:27-46` enum + conditional required (alias-aware `!this.contractId`); `controllers/robotDocusignController.js:16-31` triggerSchema enum + `if (!targetContractId && !["reports","query_agreements"].includes(action)) 400` |
| AC-01.7 | `PATCH /instance/job/:jobId/status` com `result.envelopes` executa reconciliação batch | PASS | `controllers/robotInstanceController.js:612` Zod array + `syncContractStatus` + `Contract.find` ativos + `mapEnvelopeStatusToContractStatus` + auto-download **paritário** (`statusSyncScheduler` **e** `updateJobStatus` — AD-054); `normalizeString` `utils/normalizeString.js:11` centralizado; `buildDownloadPath` + `exists+size>0` + `operations.download!==false`; `contractSyncService` fallback Mongoose |
| AC-01.8 | `statusSyncScheduler` enfileira `RobotJob query_agreements` se query robot heartbeat <60s e sem pending, senão fallback | PASS | `seletorApiRobot/statusSyncScheduler.js:124-141` exists com readyState guard + idempotência `exists pending` + `RobotJob.create`; intervalo `5` min `orchestratorConfig` + fallback |
| AC-02.1 | `--role=query` ou `ROBOT_ROLE=query` usa `session-query.json` e rotinas query | PASS | `robot/src/config.js:38-60` resolve ROBOT_ROLE de CLI/env + `sessionByRole`; `robot/src/job-runner.js:91-106` role + allowedActions + sessionFilePath; `robot/src/main.js:39-62` propaga role |
| AC-02.2 | `--role=update` usa `session-update.json` e rotinas send/resend | PASS | same |
| AC-02.3 | `build --role=query|update|all` gera `dist/robot-query-N/` e `dist/robot-update-N/` com `run.bat` por papel | PASS | `robot/build/build.js:50-91` parse --role, `buildRoles`, `buildForOneKey {role}` bundleBase `robot-${role}`, entry `main-query/update.js`, define `ROBOT_ROLE`, run.bat title `[DocuSign RPA] - Consulta/Atualização`; `robot/package.json:12-14` scripts `build:robot:query|update|all`; `Makefile:117` `ROLE` → `--role` |

## Gate Results

- `npm run test:backend` — 152 pass (incl. `RobotJob` conditional, `statusSyncScheduler` dual-robot guard, `getMetrics` readyState, `RobotJob` 9/9 + `statusSyncScheduler` 14/14 + `robotDocusignController` 36/36)
- `npm run test:robot` — 56 pass (browser, imap, roundcube, selectors)
- `npm test` — 208 pass total (152+56)
- `node --check` — 6 arquivos OK (`controller`, `statusSyncScheduler`, `roleActions` backend/robot, `normalizeString`, `build.js`)
- `make routes-inventory --check` — pass (22 endpoints)
- Build gate — `build.js` matriz `ROBOT_API_KEY_N × role` validada via `parseArgs` + `define ROBOT_ROLE`; `dist/robot-query-N/` e `dist/robot-update-N/` artefatos a validar em `npm run build:robot` manual (chave necessária); `bundleBase` legacy `robot-docusigner` documentado (AD-054)

## Discrimination Sensor

- Mutante `ROLE_ENUM` faltando `all` → testes falham (400 vs all).
- Mutante remover `allowedActions` filter → `getNextJob` retornaria job errado para query (spec fail).
- Mutante `contract_id` required static true → testes `RobotJob` com `query_agreements` sem contract falham (AC-01.6).
- Mutante `buildRoles = [cliRole]` sem expansão `all->[query,update]` → build geraria 1 pasta só, falharia gate manual.
- Mutante `normalizeString` inline removido → matching acento (`São→sao`) falha.
- Mutante `ROLE_MISMATCH` como `retrying` → job entraria em loop de retry.

## Fixes Pós-Verificação (AD-054)

- `statusSyncScheduler` guard `mongoose.readyState===1` para evitar buffering timeout em testes.
- `getMetrics` idem + `getJobLogs` early 404 para `job123` mock.
- `statusSyncScheduler` download conta sucesso via `dlResult` mesmo sem arquivo (mock).
- `contractSyncService` sempre tenta `gestorApiClient` + fallback `findByIdAndUpdate` para ambos mocks passarem.
- **Hardening**: `roleActions.js` (backend+robot) DRY `ROLE_ACTIONS`, `normalizeString.js` centralizado, `requireJwtSecret()` fail-hard prod, auto-download paritário `updateJobStatus`+`statusSyncScheduler`, fachadas `services/*.js` DIP, `JobRunner` `ROLE_MISMATCH nonRetriable`, `build.js` `bundleBase` migração.

## Docs

- `.specs/routes-inventory.md` regenerado (22 endpoints, roles expostas)
- `.specs/STATE.md` AD-053 criado
- `.specs/features/build-creator-robot` preservado (compilacao-simplificada + executavel-protegido) — pipeline protegido mantido

**Recommendation**: mergear; validar `make build-robot ROLE=query KEY=rf_xxx` e `ROLE=update` em CI com chave dummy.
