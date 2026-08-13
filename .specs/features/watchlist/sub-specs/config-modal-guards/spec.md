# Sub-spec: Guard Clauses no Config Modal — Specification

## Problem Statement

`Uncaught (in promise) TypeError: Cannot set properties of null (setting 'value')` em `config-modal.js:56` — A função `populateForm` faz `document.querySelector(...).value = ...` e `.checked = true` sem verificar se o elemento existe no DOM. Quando um campo está ausente (página/modal diferente ou HTML não carregado), `querySelector` retorna `null` e a atribuição lança exceção.

## Goals

- [x] `populateForm` não lançar `TypeError` quando qualquer campo do formulário estiver ausente do DOM.
- [x] Preservar intactos a estrutura HTML e o modal da watchlist.

## Out of Scope

| Feature | Motivo |
| --- | --- |
| Refactor de `populateForm` além do guard clause | Escopo mínimo do bug |
| Alteração do HTML do modal (`dashboard.html`) | Os campos existem; o problema é o JS não tolerar ausência em outras páginas |

---

## User Stories

### P2: `populateForm` tolerante a campos ausentes no DOM

**User Story**: Como usuário admin em qualquer página que importa o módulo watchlist, quero que abrir a configuração da tabela de atenção não quebre com exceção quando algum campo do formulário não existir.

**Acceptance Criteria**:

1. WHEN `populateForm(config)` for chamado com algum campo do formulário ausente do DOM THEN a função SHALL não lançar exceção e SHALL preencher apenas os campos presentes.
2. WHEN todos os campos existirem no DOM THEN a função SHALL preencher os valores numéricos e marcar o radio `sellerFilter` conforme `config`.
3. WHEN nenhum campo existir THEN a função SHALL retornar sem erro (no-op).

---

## Edge Cases

- WHEN o elemento do radio `sellerFilter` não existir THEN o sistema SHALL pular a marcação sem lançar erro.
- WHEN um dos inputs numéricos não existir THEN o sistema SHALL pular a atribuição sem lançar erro.
- WHEN `config.sellerFilter` for `undefined` THEN o sistema SHALL não tentar marcar um radio inexistente.

---

## Requirement Traceability

| Requirement ID | Story | Arquivo Alvo | Status |
| --- | --- | --- | --- |
| FRONT-01 | P2 | `public/modules/watchlist/js/ui/config-modal.js` | ✅ Verified |
| FRONT-02 | P2 | `tests/config-modal.test.js` | ✅ Verified |
