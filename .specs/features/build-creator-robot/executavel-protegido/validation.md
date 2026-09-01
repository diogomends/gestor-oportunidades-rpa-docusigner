# Validation Report: Executável Protegido & Multi-Instância

**Feature**: Robot-DocuSigner Standalone Executável Protegido & Multi-Instância Distribuída
**Spec**: `.specs/features/build-creator-robot/executavel-protegido/spec.md`
**Verdict**: PASS ✅ (revalidado pós AD-053)

---

## Acceptance Criteria Verification

| Req | Criterion | Result | Evidence |
|-----|-----------|--------|----------|
| REQ-SMI-01 | `RobotJob` com `locked_by/lock_expires_at/instance_metadata/originalStatus` + `RobotInstance.role` + `query_agreements` condicional + índice `{status,action,lock,createdAt}`; lock atômico `$and` com dois `$or` | PASS | `models/RobotJob.js`, `models/RobotInstance.js: role enum`, `controllers/robotInstanceController.js: findOneAndUpdate` |
| REQ-SMI-02 | Endpoints `/instance/*`: auth com `role` (400 inválido), next-job filtra por `allowedActions`, heartbeat persiste `role`, batch `query_agreements` reconcilia, metrics `instances_by_role` | PASS | `robotInstanceController.js: ROLE_ENUM, parseRoleOr400, getNextJob allowedActions, updateJobStatus envelopes` |
| REQ-SMI-03 | Cliente `ApiClient/Scheduler/JobRunner` com `ROBOT_ROLE` + sessões isoladas + guard antes de `chromium.launch`; distribuição `.exe`+`node_modules`+`run.bat`+`README.txt` por `robot-<role>-N` (sem `.jsc`) | PASS | `robot/src/config.js sessionByRole`, `robot/src/api-client.js role`, `robot/src/job-runner.js ROLE_ACTIONS`, `robot/src/main-query.js` |
| REQ-SMI-04 | Pipeline `esbuild→obfuscator→pkg` 3 etapas, `--define ROBOT_ROLE/HEADLESS/API_URL/ROBOT_KEY`, `--external:playwright-core/bytenode`, matriz `N×R`, entryFile por papel, patch `coreBundle.js`, sem `bytenode/.jsc` | PASS | `robot/build/build.js: 1/4 esbuild defines, 2/4 obfuscator, 3/4 pkg, 4/4 copy + patch` |
| REQ-SMI-05 | `playwright` + `playwright-core` copiados para `dist/robot-query-N/node_modules/` e `dist/robot-update-N/node_modules/` + `setup.bat` + `run.bat` título por papel | PASS | `build.js:224-252 copy + setup.bat + run.bat roleLabel` |
| REQ-SMI-06 | `setup.bat` UTF-8, detecção `chromium-*` prévia, fallback `npx playwright install chromium`, `%ERRORLEVEL%`, ping, `setup.log`, pré-checagem `if exist` | PASS | `robot/scripts/setup.bat: chcp 65001, chromium-* check, ERRORLEVEL, setup.log` |
| REQ-SMI-07 | `setup.bat` registra `HKCU\...\Run DocuSignerRobot → run.bat` | PASS | `setup.bat: reg add HKCU\...\Run /v DocuSignerRobot /d run.bat` |
| REQ-SMI-08 | Dual-robot: `role` em `RobotInstance/RobotJob`, `statusSyncScheduler` enfileira `query_agreements` idempotente (heartbeat 60s) senão fallback `executeWithBrowser`, `Makefile ROLE=` | PASS | `seletorApiRobot/statusSyncScheduler.js`, `Makefile`, `robot/package.json build:robot:query|update|all` |

---

## Summary

Pipeline 3 etapas sem `.jsc` (AD-013 atualizado), matriz `N×R` por papel, sessões isoladas e roteamento por `role` implementados e validados. Cross-ref `robot/dois-robos-consulta-atualizacao` (AD-053).
