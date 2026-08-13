# Sub-spec: Guard Clauses no Config Modal — Implementation Tasks

## Execution Plan

### T2: Guard clauses no config-modal com helpers `setValue`/`setChecked`

**What**: Adicionar helpers `setValue(name, value)` e `setChecked(name, value)` com verificação de existência do elemento e usá-los em `populateForm`; exportar os helpers para teste; criar teste unitário.
**Where**: `public/modules/watchlist/js/ui/config-modal.js`; `tests/config-modal.test.js`
**Depends on**: None
**Requirement**: FRONT-01, FRONT-02

**Done when**:
- [x] `setValue(name, value)` retorna cedo se `document.querySelector(...)` for `null`; senão atribui `.value`.
- [x] `setChecked(name, value)` retorna cedo se o elemento for `null`; senão marca `.checked = true`.
- [x] `populateForm` usa os dois helpers para os 6 campos.
- [x] Teste unitário `tests/config-modal.test.js` cobrindo comportamento com elementos presentes e ausentes.
