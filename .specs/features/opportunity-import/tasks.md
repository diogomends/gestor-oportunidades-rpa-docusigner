# Tasks: Ajustes dos Modais de Importação (Remoção do btnStep2Save e Adição de IDs)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

---

**Spec**: `.specs/features/opportunity-import/spec.md`  
**Status**: Approved  

---

## Test Coverage Matrix

> Generated from codebase, project guidelines (AGENTS.md), and spec. Guidelines found: `AGENTS.md`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Frontend HTML / UI Modais | none | Markup & DOM ID verification | `public/import-profiles.html`, `public/modules/import-profile/ui.js` | Build gate / syntax check |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Markup / UI | Yes | Alteração isolada de HTML e manipulação de DOM | Arquivos isolados no frontend |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após alterações em arquivos isolados | `npm test` |
| Full | Validação de fluxo e build | `npm test` |
| Build | Após conclusão das tasks | `npm test` |

---

## Execution Plan

### Phase 1: Limpeza do Botão Salvar no Step 2 (Sequential)

```
T1 ──→ T2
```

### Phase 2: Padronização de IDs nos Modais (Sequential)

```
T2 ──→ T3
```

---

## Task Breakdown

### T1: Remover Bloco do Botão `btnStep2Save` do HTML

**What**: Remover o bloco do botão `btnStep2Save` (linhas ~248-260) no modal de perfil em `public/import-profiles.html`.  
**Where**: `public/import-profiles.html`  
**Depends on**: None  
**Reuses**: N/A  
**Requirement**: [REQ-006]  

**Tools**:
- MCP: NONE
- Skill: `impact-protector`

**Done when**:
- [ ] O bloco HTML do botão `btnStep2Save` foi completamente removido de `public/import-profiles.html`.
- [ ] Nenhuma outra marcação do stepper ou modal foi alterada.

**Tests**: none  
**Gate**: quick  

---

### T2: Remover Referências ao `btnStep2Save` no Módulo `ui.js`

**What**: Remover as referências DOM e lógica de alternância visível de `btnStep2Save` em `public/modules/import-profile/ui.js` (linhas ~73, 95, 122).  
**Where**: `public/modules/import-profile/ui.js`  
**Depends on**: T1  
**Reuses**: Estrutura existente do módulo `ui.js`  
**Requirement**: [REQ-006]  

**Tools**:
- MCP: NONE
- Skill: `impact-protector`

**Done when**:
- [ ] Referências ao elemento `btnStep2Save` removidas sem deixar erros de sintaxe ou referências nulas no JS.
- [ ] O fluxo de navegação do modal (`nextStep`, `prevStep`, `openModal`) continua operante.

**Tests**: none  
**Gate**: quick  

---

### T3: Adicionar IDs nos Elementos dos Modais `profileModal` e `executeModal`

**What**: Adicionar atributos `id` únicos e semânticos a ~30+ elementos sem ID dentro de `profileModal` e `executeModal` (containers, headers, forms, botões, divs, labels, inputs).  
**Where**: `public/import-profiles.html`  
**Depends on**: T1, T2  
**Reuses**: Convenção de nomenclatura de IDs do projeto  
**Requirement**: [REQ-006]  

**Tools**:
- MCP: NONE
- Skill: `impact-protector`

**Done when**:
- [ ] Todos os elementos dos modais `profileModal` e `executeModal` possuem IDs únicos e descritivos.
- [ ] IDs órfãos não referenciados em JS/CSS foram removidos (ex: `profileStep3TeamOptions`, `profileStep3TeamGroup`).
- [ ] Nenhuma classe CSS, atributo de evento ou estrutura de layout legada foi quebrada ou removida.

**Tests**: none  
**Gate**: build  

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2

Phase 2 (Sequential):
  T2 ──→ T3
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Remover btnStep2Save no HTML | 1 arquivo (remoção pontual de bloco) | ✅ Granular |
| T2: Limpar referências no ui.js | 1 arquivo (remoção de 3 linhas JS) | ✅ Granular |
| T3: Adicionar IDs nos modais | 1 arquivo (atribuição de atributos id) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Start | ✅ Match |
| T2 | T1 | T1 ──→ T2 | ✅ Match |
| T3 | T2 | T2 ──→ T3 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Frontend HTML / UI Modais | none | none | ✅ OK |
| T2 | Frontend HTML / UI Modais | none | none | ✅ OK |
| T3 | Frontend HTML / UI Modais | none | none | ✅ OK |
