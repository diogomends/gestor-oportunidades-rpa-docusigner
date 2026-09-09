# Polimento Transmissão de Logs — Correções Pós-Review Specification

## Problem Statement
O code review da feature `transmissao-logs-sse-integra` (T1-T6) identificou 2 falhas de regressão no mock `updateJobStatus-logs.test.js` (500), duplicação `getLogs()` em `getAllInstances.js` e buffer sem limite em `robot/src/utils/logger.js`. O item God-controller (`robotDocusignController.js` 868L) já foi corrigido fora deste escopo e NÃO deve ser re-executado.

## Goals
- [ ] Corrigir mocks de regressão T3 para `findById().lean()` (gate `test:backend` verde).
- [ ] Deduplicar exposição dual `logs`/`telemetryLogs` em `getAllInstances.js` (ponytail rung 6).
- [ ] Limitar buffer `logger.js` para evitar OOM e marcar débito com `// ponytail:`.

## Out of Scope

| Feature | Reason |
|---|---|
| `robotDocusignController.js` God-controller split | Já corrigido — não executar |
| Persistência Mongo de logs brutos | Decisão LOG spec — efêmero |
| Pipeline 8 etapas Playwright | Fora do escopo de polimento |

## Assumptions & Open Questions

| Assumption | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Correção de teste não altera produção | Mock ajusta para `({lean: async()=>fake})` | Erro é no teste, não no handler | y |
| Cap do logger 500 linhas | FIFO `shift` quando excede | Evita crescimento ilimitado por job longo | y |
| Deduplicação compatível | `const l=getLogs(id); logs:l, telemetryLogs:l` | Mesma referência, sem quebrar contrato | y |

Open questions: none.

## User Stories

### P1: Correção de regressão T3 ⭐ MVP

**User Story**: As a dev, I want `updateJobStatus-logs.test.js` verde so that CI não bloqueie.
**Why P1**: Gate quebrado impede merge.
**Acceptance Criteria**:
1. WHEN `PATCH /instance/job/:jobId/status` com `logs: [...]` THEN system SHALL response 200 e emitir `job:progress` com `logs` idênticos — ubiquitous
2. IF `logs` omitido THEN system SHALL emitir `logs: []` — unwanted-behavior / retrocompat
3. The system SHALL manter `npm run test:backend` com 0 fail em T3
**Independent Test**: `node --env-file=.env.dev --test tests/backend/controllers/updateJobStatus-logs.test.js` 2/2 pass.

### P2: Deduplicação getAllInstances

**User Story**: As a maintainer, I want `getAllInstances.js` sem chamada dupla `getLogs` so that DRY.
**Why P2**: Ponytail rung 6 — menor diff, sem dupla alocação.
**Acceptance Criteria**:
1. WHEN `GET /instances?includeLogs=true` THEN system SHALL retornar `logs` e `telemetryLogs` idênticos com 1 chamada `getLogs` — ubiquitous
2. The system SHALL manter teste `robotInstance-telemetry.test.js` pass
**Independent Test**: `GET /instances?includeLogs=true` retorna ambos iguais; lint ok.

### P3: Cap logger.js

**User Story**: As a ops, I want buffer limitado so that job longo não cause OOM.
**Why P3**: Ponytail — limite + comentário marca upgrade path.
**Acceptance Criteria**:
1. WHILE buffer > 500 entries the system SHALL descartar mais antigo (FIFO) — state-driven
2. The system SHALL conter `// ponytail: unbounded ... cap 500` ou similar — ubiquitous
3. IF `drainJobLogs` THEN system SHALL esvaziar buffer — event-driven
**Independent Test**: `tests/robot/logger-buffer.test.js` continua 3/3 + cap manual.

## Edge Cases
- IF `mock RobotJob.findById` sem `lean` THEN test SHALL falhar — já coberto.
- IF job com >500 logs THEN SHALL manter 500 recentes.
- IF `includeLogs` ausente THEN SHALL omitir ambos.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| POLISH-01 | P1 T3 fix | Tasks | Verified |
| POLISH-02 | P2 dedup | Tasks | Verified |
| POLISH-03 | P3 cap logger | Tasks | Verified |

## Success Criteria
- [ ] `node --env-file=.env.dev --test tests/robot/logger-buffer.test.js tests/robot/job-runner-logs.test.js tests/backend/controllers/updateJobStatus-logs.test.js tests/backend/controllers/streamJobProgress.test.js` 9/9 pass
- [ ] `getAllInstances.js` com 1 `getLogs` call
- [ ] `logger.js` com cap + `// ponytail:` comment
