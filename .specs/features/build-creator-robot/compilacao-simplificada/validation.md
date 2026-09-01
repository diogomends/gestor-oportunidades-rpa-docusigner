# Validation Report: Build Robots (compilacao-simplificada)

**Feature**: Build Robots — compilação simplificada + matriz dual-robot
**Spec**: `.specs/features/build-creator-robot/compilacao-simplificada/spec.md` (AD-016 superseded by AD-053)
**Verdict**: PASS ✅ (revalidado pós AD-053)

---

## Acceptance Criteria Verification

| Requirement ID | Acceptance Criterion | Result | Evidence |
|----------------|----------------------|--------|----------|
| BUILD-01 | Build gera `.exe` por papel em `dist/robot-<role>-N/<role>.exe` sem `.jsc` + `run.bat`/`README.txt`/`node_modules` ao lado | PASS | `build.js:buildForOneKey()` 3 etapas `esbuild→obfuscator→pkg`; `fs.cpSync playwright`; sem `bytenode.compile` |
| BUILD-02 | Aborta se `--key` e `ROBOT_API_KEY_N` ausentes | PASS | `build.js:127-134` `if(detectedKeys.length===0) exit 1` |
| BUILD-03 | Default `API_URL` → `http://localhost:3111` (sanitiza trailing slash) | PASS | `build.js:138` `rawApiUrl || ... || "http://localhost:3111"` + `.replace(/\/+$/,"")` |
| BUILD-04 | `--headless false` embutido via `--define` | PASS | `build.js:141-147` + `defineArgs HEADLESS="${isHeadless}"` |
| BUILD-05 | Default `HEADLESS` = `true` | PASS | `isHeadless` fallback `true` |
| BUILD-06 | `--role query|update|all` → `bundleBase`/`entryFile`/`define ROBOT_ROLE`/`run.bat` por papel | PASS | `build.js:50-88 parseArgs --role`, `111 buildRoles`, `180-183 bundleBase robot-<role> / entryFile main-query/update.js`, `194 define ROBOT_ROLE`, `255-257 run.bat title Consulta/Atualização` |
| BUILD-07 | Matriz `N×R` (2N quando `ROLE=all`) | PASS | `build.js:320-329 for(role) for(dk) buildForOneKey({role})`; `320-344` resumo `N×R` |
| AUTH-01 | Server retorna `{ token, instance_id }` + persiste `role` | PASS | `POST /instance/auth` → `instance_id` + `RobotInstance.role` |
| AUTH-02 | Robô grava `instance_id` da resposta | PASS | `api-client.js: authenticate() this.instanceId = data.instance_id` |
| AUTH-03 | Chamadas subsequentes usam `instance_id` + `role` | PASS | `getNextJob ?role=`, `sendHeartbeat body.role`, `updateJobStatus` |
| CFG-01 | `config.js` retorna `API_URL, ROBOT_KEY, ROBOT_ROLE, HEADLESS, POLL_INTERVAL_SECONDS, DOCUSIGN_SESSION_PATH` sem `ROBOT_ID/EMAIL/PASS` | PASS | `robot/src/config.js: sessionByRole + ROBOT_ROLE/DOCS_SESSION_PATH` |
| CFG-02 | `config.json` removido; sessões `session-query.json`/`session-update.json` por papel | PASS | `Test-Path robot/config.json` = False; `config.js` só lê `session-*.json` |

---

## Summary of Changes (pós AD-053)

1. `robot/src/config.js`: `ROBOT_ROLE` + `sessionByRole` role-aware; removidas chaves obsoletas.
2. `robot/src/api-client.js`: `role` no construtor, `authenticate()` com `payload.role`, `getNextJob`/`heartbeat` propagam `role`.
3. `robot/src/main.js` + `main-query.js`/`main-update.js` wrappers 3L + `JobRunner` guard `allowedActions` antes de `chromium.launch`.
4. `robot/build/build.js`: 4 params (`--role`), matriz `N×R`, `bundleBase robot-<role>-N`, `entryFile` por papel, `--define ROBOT_ROLE`, `--external:playwright-core`, pipeline 3 etapas sem `.jsc`, `run.bat` por papel, `README.txt` por bundle.
5. `Makefile` + `robot/package.json`: `ROLE=query|update|all`, targets `build:robot:query|update|all`.
6. `STATE.md` AD-016/017 → `superseded by AD-053`; AD-013 trade-off atualizado para `.exe self-contained + node_modules`.
