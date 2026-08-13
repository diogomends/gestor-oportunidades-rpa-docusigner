# Fix: Preenchimento Automático de Token via CEP e Feedback de Erro em Contratos — Implementation Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: Não há design.md — escopo Pequeno (2 arquivos de UI frontend), alterações diretas inline.
**Status**: ✅ Completed

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec (`AGENTS.md`, `package.json`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Frontend UI (cepService) | syntax / manual | `estadoSelect.dispatchEvent` é acionado após `opt.selected = true` | `public/modules/contratos/services/cepService.js` | `node --check public/modules/contratos/services/cepService.js` |
| Frontend UI (contratos.js) | syntax / manual | `window.ui.showToast` é chamado quando token é nulo ou API falha | `public/modules/contratos/contratos.js` | `node --check public/modules/contratos/contratos.js` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Verificação de sintaxe JS (cepService) | `node --check public/modules/contratos/services/cepService.js` |
| Quick | Verificação de sintaxe JS (contratos) | `node --check public/modules/contratos/contratos.js` |

---

## Execution Plan

### Phase 1: Correção e Ajustes no Frontend

```
T1 → Disparo de evento 'change' no select de UF em cepService.js [OK]
T2 → Adição de Toasts de aviso/erro na função resolveTokenForForm em contratos.js [OK]
```

---

## Task Breakdown

### T1: Disparar evento `change` no select de estado (`#cli-estado`) em `cepService.js`

**Status**: ✅ Completed

**What**: Adicionar `estadoSelect.dispatchEvent(new Event('change', { bubbles: true }));` logo após a linha 24 (`opt.selected = true`) na função `searchCEP` do serviço de CEP.
**Where**: `public/modules/contratos/services/cepService.js` (linha ~24)
**Depends on**: None
**Requirement**: TOKEN-CEP-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Após marcar `opt.selected = true`, `estadoSelect.dispatchEvent(new Event('change', { bubbles: true }))` é executado.
- [x] Verificação de sintaxe via `node --check public/modules/contratos/services/cepService.js` passa sem erros.

**Gate**: quick
**Commit**: `fix(contratos): dispatch change event on estadoSelect after CEP lookup`

---

### T2: Adicionar notificações Toast em `resolveTokenForForm` em `contratos.js`

**Status**: ✅ Completed

**What**: Atualizar o bloco de resposta de `resolveTokenForForm` em `public/modules/contratos/contratos.js` para exibir Toast quando `data.token` for nulo ou quando a requisição falhar (`res.ok === false`).
**Where**: `public/modules/contratos/contratos.js` (linhas 230-244)
**Depends on**: T1
**Requirement**: TOKEN-CEP-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Caso `res.ok` seja verdadeiro mas `data.token` seja nulo, o código executa `window.ui.showToast('Nenhum token ativo configurado para esta UF/DDD.', 'error')`.
- [x] Caso `res.ok` seja falso, o código captura o JSON de erro e executa `window.ui.showToast(data?.message || 'Não foi possível resolver o token para esta UF/DDD.', 'error')`.
- [x] Verificação de sintaxe via `node --check public/modules/contratos/contratos.js` passa sem erros.

**Gate**: quick
**Commit**: `feat(contratos): add toast notifications on token resolution failure or empty result`
