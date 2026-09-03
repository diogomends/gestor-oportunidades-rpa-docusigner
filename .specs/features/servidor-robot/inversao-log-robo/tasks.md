# Inversão Log Robô + Renomeio Robot-Enviar Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/servidor-robot/inversao-log-robo/design.md` — Skipped (Small, ≤3 files, stdlib only)
**Status**: Done

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` (Node --test nativo, supertest, Zod, --env-file=.env.dev, JSDoc obrigatório), `package.json` (scripts test), `.github/workflows/deploy.yml`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Controller (robotDocusignController.js) | integration (supertest) | Todas rotas em escopo: happy + edge + error; 1:1 com INV-01..05 | `tests/backend/controllers/robotDocusignController.test.js` | `node --env-file=.env.dev --test tests/backend/controllers/robotDocusignController.test.js` |
| Robot standalone (job-runner.js / scheduler.js) | integration | Fluxo headless=false: resumo final recente-primeiro; não mutar steps | `tests/robot/**/*.test.js` | `node --env-file=.env.dev --test tests/robot/job-runner.test.js` (novo) |
| Build pipeline (build.js / Makefile) | none | Verificação de artefato existe/não-existe | `robot/dist/robot-enviar-*` (manual/build gate) | `node robot/build/build.js --key rf_test --role enviar --headless true` |
| Logger (utils/logger.js) | none | Build gate only (cores ANSI, sem lógica de ordenação) | - | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tasks com unit/integration de 1 camada | `node --env-file=.env.dev --test tests/backend/controllers/robotDocusignController.test.js` |
| Full | Após tasks com e2e/integration multi-camada | `npm test` (= `node --env-file=.env.dev --test "tests/**/*.test.js"`) |
| Build | Após phase completa ou config/build-only | `npm test && make routes-inventory-check` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Correção API + Terminal (headless=false)

Tasks corrige API já implantada (reforço de teste) e adiciona sumário terminal invertido.

```
T1 → T2 → T3 → T4
```

### Phase 2: Fechamento

Fecha spec após validações.

```
T4 → T5
```

---

## Task Breakdown

### T1: Reforçar teste API GET /logs com 3 steps (recente primeiro)

**What**: Substituir asserção de 1 step por teste de 3 steps que prova `[...steps].reverse()` e não-mutação (INV-01, INV-04, INV-05).
**Where**: `tests/backend/controllers/robotDocusignController.test.js` (describe `GET /api/robot-docusign/logs/:jobId`)
**Depends on**: None
**Reuses**: `backend/src/modules/robot-docusign/controllers/robotDocusignController.js:487` (já com reverse), mock pattern existente em `robotDocusignController.test.js:270`
**Requirement**: INV-01, INV-04, INV-05

**Tools**:
- MCP: `filesystem`
- Skill: NONE

**Done when**:
- [x] Mock `RobotJob.findById` retorna `steps=[init(0s), attempt_1(1s), robot_send(2s)]` com timestamps crescentes
- [x] `GET /logs/:jobId` retorna `steps[0].name === "robot_send"` e `steps[2].name === "init"`
- [x] `steps === []` quando job.steps é null/undefined (201 ou 200)
- [x] Array original `mockJob.steps` permanece `[init, attempt_1, robot_send]` após chamada (não mutado)
- [x] Gate check passa: `node --env-file=.env.dev --test tests/backend/controllers/robotDocusignController.test.js` com +2 asserts novos, nenhum teste deletado

**Tests**: integration (supertest, layer Controller)
**Gate**: quick

---

### T2: Adicionar sumário terminal recente-primeiro em JobRunner (headless=false)

**What**: Ao finalizar job (success e catch/finally), imprimir bloco único no terminal com `steps` em ordem descendente (recente primeiro) sem mutar array, visível mesmo com `headless=false` onde logs ao vivo são cronológicos.
**Where**: `robot/src/job-runner.js` (método `processJob`, após `logger.success "Job X finalizado"` e no bloco `catch`)
**Depends on**: T1
**Reuses**: `robot/src/utils/logger.js:29` (`logger.info/step/success`), `seletorApiRobot/index.js:90,142,175` (ordem cronológica push), padrão `[...steps].reverse()` já usado no backend
**Requirement**: INV-01 (paridade terminal), INV-05

**Tools**:
- MCP: `filesystem`
- Skill: NONE

**Done when**:
- [x] Após `processJob` success, terminal exibe bloco `— Resumo (recente primeiro) —` com `steps` em `[...steps].reverse()` (recente no topo)
- [x] Em `catch`, mesmo bloco é exibido antes de `throw` (falha também visível no topo)
- [x] Usa cópia `[...(steps||[])].reverse()` — não muta `job.steps`
- [x] Stream ao vivo permanece cronológico (não usa `console.clear()`, só apêndice final — ponytail)
- [x] Gate check passa: `node --env-file=.env.dev --test tests/robot/job-runner.test.js` (novo, ver T2)

**Tests**: integration (novo `tests/robot/job-runner.test.js` com mock `ApiClient` + captura `console.log`, assert ordem reversa vs original)
**Gate**: quick

---

### T3: Cobrir SSE stream inicial + job:progress com teste de ordem descendente

**What**: Adicionar/reforçar teste que valida `GET /jobs/:jobId/stream` payload inicial e evento `job:progress` entregam `steps` invertidos (INV-02, INV-03).
**Where**: `tests/backend/controllers/robotDocusignController.test.js`
**Depends on**: T2
**Reuses**: `backend/src/modules/robot-docusign/controllers/robotDocusignController.js:821,835`, `backend/src/modules/robot-docusign/seletorApiRobot/orchestratorEvents.js:23` (emit cru)
**Requirement**: INV-02, INV-03

**Tools**:
- MCP: `filesystem`
- Skill: NONE

**Done when**:
- [x] SSE payload inicial contém `steps` com `steps[0]` = mais recente (mock `RobotJob.findOne` com 2 steps)
- [x] `robotEvents.emit("job:progress", {steps:[a,b]})` resulta em `data.steps === [b,a]` no listener `streamJobProgress`
- [x] Gate check passa: `node --env-file=.env.dev --test tests/backend/controllers/robotDocusignController.test.js` (quick); `npm test` não quebra

**Tests**: integration (supertest + EventEmitter)
**Gate**: quick

---

### T4: Validar artefato robot-enviar (build alias enviar)

**What**: Verificar que `node build/build.js --role=enviar` e `--role=update` geram `dist/robot-enviar-1/robot-enviar-1.exe` e que `make build-robot ROLE=enviar` normaliza corretamente; nenhum `robot-update` legado é gerado quando `role=enviar`.
**Where**: `robot/build/build.js`
**Depends on**: T3
**Reuses**: Pipeline existente `esbuild → javascript-obfuscator → @yao-pkg/pkg`, `ROBOT_API_KEY_\d+` matriz N×R
**Requirement**: REN-01, REN-02, REN-03, REN-04

**Tools**:
- MCP: `filesystem`
- Skill: NONE

**Done when**:
- [x] `node robot/build/build.js --key rf_test --role enviar --headless true` cria `robot/dist/robot-enviar-1/robot-enviar-1.exe` e NÃO cria `robot/dist/robot-update-1/`
- [x] `node robot/build/build.js --key rf_test --role update --headless true` também cria `robot-enviar-1` (alias)
- [x] `make build-robot ROLE=enviar` repassa `--role` normalizado (grep Makefile)
- [x] Build gate passa (sem teste unitário, verificação de artefato manual)

**Tests**: none (build gate)
**Gate**: build

---

### T5: Atualizar traceability da spec e fechar critérios de sucesso

**What**: Marcar `INV-01..05` e `REN-01..04` como `Done` em `spec.md` Requirement Traceability, checar `Success Criteria` e rodar validadores determinísticos.
**Where**: `.specs/features/servidor-robot/inversao-log-robo/spec.md`
**Depends on**: T4
**Reuses**: `.specs/STATE.md` decisions, `spec.md:90-94` Success Criteria
**Requirement**: Todos (fechamento)

**Tools**:
- MCP: `filesystem`
- Skill: NONE

**Done when**:
- [x] `spec.md` Goals `- [x]` viram `- [x]` para INV e REN
- [x] Traceability `Status` = `Verified` para INV-01..05, REN-01..04
- [x] `python3 <skill-dir>/scripts/validate_spec.py .specs/features/servidor-robot/inversao-log-robo/spec.md` passa
- [x] `python3 <skill-dir>/scripts/validate_tasks.py .specs/features/servidor-robot/inversao-log-robo/tasks.md` passa
- [x] `python3 <skill-dir>/scripts/validate_state.py inversao-log-robo` passa após Verifier (fase seguinte)

**Tests**: none (build gate)
**Gate**: build

---

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1:  T1 ------→ T2 ------→ T3 ------→ T4
Phase 2:  T4 ------→ T5
```

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order.

