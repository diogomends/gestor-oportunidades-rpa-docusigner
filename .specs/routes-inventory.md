# Inventário de Rotas HTTP (REST) — gestor-oportunidades-rpa-docusigner

> **Fonte da verdade:** `backend/src/app.js`, `backend/src/modules/robot-docusign/routes.js`, `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js`
> Atualizado em: 2026-09-01

## Registros

| Método | Path completo | Descrição curta | Auth | Arquivo:linha | Observação |
|--------|---------------|-----------------|------|---------------|------------|
| GET | `/health` | Health check | Público | `backend/src/app.js:27` | Fora do prefixo /api/robot-docusign |
| GET | `/api/robot-docusign/instances` | Lista instâncias do robô (fleet monitoring) | protect + authorize("admin") | `backend/src/modules/robot-docusign/routes.js:36` | Alias de /instance/instances |
| POST | `/api/robot-docusign/trigger` | Dispara job individual (body: contractId/contract_id) | protect | `backend/src/modules/robot-docusign/routes.js:38` | HTTP 202, job criado em background |
| POST | `/api/robot-docusign/trigger-batch` | Dispara jobs em lote | protect + authorize("admin") | `backend/src/modules/robot-docusign/routes.js:39` | body `{ contractIds: [] }` |
| GET | `/api/robot-docusign/status/:jobId` | Status de um job (por _id ou contract_id) | protect | `backend/src/modules/robot-docusign/routes.js:40` | Busca $or: _id/contract_id/contractId |
| GET | `/api/robot-docusign/jobs/:jobId/stream` | SSE stream de progresso do job | protect | `backend/src/modules/robot-docusign/routes.js:41` | token via ?token= para EventSource |
| GET | `/api/robot-docusign/jobs` | Lista jobs (filtros + paginação) | protect | `backend/src/modules/robot-docusign/routes.js:42` | query: status, action, mode, contractId, page, limit |
| GET | `/api/robot-docusign/metrics` | Métricas agregadas | protect | `backend/src/modules/robot-docusign/routes.js:43` | totalJobs, successRate, byMode, byAction |
| GET | `/api/robot-docusign/logs/:jobId` | Logs detalhados de um job | protect | `backend/src/modules/robot-docusign/routes.js:44` | steps, error, attempts |
| GET | `/api/robot-docusign/config` | Buscar config do robô | protect | `backend/src/modules/robot-docusign/routes.js:45` | Qualquer usuário autenticado |
| PUT | `/api/robot-docusign/config` | Atualizar config do robô | protect + authorize("admin") | `backend/src/modules/robot-docusign/routes.js:46` | body: enabled, mode, credentials, token_notification_email, limits, retry |
| POST | `/api/robot-docusign/test-login` | Testa login no DocuSign | protect + authorize("admin") | `backend/src/modules/robot-docusign/routes.js:47` | body opcional: email, password, otpCode (6 dígitos) |
| GET | `/api/robot-docusign/queue` | Fila de jobs pendentes/em processamento | protect | `backend/src/modules/robot-docusign/routes.js:48` | status in [pending, processing, running, retrying] |
| POST | `/api/robot-docusign/process-pending` | Processa até 1 contrato pendente | protect + authorize("admin") | `backend/src/modules/robot-docusign/routes.js:49` | Scheduler manual, respeita enabled/horário |
| POST | `/api/robot-docusign/sync-status` | — | protect + authorize("admin") | `backend/src/modules/robot-docusign/routes.js:50` | — |
| POST | `/api/robot-docusign/instance/auth` | Autenticação da instância | Público | `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js:22` | X-Robot-Key ou email/senha → JWT 30d + instance_id |
| GET | `/api/robot-docusign/instance/instances` | Lista instâncias (via sub-router) | protect + authorize("admin") | `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js:27` | Duplicata de /instances |
| GET | `/api/robot-docusign/instance/config` | Config da instância | protect | `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js:28` | Usado pelo robô .exe |
| GET | `/api/robot-docusign/instance/next-job` | Próximo job pendente (polling do robô) | protect | `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js:29` | Lock atômico locked_by/lock_expires_at |
| PATCH | `/api/robot-docusign/instance/job/:jobId/status` | Atualiza status do job | protect | `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js:30` | Reporta progresso do robô |
| POST | `/api/robot-docusign/instance/heartbeat` | Heartbeat da instância | protect | `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js:31` | Mantém instância viva |
| GET | `/api/robot-docusign/instance/contracts/:contractId/pdf` | Download de PDF do contrato | protect | `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js:32` | Usado pelo robô para upload DocuSign |

## Legenda

| Notação | Significado |
|---------|-------------|
| Público | Sem autenticação JWT |
| protect | Requer JWT válido via authMiddleware.protect (Bearer ou ?token= para SSE) |
| protect + authorize("admin") | JWT + role admin |

## Observações

1. `/api/robot-docusign/instances` e `/api/robot-docusign/instance/instances` apontam para o mesmo handler `getAllInstances` (duplicata intencional).
2. `GET /jobs/:jobId/stream` aceita token via query `?token=` para compatibilidade com EventSource.
3. `GET /health` é a única rota fora do prefixo `/api/robot-docusign`.
4. O robô `.exe` faz polling em `GET /instance/next-job`, não em `GET /queue` (este é para debug/frontend).

## Resumo

- **Prefixo /api/robot-docusign:** 21 endpoints
- **Fora do prefixo:** 1 endpoint (/health)
- **Total:** 22 endpoints
