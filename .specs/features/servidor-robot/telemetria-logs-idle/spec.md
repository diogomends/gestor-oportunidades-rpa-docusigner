# Telemetria de Logs em Modo Ocioso (Heartbeat & Scheduler Idle Logs) Specification

## Problem Statement
No robô DocuSign local (rpa-docusigner), mensagens de ciclo do agendador como `[Scheduler] Sem jobs pendentes (Motivo: no_pending_jobs)` são emitidas apenas no stdout local. No painel do Gestor de Oportunidades, operadores com 'Logs na Íntegra' não recebem esses eventos ociosos em tempo real, gerando impressão de delay/desconexão quando não há jobs ativos. Zod (`heartbeatSchema` em `robotInstanceController.js:83`) hoje descarta silenciosamente qualquer campo extra no heartbeat.

## Goals
- [ ] Robô (`.exe`): bufferizar logs de ciclo ocioso e enviar via `telemetryLogs?: string[]` no `POST /api/robot-docusign/instance/heartbeat` a cada 30s.
- [ ] Backend: RingBuffer em memória (100/instância, FIFO) + emissão SSE `instance:telemetry` a cada heartbeat com logs.
- [ ] Consumidor OBRIGATÓRIO: SSE `GET /api/robot-docusign/instances/:instanceId/stream` (tempo real). `GET .../telemetry` e `?includeLogs=true` são apenas fallback/polling inicial.

## Out of Scope
| Feature | Reason |
|---------|--------|
| Persistência MongoDB de logs ociosos | Inchaço de writes (1/30s/robô) para dado efêmero; perda em restart é aceitável |
| WebSocket bidirecional | SSE + polling fallback já é o padrão (REQ-ASYNC-02) |

## User Stories & Acceptance Criteria (EARS)

### P1: Buffer + envio no robô
1. WHEN `scheduler.js:tick()` cai em ciclo ocioso (`disabled`, `outside_hours`, `no_pending_jobs`, `reason` genérico, `contract_missing_pdf_or_email`) THEN o sistema SHALL formatar `[HH:mm:ss] [Scheduler] <msg>` e enfileirar no buffer local (cap 50, FIFO, descarta mais antigo).
2. WHEN `api.sendHeartbeat()` executa (timer 30s em `scheduler.js:33` + transições `busy→idle`) THEN o sistema SHALL enviar `{ ..., telemetryLogs: string[] }` (max 20/heartbeat, cada string max 500 chars) e esvaziar o buffer local SOMENTE em HTTP 2xx.
3. IF o heartbeat falhar (rede) THEN o robô SHALL reter o buffer (cap 50) sem estourar memória.

### P2: Recepção + RingBuffer + SSE no backend
1. WHEN `POST /api/robot-docusign/instance/heartbeat` recebe `telemetryLogs` THEN o controller SHALL validar via Zod (`z.array(z.string().max(500)).max(20).optional()`) e anexar ao RingBuffer da instância (`utils/telemetryBuffer.js`, `Map<instance_id, string[]>`, cap 100 FIFO).
2. WHEN heartbeat válido é persistido THEN o backend SHALL emitir `robotEvents.emit("instance:telemetry", { instanceId, status, lastHeartbeat, logs: [...] })` (só os logs novos do heartbeat, não o buffer cheio).
3. WHEN cliente abre `GET /api/robot-docusign/instances/:instanceId/stream` (auth `protect`, token via `?token=` para EventSource) THEN o servidor SHALL responder `text/event-stream` com handshake `{ instanceId, status, lastHeartbeat, logs: <últimos 100> }` + eventos `instance:telemetry` ao vivo + `: ping` a cada 15s (mesmo padrão de `streamJobProgress`).
4. WHEN `GET /api/robot-docusign/instances/:instanceId/telemetry` é chamado THEN o sistema SHALL retornar `{ instanceId, status, lastHeartbeat, logs: [] }` (fallback polling, `protect+authorize("admin")`).
5. WHEN `GET /api/robot-docusign/instances?includeLogs=true` THEN a resposta SHALL incluir `logs` (últimos 100) por instância; sem o flag, comportamento atual inalterado.

## Rotas (canônicas — lado admin lê, lado robô escreve)
| Método | Rota | Auth | Obs |
|--------|------|------|-----|
| POST | `/api/robot-docusign/instance/heartbeat` | `protect` (JWT robô) | + `telemetryLogs?` opcional, retrocompatível |
| GET | `/api/robot-docusign/instances/:instanceId/stream` | `protect` (`?token=` p/ EventSource) | **consumidor primário**, novo em `routes.js` |
| GET | `/api/robot-docusign/instances/:instanceId/telemetry` | `protect+authorize("admin")` | fallback polling, novo em `routes.js` |
| GET | `/api/robot-docusign/instances?includeLogs=true` | `protect+authorize("admin")` | estende `getAllInstances` |

> NÃO criar sob `/instance/...` para leitura: misturaria auth robô/admin. A duplicata legada `GET /instance/instances` é ignorada.

## Success Criteria
- [ ] Robô envia ≤20 msgs/heartbeat (≤ ~10KB worst-case, típico <6KB) sem log duplicado.
- [ ] Backend: RingBuffer 100/instância FIFO, limpeza de instâncias sem heartbeat >10min.
- [ ] SSE handshake entrega buffer em <50ms; evento ao vivo <1s após heartbeat.
- [ ] `telemetryLogs` ausente → heartbeat legado continua 200 (retrocompat).
