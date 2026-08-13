# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation — do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 — Módulo novo sem testes = mutantes sobrevivem. Antes de mover código de produção para módulo novo, crie ao menos 1 teste por AC que o exercite. Caso contrário a refatoração quebra silenciosamente.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `notificacoes-internas,testing` · harmful: 0
- features: notificacoes-internas
- evidence: validation: mutated mailService guard clause 'if (!t) return;', 0 tests killed it (notificacoes-internas,testing)
- last seen: 2026-07-18T16:42:22Z

### L-002 — Assert the full spec-defined contract (including projections like select('-senha')) even when it pre-exists in the diff, not just the values the mock happens to return
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `middleware` · harmful: 0
- features: auth-middleware
- evidence: AC3 (tests/auth-middleware-orphan-user.test.js:85-87) (middleware)
- last seen: 2026-08-06T15:37:32Z

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
