# Feature Tasks: Segregação de Dois Robôs (Consulta e Atualização)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/robot/dois-robos-consulta-atualizacao/spec.md`  
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| :--- | :--- | :--- | :--- | :--- |
| Model / Schema | none | Schema validation and index correctness (build gate) | `backend/src/modules/robot-docusign/models/*.js` | build gate only |
| Controller / API | unit | 1:1 AC mapping for role filtering, error cases, and fallback | `test/backend/**/*.test.js` | `npm run test:backend` |
| Client Config / Runner | unit | Verification of role parsing, session resolution, and execution branch | `test/robot/**/*.test.js` | `npm run test:robot` |
| Build Pipeline | none | Artifact existence and integrity validation (build gate) | `robot/build/*.js` | build gate only |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| :--- | :--- | :--- |
| Quick | After tasks with unit tests only | `npm run test:backend` (ou `npm run test:robot`) |
| Full | After controller/integration changes | `npm test` |
| Build | After phase completion or build pipeline tasks | `npm run build:robot` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Database & Model Foundation

```
T1 -> T2
```

### Phase 2: Backend Orchestration & Filtering

```
T3 -> T4
```

### Phase 3: Robot Client Configuration & Segregation

```
T5 -> T6 -> T7
```

### Phase 4: Build Pipeline & Automation

```
T8 -> T9
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
- [ ] Campo `role` adicionado ao schema com enum `["query", "update", "all"]` e default `"all"`.
- [ ] JSDoc completo adicionado ao typedef e export do model.
- [ ] Gate check passes: build gate

**Tests**: none  
**Gate**: build  
**Commit**: `feat(models): add role field to RobotInstance schema`

---

### T2: Indexação e Tipagem de Actions em RobotJob

**What**: Revisar e assegurar indexação de `action` e `status` no schema de `RobotJob`.  
**Where**: `backend/src/modules/robot-docusign/models/RobotJob.js`  
**Depends on**: T1  
**Reuses**: Índices existentes no Mongoose  
**Requirement**: ROB2-01  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Índices compostos de `{ status: 1, action: 1, createdAt: 1 }` verificados/adicionados.
- [ ] JSDoc completo atualizado.
- [ ] Gate check passes: build gate

**Tests**: none  
**Gate**: build  
**Commit**: `feat(models): optimize action and status indexing in RobotJob`

---

### Phase 2: Backend Orchestration & Filtering

### T3: Filtragem de Jobs por Role em getNextJob

**What**: Atualizar o método `getNextJob` para entregar apenas jobs correspondentes ao `role` da instância solicitante.  
**Where**: `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`  
**Depends on**: None  
**Reuses**: `robotInstanceController.js` logic  
**Requirement**: ROB2-02  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Se `instance.role === 'query'`, busca apenas jobs com `action` em `['query_agreements', 'status']`.
- [ ] Se `instance.role === 'update'`, busca apenas jobs com `action` em `['send']`.
- [ ] Se `instance.role === 'all'` ou indefinido, mantém comportamento de retornar qualquer job pendente.
- [ ] Testes unitários cobrem todos os 3 cenários de filtro.
- [ ] Gate check passes: `npm run test:backend`

**Tests**: unit  
**Gate**: quick  
**Commit**: `feat(controller): filter pending jobs by instance role in getNextJob`

---

### T4: Registro de Role na Autenticação e Heartbeat

**What**: Persistir e atualizar o `role` da instância durante o handshake de autenticação e heartbeat.  
**Where**: `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js`  
**Depends on**: T3  
**Reuses**: Rotas de instância do Express  
**Requirement**: ROB2-02  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Endpoint `/instance/auth` e `/instance/heartbeat` aceitam e persistem `role` no banco.
- [ ] JSDoc completo atualizado.
- [ ] Gate check passes: `npm run test:backend`

**Tests**: unit  
**Gate**: quick  
**Commit**: `feat(routes): capture and persist instance role on auth and heartbeat`

---

### Phase 3: Robot Client Configuration & Segregation

### T5: Suporte a ROBOT_ROLE e Sessões Isoladas no Config

**What**: Adicionar resolução de `ROBOT_ROLE` e caminho de sessão específico por papel no robô standalone.  
**Where**: `robot/src/config.js`  
**Depends on**: None  
**Reuses**: `config.js` loader  
**Requirement**: ROB2-03  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `loadConfig` suporta `ROBOT_ROLE` (`query` ou `update`), atribuindo arquivos de sessão dedicados (`session-query.json` / `session-update.json`).
- [ ] JSDoc completo atualizado.
- [ ] Gate check passes: `npm run test:robot`

**Tests**: unit  
**Gate**: quick  
**Commit**: `feat(robot-config): support ROBOT_ROLE and dedicated session storage paths`

---

### T6: Isolamento de Execução de Rotinas no JobRunner

**What**: Desacoplar a execução de rotinas de envio e consulta no JobRunner, validando permissão de execução por papel.  
**Where**: `robot/src/job-runner.js`  
**Depends on**: T5  
**Reuses**: `job-runner.js` pipeline  
**Requirement**: ROB2-05  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] JobRunner valida se a ação recebida é compatível com o papel configurado na inicialização.
- [ ] Métodos de execução desacoplados respeitando SOLID/SRP.
- [ ] Testes unitários cobrem execução e bloqueio de ações não compatíveis.
- [ ] Gate check passes: `npm run test:robot`

**Tests**: unit  
**Gate**: quick  
**Commit**: `refactor(job-runner): isolate query and update execution pipelines`

---

### T7: Entrypoints Dedicados de Inicialização

**What**: Criar entrypoints especializados e unificar bootstrap com seleção dinâmica de papel.  
**Where**: `robot/src/main.js`  
**Depends on**: T6  
**Reuses**: `main.js` bootstrap  
**Requirement**: ROB2-04  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `main.js` detecta flag CLI `--role` ou variável `ROBOT_ROLE` e inicializa o runner correspondente.
- [ ] JSDoc completo atualizado.
- [ ] Gate check passes: `npm run test:robot`

**Tests**: unit  
**Gate**: quick  
**Commit**: `feat(robot): implement specialized bootstrap entrypoints by role`

---

### Phase 4: Build Pipeline & Automation

### T8: Parametrização do Pipeline de Build no build.js

**What**: Adaptar o pipeline de empacotamento para gerar executáveis distintos para cada papel.  
**Where**: `robot/build/build.js`  
**Depends on**: None  
**Reuses**: Pipeline esbuild + bytenode + pkg existente  
**Requirement**: ROB2-06  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `build.js` aceita `--role=query`, `--role=update` ou constrói ambos em `dist/robot-query/` e `dist/robot-update/`.
- [ ] JSDoc completo atualizado.
- [ ] Gate check passes: build gate

**Tests**: none  
**Gate**: build  
**Commit**: `feat(build): support role-targeted binary compilation for query and update`

---

### T9: Configuração de Scripts NPM e Makefile

**What**: Adicionar scripts de automação de build para geração dos robôs especializados.  
**Where**: `robot/package.json`  
**Depends on**: T8  
**Reuses**: Scripts existentes no `package.json`  
**Requirement**: ROB2-07  

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Adicionados scripts `build:robot:query`, `build:robot:update` e `build:robot:all`.
- [ ] Gate check passes: build gate

**Tests**: none  
**Gate**: build  
**Commit**: `chore(build): register npm scripts for dual robot compilation`

---

## Phase Execution Map

```
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4

