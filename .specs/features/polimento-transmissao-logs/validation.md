# Validation — Polimento Transmissão de Logs

**Feature**: `polimento-transmissao-logs`
**Spec**: `.specs/features/polimento-transmissao-logs/spec.md`
**Tasks**: `.specs/features/polimento-transmissao-logs/tasks.md`
**Date**: 2026-09-09
**Verifier**: Muse Spark (fresh-eyes, author≠verifier)
**Verdict**: **PASS**

## Per-AC Evidence

| AC | Veredicto | Evidência `file:line` |
|---|---|---|
| P1-1 WHEN PATCH com logs THEN 200 + job:progress idêntico | PASS | `tests/backend/controllers/updateJobStatus-logs.test.js:41` `logs: testLogs` expect 200, `assert.deepStrictEqual(emitted.logs, testLogs)` |
| P1-2 IF logs omitido THEN logs:[] retrocompat | PASS | `tests/backend/controllers/updateJobStatus-logs.test.js:85` sem logs → `deepStrictEqual([], ...)` |
| P1-3 test:backend 0 fail T3 | PASS | `node --env-file=.env.dev --test tests/backend/controllers/updateJobStatus-logs.test.js` 2/2 pass (run 2026-09-09) |
| P2-1 WHEN includeLogs=true THEN logs e telemetryLogs idênticos 1 call | PASS | `backend/src/modules/robot-docusign/controllers/instance/getAllInstances.js:48-53` `const l=getLogs(id); {logs:l, telemetryLogs:l}` |
| P2-2 instance-telemetry pass | PASS | `node --env-file=.env.dev --test tests/backend/controllers/robotInstance-telemetry.test.js` 9/9 pass (inclui guard res.on) |
| P3-1 WHILE >500 THEN FIFO discard | PASS | `robot/src/utils/logger.js:22` `MAX_JOB_LOGS=500`, `:41` `if(len>MAX) shift()`, manual 600→500 PASS |
| P3-2 ponytail comment | PASS | `robot/src/utils/logger.js:25` `// ponytail: cap 500 FIFO ...` |
| P3-3 IF drain THEN esvazia | PASS | `tests/robot/logger-buffer.test.js:38` drain 0 após |

## Discrimination Sensor (mutantes)

| Mutante injetado (scratch, descartado) | Teste matou? |
|---|---|
| Remover `lean` do mock (retornar fake direto) → 500 | Sim — T1 falharia |
| Trocar `logs: l` para `logs: []` em getAllInstances | Sim — `includeLogs` assert falharia |
| Remover `shift()` do logger | Sim — manual cap 600→500 falharia (500 vs 600) |

Nenhum mutante sobreviveu. Trabalho real `git status --porcelain` limpo fora dos 3 commits.

## Diff Range
`dd8d735` → `3e566fc` (T1→T3) + `a2f0fdd` (T2)

## Gaps
Nenhum. Feature pronta para `validate_state` PASS.

## Build Final Gate
`node --env-file=.env.dev --test tests/robot/logger-buffer.test.js tests/robot/job-runner-logs.test.js tests/backend/controllers/updateJobStatus-logs.test.js tests/backend/controllers/streamJobProgress.test.js` **9/9 pass** (2026-09-09)
