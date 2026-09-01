# Build Robots Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/build-creator-robot/compilacao-simplificada/spec.md`
**Status**: Implemented (AD-016 superseded by AD-053 — 4 params, matriz N×R)

---

## Test Coverage Matrix

> Generated from codebase — confirm before Execute. Guidelines: `AGENTS.md` (node --test nativo).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|------------|-------------------|---------------------|------------------|-------------|
| Config | none | build gate: `ROBOT_ROLE` + `DOCUSIGN_SESSION_PATH` role-aware | `robot/src/config.js` | build gate |
| API Client | unit | auth flow: instance_id + role from response | `robot/src/api-client.js` | `node --test` |
| Build Script | none | manual verification: matriz N×R, entryFile, define ROBOT_ROLE | `robot/build/build.js` | manual |
| Main / JobRunner | none | build gate: entrypoints + guard | `robot/src/main*.js`, `robot/src/job-runner.js` | build gate |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|-----------|---------------|-----------------|----------|
| unit | Yes | per-test mock | `robot/src/` sem shared state |

## Gate Check Commands

| Gate Level | When to Use | Command |
|------------|-------------|---------|
| Quick | After tasks with unit tests only | `cd robot && npm test` |
| Build | After phase completion | `node robot/build/build.js --key rf_test --role query` + `ls robot/dist/robot-query-1/` |

---

## Execution Plan

### Phase 1: Config Cleanup + Role (Sequential)

```
T1 → T2
```

### Phase 2: API Client + Main (Sequential)

```
T2 → T3
```

### Phase 3: Build Script Matriz (Sequential)

```
T3 → T4
```

### Phase 4: Makefile + Docs (Sequential)

```
T4 → T5 → T6
```

---

## Task Breakdown

### T1: Atualizar config.js — remover ROBOT_ID/EMAIL/PASS, adicionar ROBOT_ROLE + DOCUSIGN_SESSION_PATH

**What**: Remover `ROBOT_ID`, `ROBOT_EMAIL`, `ROBOT_PASS`; adicionar `ROBOT_ROLE` (env/fileConfig/CLI `--role`, whitelist `query|update|all`, default `all`) e `DOCUSIGN_SESSION_PATH` role-aware (`sessionByRole`)
**Where**: `robot/src/config.js`
**Depends on**: None
**Reuses**: `robot/src/config.js` (existente)

**Done when**:

- [x] `loadConfig()` retorna `API_URL`, `ROBOT_KEY`, `ROBOT_ROLE`, `HEADLESS`, `POLL_INTERVAL_SECONDS`, `DOCUSIGN_SESSION_PATH`
- [x] `ROBOT_ROLE` resolvido de `process.env.ROBOT_ROLE` / `fileConfig.ROBOT_ROLE` / `--role` CLI (lowercase, whitelist)
- [x] `sessionByRole = {query: session-query.json, update: session-update.json, all: session-docusign.json}`; `DOCUSIGN_SESSION_PATH = sessionByRole[role]` (fallback `DOCUSIGN_SESSION_PATH` env)
- [x] Sem `ROBOT_ID`, `ROBOT_EMAIL`, `ROBOT_PASS` no objeto; `config.json.example` removido

**Tests**: none (config layer — build gate only)
**Gate**: quick

**Commit**: `refactor(robot): remove ROBOT_ID/EMAIL/PASS, add ROBOT_ROLE + sessionByRole`

---

### T2: Atualizar api-client.js — instanceId + role via auth response

**What**: `ApiClient` com `role`; `authenticate()` envia `payload.role` e grava `this.instanceId` + `this.role`; `getNextJob`/`heartbeat` propagam `role`
**Where**: `robot/src/api-client.js`
**Depends on**: T1
**Reuses**: `robot/src/api-client.js`

**Done when**:

- [x] Construtor `constructor(baseUrl, instanceId, role)` com `this.role`
- [x] `authenticate()` envia `{role}` e grava `this.instanceId = data.instance_id`
- [x] `getNextJob()` usa `?instance_id=&role=`
- [x] `sendHeartbeat()` envia `body.role`
- [x] `updateJobStatus()` usa `this.instanceId` (role já persistido na instância)
- [x] Se `instanceId` ausente antes da auth, erro claro

**Tests**: unit (auth flow — instance_id + role from response)
**Gate**: quick

**Commit**: `refactor(robot): propagate role in ApiClient auth/next-job/heartbeat`

---

### T3: Atualizar main.js + entrypoints + JobRunner guard

**What**: `main.js` loga `ROBOT_ROLE` + `DOCUSIGN_SESSION_PATH`, instancia `ApiClient(API_URL, null, ROBOT_ROLE)` e `JobRunner({role, sessionFilePath})`; wrappers `main-query.js`/`main-update.js` (3L); `job-runner.js` com `ROLE_ACTIONS` + guard antes de `chromium.launch`
**Where**: `robot/src/main.js`, `robot/src/main-query.js`, `robot/src/main-update.js`, `robot/src/job-runner.js`
**Depends on**: T2
**Reuses**: `robot/src/main.js`, `robot/src/job-runner.js`

**Done when**:

- [x] `main-query.js`: `process.env.ROBOT_ROLE="query"; await import("./main.js")`
- [x] `main-update.js`: idem `update`
- [x] `main.js`: log `Papel (ROBOT_ROLE): … | Sessão: …`; `new ApiClient(API_URL, null, ROBOT_ROLE)`; `new JobRunner({role: ROBOT_ROLE, sessionFilePath})`; sem `config.ROBOT_ID`
- [x] `job-runner.js`: `ROLE_ACTIONS = {query:[status,query_agreements,reports,download], update:[send,resend], all:*}`; `allowedActions`; guard `if(!allowedActions.includes(action)) → updateJobStatus failed + throw` antes de `chromium.launch`