**How phase-based execution works:**

At Execute, the agent counts total tasks (5 ≤ 8) → execução inline sem sub-agentes. Cada task: implementa → gate → commit atômico → marca done em `tasks.md` + spec traceability no mesmo commit.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Reforçar teste API 3 steps | 1 arquivo, 1 describe | ✅ Granular |
| T2: Sumário terminal JobRunner | 1 arquivo, 1 método | ✅ Granular |
| T3: Teste SSE stream/progress | 1 arquivo, 1 describe | ✅ Granular |
| T4: Validar artefato robot-enviar | 1 pipeline, 1 verificação | ✅ Granular |
| T5: Atualizar traceability spec | 1 arquivo, tabela | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | None (início Phase 1) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | Phase 1 → Phase 2, T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Controller | integration | integration | ✅ OK |
| T2 | Robot standalone (job-runner.js) | integration | integration | ✅ OK |
| T3 | Controller (SSE) | integration | integration | ✅ OK |
| T4 | Build pipeline | none | none | ✅ OK |
| T5 | Spec/STATE (entity/config) | none | none | ✅ OK |

---

## Tips

- Phases are ordered - Each phase completes before the next; tasks run in order within a phase
- Reuses = Token saver - Always reference existing code
- Tools per task - MCPs and Skills prevent wrong approaches
- Dependencies are gates - Clear what blocks what
- Done when = Testable - If you can't verify it, rewrite it
- Requirement ID = Traceable - Every task traces back to a spec requirement
- One commit per task - Plan the commit message format in advance

---

## Task Verification Standards

Every task MUST follow the `Done when` + `Tests` + `Gate` fields defined in the **Task Breakdown** template above. Each `Done when` entry must be specific, testable (binary pass/fail), and reference the gate check command from the `Gate Check Commands` section. Include the expected test count to prevent silent deletions.
