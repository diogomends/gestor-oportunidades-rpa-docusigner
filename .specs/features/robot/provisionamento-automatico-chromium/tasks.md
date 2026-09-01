# Robot Auto-Provision Chromium Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/robot-auto-provision-chromium/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md` (node --test nativo, mocks em node:test).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Provisioner Service | unit | 1:1 mapping to spec ACs (existing browser vs missing browser vs download error) | `robot/src/browser/__test__/*.test.js` | `node --test` |
| Main Boot Orchestration | unit | Verification of pre-boot call before scheduler startup | `robot/src/__test__/*.test.js` | `node --test` |
| Build & Packaging Script | none | Manual verification (gera executável .exe) | `robot/build/build.js` | manual |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit | Yes | per-test mock / fs mock | `robot/src/` (isolado sem shared state) |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `cd robot && npm test` |
| Full | After core integration | `cd robot && npm test` |
| Build | After phase completion | `cd robot && npm run build` |

---

## Execution Plan

### Phase 1: Provisioner Module (Sequential)
Criação do módulo dedicado de detecção e instalação do Chromium.

```
T1 → T2
```

### Phase 2: Runtime Integration & Packaging (Sequential)
Integração no ciclo de boot do robô e validação do pipeline de build.

```
T2 → T3 → T4
```

---

## Task Breakdown

### T1: Criar módulo chromiumProvisioner.js com detecção de binário

**What**: Implementar função `isChromiumInstalled()` e rotina de resolução de executável do Playwright.
**Where**: `robot/src/browser/chromiumProvisioner.js`
**Depends on**: None
**Reuses**: `playwright` / `playwright-core` executable resolution
**Requirement**: [PROV-01]

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Função `isChromiumInstalled()` implementada com JSDoc completo.
- [ ] Retorna `true` e o path quando o executável existir no filesystem local.
- [ ] Retorna `false` de forma segura sem lançar exceção se a pasta ou binário não existirem.
- [ ] Testes unitários cobrindo cenários com e sem Chromium existente.
- [ ] Gate check passa: `cd robot && npm test`.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(robot): add chromium detection utility in browser provisioner`

---

### T2: Implementar rotina de auto-download e tratamento de erro no provisioner

**What**: Implementar função `ensureChromiumInstalled({ logger })` que aciona download silencioso e gerencia erros de conectividade.
**Where**: `robot/src/browser/chromiumProvisioner.js`
**Depends on**: T1
**Reuses**: `child_process.execFile` ou API CLI do Playwright
**Requirement**: [PROV-02], [PROV-03]

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Função `ensureChromiumInstalled()` implementada com JSDoc completo.
- [ ] Se o Chromium não existir, dispara a rotina de download com feedback no console.
- [ ] Trata erros de rede/timeout lançando erro amigável e logando no arquivo de log.
- [ ] Testes unitários mockando cenários de sucesso no download e falha de rede.
- [ ] Gate check passa: `cd robot && npm test`.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(robot): add automatic chromium download routine with error handling`

---

### T3: Integrar ensureChromiumInstalled no boot do robô

**What**: Chamar `ensureChromiumInstalled()` no início de `main.js` antes de iniciar polling e sessões.
**Where**: `robot/src/main.js`
**Depends on**: T2
**Reuses**: `robot/src/main.js` (fluxo de boot existente)
**Requirement**: [PROV-01], [PROV-02]

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `main.js` aguarda a resolução de `ensureChromiumInstalled()` antes de autenticar na API.
- [ ] Se o provisionamento falhar, exibe mensagem clara no console e encerra o processo com código 1.
- [ ] JSDoc atualizado na função de inicialização.
- [ ] Testes unitários do ciclo de boot atualizados.
- [ ] Gate check passa: `cd robot && npm test`.

**Tests**: unit
**Gate**: quick

**Commit**: `feat(robot): integrate chromium auto-provisioning into main startup lifecycle`

---

### T4: Atualizar scripts de build e documentação do robô

**What**: Ajustar `build.js` e documentação para considerar o auto-provisionamento em runtime.
**Where**: `robot/build/build.js` e `robot/README.md`
**Depends on**: T3
**Reuses**: `robot/build/build.js`
**Requirement**: [PROV-G1], [PROV-G2]

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `build.js` gera o bundle com todas as dependências necessárias empacotadas para o provisioner.
- [ ] `robot/README.md` atualizado indicando que o executável auto-instala o Chromium na primeira execução.
- [ ] Gate check passa: `cd robot && npm run build`.

**Tests**: none
**Gate**: build

**Commit**: `docs(robot): update build script and readme with auto-provisioning details`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2

Phase 2 (Sequential):
  T2 ──→ T3 ──→ T4
```

**Parallelism constraint:** Todas as tarefas são sequenciais — cada uma constrói a fundação para a seguinte.

---

## Task Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T1: Detecção de Chromium | 1 arquivo, 1 função utilitária + testes | ✅ Granular |
| T2: Auto-download e resiliência | 1 arquivo, 1 rotina de download + testes | ✅ Granular |
| T3: Integração no boot | 1 arquivo, chamada no startup | ✅ Granular |
| T4: Build script & docs | 2 arquivos, ajuste de build e documentação | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|------|-------------------|---------------|--------|
| T1 | None | T1 → T2 | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Provisioner Service | unit | unit | ✅ OK |
| T2 | Provisioner Service | unit | unit | ✅ OK |
| T3 | Main Boot Orchestration | unit | unit | ✅ OK |
| T4 | Build & Packaging Script | none | none | ✅ OK |
