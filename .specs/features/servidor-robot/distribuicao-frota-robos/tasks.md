# Frota Distribuição Robôs Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/servidor-robot/distribuicao-frota-robos/spec.md`
**Status**: Completed

---

## Requirements Basis (aprovado em chat, a formalizar em spec.md)

| ID | Requisito |
| :--- | :--- |
| FROTA-01 | Confirmação de upload no `.exe` usa seletores Playwright válidos e só declara sucesso após evidência visual real |
| FROTA-02 | `POST /trigger` apenas enfileira `RobotJob pending` e responde `202` com o `jobId` real (sem fallback para `contractId`) |
| FROTA-03 | Servidor não executa `send` inline competindo com a frota; `robotScheduler` só age como fallback sem robô `update` vivo |
| FROTA-04 | `PATCH /instance/job/:jobId/status` e lock em `getNextJob` emitem progresso para o SSE da UI acompanhar jobs do `.exe` |
| FROTA-05 | `completed` de `send` exige `envelopeId` UUID válido; sem ele o job falha e o contrato reverte (anti-fantasma) |
| FROTA-06 | `GET /instances` expõe `alive` (heartbeat 90s) por role para o operador ver a frota ativa |
| FROTA-07 | `update` é o valor canônico de protocolo; `enviar` é alias aceito na borda (CLI/build) e normalizado para `update` |
| FROTA-08 | Decisão registrada (AD-067) e topologia da frota documentada no `AGENTS.md` |

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md` (testes nativos `node --test` em `tests/`, com restrição "Não rodar sem ser solicitado") + diretriz explícita do usuário "sem testes unitarios" para esta feature.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| :--- | :--- | :--- | :--- | :--- |
| Robot step (Playwright) | none | Verificação por runbook manual: seletor válido + confirmação visual real (usuário vetou testes unitários) | `robot/src/browser/steps/*.js` | runbook manual |
| Controller / API | none | Verificação por runbook manual: `202` + `jobId` real, SSE até terminal, sem fallback (usuário vetou testes unitários) | `backend/src/modules/robot-docusign/controllers/*.js` | runbook manual |
| Scheduler / Orchestrator | none | Verificação por runbook manual: sem execução inline com frota viva; fallback só sem robô ativo (usuário vetou testes unitários) | `backend/src/modules/robot-docusign/seletorApiRobot/*.js` | runbook manual |
| Build Pipeline | none | Existência e integridade de artefatos (build gate) | `robot/build/*.js` | `npm run build:robot` |
| Docs / Specs | none | - (build gate only) | `.specs/**`, `AGENTS.md` | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| :--- | :--- | :--- |
| Quick | Após cada task de código (sintaxe + JSDoc) | `node --check <arquivo>` |
| Full | Após cada fase (runbook manual da frota) | Runbook: 2 `.exe` vivos → trigger → SSE até `completed`/`failed`; matar `enviar` → `queued` com aviso |
| Build | Após task de build e ao fim das fases | `npm run build:robot` + `make routes-inventory-check` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Correção crítica upload (.exe)

```
T1
```

### Phase 2: Trigger enfileirador (fim do inline competidor)

```
T2 -> T3
T2 -> T4
```

### Phase 3: Progresso unificado + anti-fantasma

```
T5 -> T6 -> T7
```

### Phase 4: Roles canônicos + alias enviar

```
T8 -> T9
T10
```

### Phase 5: Documentação da decisão

```
T11 -> T12
```

---

## Task Breakdown

### T1: Corrigir confirmação pós-upload no robô standalone

**What**: Trocar o locator misto inválido por race de dois locators Playwright válidos com escape de regex no prefixo do nome
**Where**: `robot/src/browser/steps/uploadStep.js`
**Depends on**: None
**Reuses**: `randomDelay`, `captureDebugScreenshot` de `stepUtils.js`
**Requirement**: FROTA-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Nenhum locator mistura engine CSS com `text=/.../`
- [x] `namePrefix` escapa caracteres de regex antes de uso em texto
- [x] Log registra qual ramo confirmou (card por atributo ou texto)
- [x] Falha real ainda captura screenshot `upload_process_fail` e lança erro
- [x] Gate check passes: `node --check` no arquivo

**Tests**: none
**Gate**: quick

**Commit**: `fix(robot): confirmação pós-upload com locators válidos`

---

### T2: Criar enfileiramento de send no orquestrador

**What**: Adicionar função que cria `RobotJob` com `status pending` (sem executar inline) e retorna o `jobId` criado
**Where**: `backend/src/modules/robot-docusign/seletorApiRobot/index.js`
**Depends on**: None
**Reuses**: Modelo `RobotJob`, `emitProgress`, `getRobotConfig` existentes no módulo
**Requirement**: FROTA-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Job criado com `status pending`, `action`, `contract_id`, `originalStatus`, `created_by`
- [x] Emite progresso inicial para o SSE
- [x] Nenhum browser é lançado por esta função
- [x] Gate check passes: `node --check` no arquivo

**Tests**: none
**Gate**: quick

**Commit**: `feat(robot): enfileira job de send sem execução inline`

---

### T3: POST trigger responde 202 com jobId real

**What**: Trocar execução síncrona por enfileiramento via T2, sem fallback de `jobId` para `contractId`
**Where**: `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`
**Depends on**: T2
**Reuses**: Função de enfileiramento criada em T2
**Requirement**: FROTA-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Resposta `202` contém sempre o `_id` real do job criado
- [x] Nenhum caminho retorna `contractId` no campo `jobId`
- [x] Erro de validação mantém `400` com `error` + `message`
- [x] Gate check passes: `node --check` no arquivo

**Tests**: none
**Gate**: quick

**Commit**: `feat(robot): trigger de send retorna 202 com jobId real`

---

### T4: Scheduler só executa send como fallback sem robô vivo

**What**: Pular processamento inline quando houver instância `update`/`all` com heartbeat recente; só executar inline como fallback
**Where**: `backend/src/modules/robot-docusign/seletorApiRobot/robotScheduler.js`
**Depends on**: T2
**Reuses**: Modelo `RobotInstance` (`role`, `last_heartbeat`) e `getRobotConfig`
**Requirement**: FROTA-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Com robô `update`/`all` vivo (heartbeat < 90s), retorna `skipped` com motivo `fleet_active`
- [x] Sem robô vivo, mantém comportamento atual de processamento
- [x] Ignora `query_agreements`/`reports` como hoje
- [x] Gate check passes: `node --check` no arquivo

**Tests**: none
**Gate**: quick

**Commit**: `feat(robot): scheduler de send só como fallback da frota`

---

### T5: Emitir progresso do .exe para o SSE

**What**: Emitir `emitProgress`/`robotEvents` ao travar job em `getNextJob` e a cada `updateJobStatus`
**Where**: `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
**Depends on**: None
**Reuses**: `emitProgress` e `robotEvents` de `seletorApiRobot/index.js`
**Requirement**: FROTA-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Lock em `getNextJob` emite evento com `locked_by` e role da instância
- [x] Cada `updateJobStatus` emite o job atualizado (inclui `steps`)
- [x] Nenhum ciclo de import é criado com o orquestrador
- [x] Gate check passes: `node --check` no arquivo

**Tests**: none
**Gate**: quick

**Commit**: `feat(robot): progresso do .exe chega ao SSE da UI`

---

### T6: Expor frota viva por role

**What**: Incluir flag `alive` por instância (heartbeat < 90s) na listagem de instâncias
**Where**: `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
**Depends on**: T5
**Reuses**: Agregação `instances_by_role` já existente no módulo
**Requirement**: FROTA-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Cada instância retorna `alive: true/false` por `last_heartbeat`
- [x] Agregado por role preservado
- [x] Gate check passes: `node --check` no arquivo

**Tests**: none
**Gate**: quick

**Commit**: `feat(robot): listagem de instâncias expõe robôs vivos`

---

### T7: Exigir envelopeId em completed de send

**What**: Rejeitar `completed` de `send`/`resend` sem `envelopeId` UUID válido, revertendo o contrato
**Where**: `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
**Depends on**: T6
**Reuses**: Reversão para `originalStatus`/`gerado` já existente no módulo
**Requirement**: FROTA-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `completed` sem UUID válido vira `failed` com erro explicativo
- [x] Contrato reverte para status original pré-lock
- [x] `query_agreements` e `download` mantêm reconciliação atual
- [x] Gate check passes: `node --check` no arquivo

**Tests**: none
**Gate**: quick

**Commit**: `fix(robot): completed de send exige envelopeId válido`

---

### T8: Criar utilitário canônico de roles

**What**: Criar módulo único com `ROLE_ENUM`, `ROLE_ACTIONS` e `isActionAllowedForRole`
**Where**: `backend/src/modules/robot-docusign/utils/roleActions.js`
**Depends on**: None
**Reuses**: Mapeamento já validado (`query` leitura, `update` escrita, `all` tudo)
**Requirement**: FROTA-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Exporta `ROLE_ENUM`, `ROLE_ACTIONS`, `getAllowedActions`, `isActionAllowedForRole`
- [x] JSDoc completo com `@constant` e `@type`
- [x] Sem dependência de modelos (importável sem ciclo)
- [x] Gate check passes: `node --check` no arquivo

**Tests**: none
**Gate**: quick

**Commit**: `feat(robot): utilitário canônico de roles da frota`

---

### T9: Controlador consome roles canônicos

**What**: Trocar o mapa inline de roles pelo utilitário de T8 no distribuidor de jobs
**Where**: `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
**Depends on**: T8
**Reuses**: Utilitário criado em T8
**Requirement**: FROTA-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Nenhum mapa de roles duplicado permanece no controlador
- [x] Filtro por role em `getNextJob` preserva comportamento
- [x] `400 role inválido` preservado
- [x] Gate check passes: `node --check` no arquivo

**Tests**: none
**Gate**: quick

**Commit**: `refactor(robot): distribuidor usa roles canônicos`

---

### T10: Aceitar alias enviar na borda do build

**What**: Normalizar `--role=enviar` para `update` no parse de argumentos, mantendo o valor de protocolo
**Where**: `robot/build/build.js`
**Depends on**: None
**Reuses**: Normalização de artefato `update→enviar` já existente no módulo
**Requirement**: FROTA-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `--role=enviar` gera o mesmo artefato que `--role=update`
- [x] `ROBOT_ROLE` embutido permanece `update`
- [x] `--role` inválido continua rejeitado
- [x] Gate check passes: `npm run build:robot` (build gate)

**Tests**: none
**Gate**: build

**Commit**: `feat(robot): alias enviar normalizado para update no build`

---

### T11: Registrar AD-067 e handoff

**What**: Documentar decisão da frota (trigger-enfileira, SSE unificado, alias) e snapshot de handoff
**Where**: `.specs/STATE.md`
**Depends on**: None
**Reuses**: Padrão das ADs anteriores no arquivo
**Requirement**: FROTA-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] AD-067 com Decision, Reason, Trade-off, Scope, Date e Status
- [x] Handoff com phase, completed, next step e branch
- [x] Gate check passes: build gate only (sem código)

**Tests**: none
**Gate**: build

**Commit**: `docs(specs): registra AD-067 da frota de robôs`

---

### T12: Documentar topologia da frota

**What**: Descrever 2 robôs por máquina, distribuição por pull e alias de papel no guia de operação
**Where**: `AGENTS.md`
**Depends on**: T11
**Reuses**: Seções de Arquitetura e Comandos já existentes no arquivo
**Requirement**: FROTA-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Topologia `robot-enviar-N` + `robot-query-N` descrita
- [x] Alias `enviar→update` documentado
- [x] Sem alterar comandos existentes
- [x] Gate check passes: build gate only (sem código)

**Tests**: none
**Gate**: build

**Commit**: `docs(agents): topologia da frota de 2 robôs`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1:  T1
Phase 2:  T2 ------→ T3
          T2 ------→ T4
Phase 3:  T5 ------→ T6 ------→ T7
Phase 4:  T8 ------→ T9
          T10
Phase 5:  T11 ------→ T12
```

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order.

**How phase-based execution works:**

At Execute, the agent counts total tasks and packs phases into **task-budgeted batches** (~7 tasks
per worker, whole phases - the benchmarked sweet spot is ~20 tasks → ~3 workers). A **phase** is the
semantic/dependency unit; a **batch** is one or more *consecutive whole phases* assigned to one
worker. The cut only ever lands on a phase boundary - a phase is never split across workers.

When the whole feature fits a single batch (≤ ~8 tasks), execution happens inline in the main window
with no sub-agents spawned. **Esta feature tem 12 tasks → cabe em ~2 batches; a oferta de sub-agentes será feita antes do Execute, com confirmação do usuário.**

---

## Task Granularity Check

| Task | Scope | Status |
| :--- | :--- | :--- |
| T1: fix confirmação upload | 1 arquivo, 1 função | ✅ Granular |
| T2: função enfileirar send | 1 arquivo, 1 função | ✅ Granular |
| T3: trigger 202 | 1 arquivo, 1 handler | ✅ Granular |
| T4: scheduler fallback | 1 arquivo, 1 função | ✅ Granular |
| T5: emite progresso .exe | 1 arquivo, 2 pontos coesos | ✅ Granular |
| T6: flag alive instâncias | 1 arquivo, 1 handler | ✅ Granular |
| T7: guard envelopeId | 1 arquivo, 1 branch | ✅ Granular |
| T8: util roles | 1 arquivo novo | ✅ Granular |
| T9: consome roles | 1 arquivo, 1 troca | ✅ Granular |
| T10: alias enviar | 1 arquivo, 1 função | ✅ Granular |
| T11: AD-067 + handoff | 1 arquivo | ✅ Granular |
| T12: topologia AGENTS | 1 arquivo | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| :--- | :--- | :--- | :--- |
| T1 | None | nó isolado fase 1 | ✅ Match |
| T2 | None | origem das setas fase 2 | ✅ Match |
| T3 | T2 | T2 -> T3 | ✅ Match |
| T4 | T2 | T2 -> T4 | ✅ Match |
| T5 | None | origem da cadeia fase 3 | ✅ Match |
| T6 | T5 | T5 -> T6 | ✅ Match |
| T7 | T6 | T6 -> T7 | ✅ Match |
| T8 | None | origem da seta fase 4 | ✅ Match |
| T9 | T8 | T8 -> T9 | ✅ Match |
| T10 | None | nó isolado fase 4 | ✅ Match |
| T11 | None | origem da seta fase 5 | ✅ Match |
| T12 | T11 | T11 -> T12 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| :--- | :--- | :--- | :--- | :--- |
| T1: uploadStep | Robot step | none | none | ✅ OK |
| T2: orchestrator | Scheduler/Orchestrator | none | none | ✅ OK |
| T3: triggerJob | Controller/API | none | none | ✅ OK |
| T4: robotScheduler | Scheduler/Orchestrator | none | none | ✅ OK |
| T5: instância status | Controller/API | none | none | ✅ OK |
| T6: instâncias | Controller/API | none | none | ✅ OK |
| T7: guard envelopeId | Controller/API | none | none | ✅ OK |
| T8: roleActions | Scheduler/Orchestrator | none | none | ✅ OK |
| T9: consome roles | Controller/API | none | none | ✅ OK |
| T10: build alias | Build Pipeline | none | none | ✅ OK |
| T11: STATE.md | Docs/Specs | none | none | ✅ OK |
| T12: AGENTS.md | Docs/Specs | none | none | ✅ OK |

---

## Tips

- **Phases are ordered** - Each phase completes before the next; tasks run in order within a phase
- **Reuses = Token saver** - Always reference existing code
- **Tools per task** - MCPs and Skills prevent wrong approaches
- **Dependencies are gates** - Clear what blocks what
- **Done when = Testable** - If you can't verify it, rewrite it
- **Requirement ID = Traceable** - Every task traces back to FROTA-01..FROTA-08
- **One commit per task** - Commit message planejada em cada task
