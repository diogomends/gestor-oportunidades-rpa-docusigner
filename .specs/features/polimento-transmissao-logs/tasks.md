# Tasks: Polimento Transmissão de Logs

## Execution Protocol (MANDATORY -- do not skip)
Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).
**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

**Design**: skipped (≤3 files, sem decisão arquitetural) — polimento ponytail.
**Status**: Draft

---

## Test Coverage Matrix
> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` (`node --test` nativo, `node --env-file=.env.dev --test`), `package.json` scripts `test`/`test:robot`/`test:backend`, `tests/**/*.test.js`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| `robot/src/utils/logger.js` (utils) | unit (regression) | 1:1 ACs POLISH-03, FIFO cap, drain/clear | `tests/robot/logger-buffer.test.js` | `node --env-file=.env.dev --test tests/robot/logger-buffer.test.js` |
| `backend/src/modules/robot-docusign/controllers/instance/updateJobStatus.js` | regression (supertest) | AC POLISH-01: happy logs + retrocompat empty, anti-fantasma preservado | `tests/backend/controllers/updateJobStatus-logs.test.js` | `node --env-file=.env.dev --test tests/backend/controllers/updateJobStatus-logs.test.js` |
| `backend/src/modules/robot-docusign/controllers/instance/getAllInstances.js` | regression (supertest) | AC POLISH-02: `?includeLogs=true` dual igual, sem flag omite | `tests/backend/controllers/robotInstance-telemetry.test.js` | `node --env-file=.env.dev --test tests/backend/controllers/robotInstance-telemetry.test.js` |
| SSE stream (already verified) | regression | AC LOG-04 preservado | `tests/backend/controllers/streamJobProgress.test.js` | `node --env-file=.env.dev --test tests/backend/controllers/streamJobProgress.test.js` |

## Gate Check Commands
> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após T1 ou T3 (unit) | `node --env-file=.env.dev --test tests/robot/logger-buffer.test.js` |
| Quick | Após T1 backend fix | `node --env-file=.env.dev --test tests/backend/controllers/updateJobStatus-logs.test.js` |
| Full | Após T2 (integração instances) | `node --env-file=.env.dev --test tests/backend/controllers/robotInstance-telemetry.test.js tests/backend/controllers/updateJobStatus-logs.test.js` |
| Build | Após todas | `node --env-file=.env.dev --test tests/robot/logger-buffer.test.js tests/robot/job-runner-logs.test.js tests/backend/controllers/updateJobStatus-logs.test.js tests/backend/controllers/streamJobProgress.test.js` |

---

## Execution Plan
Phases are ordered and run sequentially — cada fase completa antes da próxima.

### Phase 1: Correção de regressão + polimento ponytail

```
T1 → T2 → T3
```

---

## Task Breakdown

### T1: Corrigir mock `updateJobStatus-logs.test.js` (POLISH-01)
**What**: Ajustar mock `RobotJob.findById` para `() => ({ lean: async () => fakeJob })` e idem `findByIdAndUpdate` chain, corrigindo 2 fails 500.
**Where**: `tests/backend/controllers/updateJobStatus-logs.test.js:42-53, 91-95`
**Depends on**: None
**Reuses**: padrão de mock em `tests/backend/controllers/robotInstance-telemetry.test.js`
**Requirement**: POLISH-01
**Tools**: MCP: filesystem — Skill: none
**Done when**:
- [x] `mock.method(RobotJob, "findById", () => ({ lean: async () => fakeJob }))` e `findByIdAndUpdate` equivalente
- [x] `node --env-file=.env.dev --test tests/backend/controllers/updateJobStatus-logs.test.js` 2/2 pass
- [x] `npm run test:backend` sem regressão em outros controllers
**Tests**: regression (supertest) — já existente, fix only
**Gate**: quick (`node --env-file=.env.dev --test tests/backend/controllers/updateJobStatus-logs.test.js`)
**Commit**: `test(backend): fix updateJobStatus logs mock lean chain`

---

### T2: Deduplicar `getAllInstances.js` dual logs (POLISH-02)
**What**: Extrair `const logs = getLogs(inst.instance_id)` e reusar em `logs` e `telemetryLogs` (1 call vs 2).
**Where**: `backend/src/modules/robot-docusign/controllers/instance/getAllInstances.js:48-53` (+ `streamInstanceTelemetry.js:41` guard ponteiro p/ mock SSE)
**Depends on**: T1
**Reuses**: `backend/src/modules/robot-docusign/utils/telemetryBuffer.js#getLogs`
**Requirement**: POLISH-02
**Tools**: MCP: filesystem — Skill: none
**Done when**:
- [x] `includeLogs` branch usa `const l = getLogs(id); logs: l, telemetryLogs: l`
- [x] `GET /instances?includeLogs=true` retorna ambos idênticos; sem flag omite
- [x] `node --env-file=.env.dev --test tests/backend/controllers/robotInstance-telemetry.test.js` 9/9 pass (inclui guard `res.on`)
**Tests**: regression (supertest) — existente
**Gate**: full
**Commit**: `refactor(backend): dedup getLogs dual exposure in getAllInstances`

---

### T3: Cap FIFO 500 + `// ponytail:` em `logger.js` (POLISH-03)
**What**: Limitar `jobLogsBuffer` a 500 entradas (FIFO shift) e anotar `// ponytail:` com ceiling + upgrade path.
**Where**: `robot/src/utils/logger.js:22,39-42`
**Depends on**: T2
**Reuses**: padrão `MAX_LOGS` de `telemetryBuffer.js:6`
**Requirement**: POLISH-03
**Tools**: MCP: filesystem — Skill: none
**Done when**:
- [x] `const MAX_JOB_LOGS = 500;` e `if (jobLogsBuffer.length > MAX) jobLogsBuffer.shift()` em `recordToBuffer`
- [x] comentário `// ponytail: cap 500 FIFO, aumentar/buscar paginado se job >10k linhas`
- [x] `node --env-file=.env.dev --test tests/robot/logger-buffer.test.js` 3/3 pass + manual FIFO 600→500 PASS
**Tests**: unit/regression — existente + 1 assert cap
**Gate**: quick + build final (9/9)
**Commit**: `refactor(robot): cap jobLogsBuffer FIFO 500 with ponytail note`

---

## Phase Execution Map
```
Phase 1 → done

Phase 1:  T1 ------→ T2 ------→ T3
```

## Task Granularity Check
| Task | Scope | Status |
|---|---|---|
| T1: fix mock lean chain | 1 file, 1 função mock | ✅ Granular |
| T2: dedup getAllInstances | 1 arquivo, 2 linhas | ✅ Granular |
| T3: cap logger FIFO | 1 arquivo, 1 constante + guard | ✅ Granular |

## Diagram-Definition Cross-Check
| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | None (início) | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T2 | T2→T3 | ✅ Match |

## Test Co-location Validation
| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | `updateJobStatus` controller | regression | regression | ✅ OK |
| T2 | `getAllInstances` controller | regression | regression | ✅ OK |
| T3 | `logger.js` utils | unit/regression | unit/regression | ✅ OK |
