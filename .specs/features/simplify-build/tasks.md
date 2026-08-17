# Simplify Robot Build Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/simplify-build/spec.md`
**Status**: Complete

---

## Test Coverage Matrix

> Generated from codebase — confirm before Execute. Guidelines found: `AGENTS.md` (node --test nativo).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|------------|-------------------|---------------------|------------------|-------------|
| Config | none | build gate only | `robot-standalone/src/config.js` | build gate |
| API Client | unit | auth flow: instance_id from response | `robot-standalone/src/api-client.js` | `node --test` |
| Build Script | none | manual verification (gera .exe) | `robot-standalone/build/build.js` | manual |
| Main | none | build gate only | `robot-standalone/src/main.js` | build gate |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|-----------|---------------|-----------------|----------|
| unit | Yes | per-test mock | `robot-standalone/src/` (sem shared state) |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
|------------|-------------|---------|
| Quick | After tasks with unit tests only | `cd robot-standalone && npm test` |
| Build | After phase completion | `cd robot-standalone && npm run build` |

---

## Execution Plan

### Phase 1: Config Cleanup (Sequential)

```
T1 → T2
```

### Phase 2: API Client (Sequential)

```
T2 → T3
```

### Phase 3: Build Script (Sequential)

```
T3 → T4
```

### Phase 4: Makefile + Docs (Sequential)

```
T4 → T5
```

---

## Task Breakdown

### T1: Atualizar config.js — remover ROBOT_ID, ROBOT_EMAIL, ROBOT_PASS

**What**: Remover chaves `ROBOT_ID`, `ROBOT_EMAIL`, `ROBOT_PASS` do objeto retornado por `loadConfig()`
**Where**: `robot-standalone/src/config.js`
**Depends on**: None
**Reuses**: `robot-standalone/src/config.js` (existente)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `loadConfig()` retorna objeto com `API_URL`, `ROBOT_KEY`, `HEADLESS`, `POLL_INTERVAL_SECONDS`
- [x] Sem `ROBOT_ID`, `ROBOT_EMAIL`, `ROBOT_PASS` no objeto
- [x] Comentários explicativos removidos ou atualizados
- [x] `npm test` passa (se houver testes de config)

**Tests**: none (config layer — build gate only)
**Gate**: quick

**Commit**: `refactor(robot-standalone): remove ROBOT_ID, ROBOT_EMAIL, ROBOT_PASS from config`

---

### T2: Atualizar api-client.js — instanceId via auth response

**What**: Modificar `ApiClient` para não requerer `instanceId` no construtor; gravar `instance_id` da resposta do `/instance/auth`
**Where**: `robot-standalone/src/api-client.js`
**Depends on**: T1
**Reuses**: `robot-standalone/src/api-client.js` (existente)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Construtor aceita `baseUrl` sem `instanceId` (opcional ou removido)
- [x] `authenticate()` grava `this.instanceId` de `data.instance_id` (resposta do server)
- [x] `getNextJob()` usa `this.instanceId` (obtido da auth)
- [x] `updateJobStatus()` usa `this.instanceId`
- [x] `sendHeartbeat()` usa `this.instanceId`
- [x] Se `instanceId` não disponível antes da auth, erro claro é lançado

**Tests**: unit (auth flow — instance_id from response)
**Gate**: quick

**Commit**: `refactor(robot-standalone): get instance_id from auth response instead of constructor`

---

### T3: Atualizar main.js — remover ROBOT_ID do fluxo

**What**: Modificar `main.js` para não passar `ROBOT_ID` ao `ApiClient` e usar `instance_id` retornado da auth
**Where**: `robot-standalone/src/main.js`
**Depends on**: T2
**Reuses**: `robot-standalone/src/main.js` (existente)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `ApiClient` instanciado com `config.API_URL` apenas (sem `config.ROBOT_ID`)
- [x] Após `api.authenticate()`, `api.instanceId` contém o ID retornado pelo server
- [x] Console log mostra `instance_id` obtido da auth (não de config)
- [x] Sem referência a `config.ROBOT_ID`

**Tests**: none (integration layer — build gate only)
**Gate**: build

**Commit**: `refactor(robot-standalone): use auth-returned instance_id in main`

---

### T4: Simplificar build.js — aceitar apenas --key, --api-url, --headless

**What**: Modificar `build.js` para aceitar apenas 3 parâmetros; remover `--ids`, `--emails`, `--passwords`; remover `--define` de `ROBOT_ID`
**Where**: `robot-standalone/build/build.js`
**Depends on**: T3
**Reuses**: `robot-standalone/build/build.js` (existente)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `parseArgs()` aceita apenas `--key`, `--api-url`, `--headless`
- [x] `--key` é obrigatório (se vazio, erro e aborta)
- [x] `--api-url` tem padrão `http://localhost:3111`
- [x] `--headless` tem padrão `true`
- [x] `--define:process.env.ROBOT_ID` removido do esbuild
- [x] `--define:process.env.ROBOT_EMAIL` removido do esbuild
- [x] `--define:process.env.ROBOT_PASS` removido do esbuild
- [x] Multi-robot mode removido (1 build = 1 .exe)
- [x] Console log mostra apenas key (truncada), api-url, headless

**Tests**: none (build script — manual verification)
**Gate**: build

**Commit**: `refactor(robot-standalone): simplify build to --key, --api-url, --headless only`

---

### T5: Atualizar Makefile e config.json.example

**What**: Simplificar target `build-robot` no Makefile e limpar `config.json.example`
**Where**: `Makefile`, `robot-standalone/config.json.example`
**Depends on**: T4
**Reuses**: `Makefile` (existente)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `make build-robot` aceita `KEY`, `API_URL`, `HEADLESS` (sem `IDS`, `KEYS`, `EMAILS`, `PASSWORDS`)
- [x] Exemplo no Makefile atualizado
- [x] `config.json.example` contém apenas `API_URL`, `ROBOT_KEY`, `HEADLESS`, `POLL_INTERVAL_SECONDS`
- [x] `README.md` do robot-standalone atualizado com novos parâmetros

**Tests**: none
**Gate**: build

**Commit**: `docs(robot-standalone): update Makefile and config example for simplified build`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2

Phase 2 (Sequential):
  T2 ──→ T3

Phase 3 (Sequential):
  T3 ──→ T4

Phase 4 (Sequential):
  T4 ──→ T5
```

**Parallelism constraint:** All tasks are sequential — each depends on the previous.

---

## Task Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T1: Remove config keys | 1 file, 3 keys | ✅ Granular |
| T2: Update api-client | 1 file, auth flow | ✅ Granular |
| T3: Update main.js | 1 file, 1 change | ✅ Granular |
| T4: Simplify build.js | 1 file, parseArgs + defines | ✅ Granular |
| T5: Update Makefile + docs | 3 files, docs only | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|------|-------------------|---------------|--------|
| T1 | None | T1 → T2 | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|------|---------------------------|-----------------|-----------|--------|
| T1 | Config | none | none | ✅ OK |
| T2 | API Client | unit | unit | ✅ OK |
| T3 | Main | none | none | ✅ OK |
| T4 | Build Script | none | none | ✅ OK |
| T5 | Makefile/Docs | none | none | ✅ OK |