Phase 1:  T1 -> T2
Phase 2:  T3 -> T4
Phase 3:  T5 -> T6 -> T7
Phase 4:  T8 -> T9
```

---

## Task Granularity Check

| Task | Scope | Status |
| :--- | :--- | :--- |
| T1: Modelagem do Campo Role em RobotInstance | 1 model | ✅ Granular |
| T2: Indexação e Tipagem de Actions em RobotJob | 1 model | ✅ Granular |
| T3: Filtragem de Jobs por Role em getNextJob | 1 controller | ✅ Granular |
| T4: Registro de Role na Autenticação e Heartbeat | 1 route file | ✅ Granular |
| T5: Suporte a ROBOT_ROLE e Sessões Isoladas no Config | 1 config file | ✅ Granular |
| T6: Isolamento de Execução de Rotinas no JobRunner | 1 runner class | ✅ Granular |
| T7: Entrypoints Dedicados de Inicialização | 1 entrypoint | ✅ Granular |
| T8: Parametrização do Pipeline de Build no build.js | 1 build script | ✅ Granular |
| T9: Configuração de Scripts NPM e Makefile | 1 package manifest | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| :--- | :--- | :--- | :--- |
| T1 | None | None | ✅ Match |
| T2 | T1 | T1 -> T2 | ✅ Match |
| T3 | None | None | ✅ Match |
| T4 | T3 | T3 -> T4 | ✅ Match |
| T5 | None | None | ✅ Match |
| T6 | T5 | T5 -> T6 | ✅ Match |
| T7 | T6 | T6 -> T7 | ✅ Match |
| T8 | None | None | ✅ Match |
| T9 | T8 | T8 -> T9 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| :--- | :--- | :--- | :--- | :--- |
| T1 | Model / Schema | none | none | ✅ OK |
| T2 | Model / Schema | none | none | ✅ OK |
| T3 | Controller / API | unit | unit | ✅ OK |
| T4 | Controller / API | unit | unit | ✅ OK |
| T5 | Client Config / Runner | unit | unit | ✅ OK |
| T6 | Client Config / Runner | unit | unit | ✅ OK |
| T7 | Client Config / Runner | unit | unit | ✅ OK |
| T8 | Build Pipeline | none | none | ✅ OK |
| T9 | Build Pipeline | none | none | ✅ OK |
