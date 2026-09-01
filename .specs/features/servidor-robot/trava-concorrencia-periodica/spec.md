# Trava de Concorrencia e Execucao Periodica (AD-045)

## Problem Statement
Evitar execucoes sobrepostas do Playwright quando varredura demora mais que intervalo ou quando POST /sync-status eh disparado concorrentemente, prevenindo invalidacao de sessao DocuSign e race no MongoDB.

## Requisitos

### REQ-TRAVA-01 — Bloqueio atomico em memoria
- `let isRunning = false` em `statusSyncScheduler.js`; checagem antecipada retorna `{status:"busy", reason:"already_running"}`.
- Liberacao garantida em `try...finally { isRunning=false; }`
- Helper exportado `isStatusSyncRunning()` para consulta.

### REQ-TRAVA-02 — Intervalo parametrizado
- `schedule.intervalMinutes` de 5 a 30 minutos (default 5 — AD-052). Override via SystemConfig `key:robot_docusign`.
- `statusSyncScheduler.start()` registra `setTimeout` inicial + `setInterval`; `stop()` limpa `initialTimeoutId` e interval (AD-047 leak fix).
- `robotScheduler` similar para fila de jobs (quando aplicavel).

### REQ-TRAVA-03 — Endpoint sob demanda
- `POST /api/robot-docusign/sync-status` (protect+admin, AD-049) respeita mesma trava; retorna 500 em falha operacional, 200 busy se ja rodando.
- `GET /health` e `GET /queue` nao bloqueiam.

## Criterios (EARS)
- WHEN sync ja isRunning THEN SHALL retornar busy sem abrir browser.
- WHEN sync finaliza (success ou throw) THEN SHALL isRunning=false no finally.
- WHEN intervalo configurado 5-30 THEN SHALL agendar proxima varredura conforme SystemConfig.
- WHEN stop() chamado THEN SHALL limpar timeout/interval pendentes (AD-047).

## Trace
AD-045, AD-047, AD-049 (RBAC + 500), AD-052 (default 5). Implementado em seletorApiRobot/statusSyncScheduler.js, routes.js.
