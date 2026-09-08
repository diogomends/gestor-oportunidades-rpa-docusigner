# Validation: Telemetria de Logs em Modo Ocioso

| ID | Critério | Status | Evidência |
|----|----------|--------|-----------|
| TEL-01 | Heartbeat sem `telemetryLogs` continua 200 (retrocompat) | ✅ Aprovado | `tests/backend/controllers/robotInstance-telemetry.test.js` — heartbeat legado 200 |
| TEL-02 | Zod rejeita >20 msgs (400) | ✅ Aprovado | `tests/backend/controllers/robotInstance-telemetry.test.js` — 21 msgs → 400 |
| TEL-03 | RingBuffer FIFO cap 100/instância + cópia defensiva + pruneIdle | ✅ Aprovado | push 120 → últimas 100 em ordem; mutação da cópia não afeta; pruneIdle limpa >10min |
| TEL-04 | SSE handshake entrega buffer | ✅ Aprovado | `streamInstanceTelemetry` direto — `writes[0]` contém buffer |
| TEL-05 | Evento `instance:telemetry` ao vivo filtrado por instanceId | ✅ Aprovado | emit outra instância não vaza; mesma instância chega |
| TEL-06 | Robô: flush esvazia só em 2xx, retém em falha, cap 50 FIFO; sendHeartbeat fatia 20×500 | ✅ Aprovado | `tests/robot/scheduler-telemetry.test.js` 5/5 |
| TEL-07 | Consumidor primário é SSE (`/instances/:id/stream`); `GET /telemetry` e `?includeLogs` são fallback | ✅ Aprovado | rotas em `routes.js:41-43` + `?token=` via `protect`; runbook abaixo |
| TEL-08 | Resiliência SSE contra desconexão prematura de cliente (sem memory leak) | ✅ Aprovado | teste de encerramento limpo sem registro fantasma no `robotEvents` |

## Runbook manual (frota)
1. Subir backend + abrir `GET /api/robot-docusign/instances/<id>/stream?token=<JWT>` no navegador/curl — recebe handshake com logs.
2. Rodar `.exe` sem jobs pendentes — em ≤35s o stream recebe `instance:telemetry` com `[Scheduler] Sem jobs pendentes`.
3. Matar `.exe` — stream fica só em `: ping`; `GET /instances` marca `alive:false` após 90s.