**Tests**: none (integration — build gate)
**Gate**: build

**Commit**: `feat(robot): dual entrypoints and JobRunner guard by role`

---

### T4: Simplificar/estender build.js — --key --api-url --headless --role + matriz N×R

**What**: `parseArgs()` aceita 4 params incluindo `--role`; `buildRoles = cliRole==="all"? ["query","update"]:[cliRole]`; `buildForOneKey({role})` com `bundleBase = robot-<role>-<tag>` (alias `robot-docusigner-N` quando `all`), `entryFile` por papel, `--define ROBOT_ROLE` + `HEADLESS`, `--external:playwright-core,bytenode`, loop `for(role) for(key)` → `N×R` artefatos, `run.bat` com `title [DocuSign RPA] - Consulta/Atualização #N`, pipeline 3 etapas sem `bytenode/.jsc`, `import bytenode` removido
**Where**: `robot/build/build.js`
**Depends on**: T3
**Reuses**: `robot/build/build.js`

**Done when**:

- [x] `parseArgs()` aceita `--key/--robot-key`, `--api-url/--uri-prod`, `--headless`, `--role/--ROBOT_ROLE` (whitelist, default `all` de `process.env.ROBOT_ROLE`)
- [x] `--key` obrigatório (sem `ROBOT_API_KEY_N` → aborta); `--api-url` default `http://localhost:3111` (sanitiza trailing slash); `--headless` default `true`
- [x] `buildRoles` + matriz `N×R` (2N quando `all`); `bundleBase` + `outDir = dist/<bundleBase>/`
- [x] `entryFile = src/main-query.js | main-update.js | main.js` por papel
- [x] `defineArgs` inclui `ROBOT_ROLE` + `HEADLESS` (sem `ROBOT_ID/EMAIL/PASS`); `--external:playwright --external:playwright-core --external:bytenode`
- [x] Etapas: 1/4 esbuild → 2/4 obfuscator → 3/4 `@yao-pkg/pkg` .exe → 4/4 copy `playwright/playwright-core` + patch `coreBundle.js` + `setup.bat` + `run.bat` + `README.txt`
- [x] Sem geração de `.jsc`; `import bytenode` removido (ou mantido como dev-only se pipeline futuro reintroduzir)
- [x] Console log: `Papéis (roles): query, update` + `Chaves detectadas: N`

**Tests**: none (build script — manual verification)
**Gate**: build

**Commit**: `feat(robot): build matrix N×R with --role, entryFile and ROBOT_ROLE define`

---

### T5: Atualizar Makefile e package.json

**What**: `Makefile` help + exemplos `ROLE=query|update|all`; target `build-robot: … --role "$(or $(ROLE),all)"`; `robot/package.json` scripts `build:robot:query|update|all` e `start:query|update`
**Where**: `Makefile`, `robot/package.json`
**Depends on**: T4
**Reuses**: `Makefile`, `robot/package.json`

**Done when**:

- [x] `make build-robot` aceita `KEY`, `API_URL`, `HEADLESS`, `ROLE`
- [x] `make help` documenta `ROLE=query|update|all` com exemplos
- [x] `robot/package.json` tem `build:robot:query`, `build:robot:update`, `build:robot:all`

**Tests**: none
**Gate**: build

**Commit**: `chore(robot): Makefile ROLE and package.json build targets by role`

---

### T6: Docs e limpeza final

**What**: `robot/README.md` / `README.txt` template por papel, `STATE.md AD-013/016/017`, validação `validation.md` atualizada; remover `config.json.example`/`pkg.config.json` se ainda existir
**Where**: `robot/README.md`, `.specs/STATE.md`, `.specs/features/build-creator-robot/*/validation.md`
**Depends on**: T5

**Done when**:

- [x] `README.txt` gerado por papel (título e instruções por `run.bat`)
- [x] `STATE.md` AD-016/017 → `superseded by AD-053`; AD-013 trade-off `.exe self-contained + node_modules` (sem `.jsc`)
- [x] `compilacao-simplificada/validation.md` revalidado (BUILD-06/07, CFG-01/02)
- [x] `executavel-protegido/validation.md` criado
- [x] Sem `config.json.example` em disco

**Tests**: none
**Gate**: build

**Commit**: `docs(robot): update specs validation and STATE for dual-robot build`

---

## Parallel Execution Map

```
Phase 1: T1 → T2
Phase 2: T2 → T3
Phase 3: T3 → T4
Phase 4: T4 → T5 → T6
```

**Parallelism constraint:** All tasks sequential — each depends on previous (config → client → main → build → make → docs).

---

## Task Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T1: config role-aware | 1 file, 2 keys + sessionByRole | ✅ Granular |
| T2: api-client role | 1 file, auth/heartbeat/next-job | ✅ Granular |
| T3: entrypoints + guard | 3 files, wrappers + guard | ✅ Granular |
| T4: build matrix | 1 file, parseArgs + N×R loop | ✅ Granular |
| T5: Makefile + pkg | 2 files, vars + scripts | ✅ Granular |
| T6: docs + STATE | 4 files, docs only | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram | Status |
|------|------------|---------|--------|
| T1 | None | T1→T2 | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T2 | T2→T3 | ✅ |
| T4 | T3 | T3→T4 | ✅ |
| T5 | T4 | T4→T5 | ✅ |
| T6 | T5 | T5→T6 | ✅ |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|------|------------|-----------------|-----------|--------|
| T1 | Config | none | none | ✅ |
| T2 | API Client | unit | unit | ✅ |
| T3 | Main/JobRunner | none | none | ✅ |
| T4 | Build Script | none | none | ✅ |
| T5 | Makefile/Docs | none | none | ✅ |
| T6 | Docs | none | none | ✅ |
