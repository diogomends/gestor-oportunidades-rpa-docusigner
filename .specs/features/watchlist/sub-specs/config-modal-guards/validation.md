# Sub-spec: Guard Clauses no Config Modal — Validation

**Date**: 2026-08-06
**Spec**: `.specs/features/modulo-watchlist/sub-specs/config-modal-guards/spec.md`

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T2 (helpers `setValue`/`setChecked` + `populateForm` + teste unitário) | ✅ Done | `tests/config-modal.test.js` |

## Acceptance Criteria Verification

| Criterion | Result |
| --- | --- |
| P2 AC1: `populateForm(config)` com campo ausente → não lança e preenche só os presentes | ✅ PASS |
| P2 AC2: todos os campos presentes → preenche numéricos + marca radio `sellerFilter` | ✅ PASS |
| P2 AC3: nenhum campo existe → no-op sem erro | ✅ PASS |

## Discrimination Sensor (Mutations)

- M2: `config-modal.js` — remover `if (!el) return;` de `setValue` → ✅ Killed por `tests/config-modal.test.js`
- M3: `config-modal.js` — remover `if (!el) return;` de `setChecked` → ✅ Killed por `tests/config-modal.test.js`
- M4: `config-modal.js` — trocar default `|| 1` → `|| 0` → ✅ Killed por `tests/config-modal.test.js`

## Gate Check

- **Test file**: `tests/config-modal.test.js` (7/7 PASS)
