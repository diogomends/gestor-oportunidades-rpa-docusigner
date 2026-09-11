# Domínio: servidor-robot

Servidor Central `backend/src` (porta 3111) — API REST, fila RobotJob, orquestração, conciliação.

## Sub-features

| Sub-feature | Origem / AD | Conteúdo |
|---|---|---|
| `orquestracao-jobs` | `robot-docusigner` REQ-001..012 (god-spec, índice) | Índice da orquestração — detalhe canônico vive nos fragmentos (`disparo-assincrono-sse`, `envio-sob-demanda`, `trava-concorrencia-periodica`, `conciliacao-atualizacao`) |
| `inversao-log-robo` | AD-063 (P1) | Logs recente-primeiro: `GET /logs/:jobId` + SSE `job:progress` com `[...steps].reverse()` sem mutar persistência |
| `database` | AD-048/051/054 | Schema Mongo: `Contract` (`envelopeId`), `RobotJob`, `RobotInstance`, `RobotSession` (`ER-diagram.md` + `schema.md`) |
| `disparo-assincrono-sse` | `sub-specs/job-async-sse` | Disparo assíncrono com SSE: 202 Accepted + stream de progresso + Nginx |
| `contratos-elegiveis` | `eligible-contracts-non-draft` | Filtro de contratos elegíveis: contractEligibility, blocklist $nin, hasPdf/hasRecipientEmail (AD-038/051) |
| `envio-sob-demanda` | AD-041 parte 1 | Envio sob demanda: POST /trigger exclusivo, lock atômico next-job (AD-039/052) |
| `consulta-paginada-acordos` | AD-041 + docusign-agreements-query REQ-AGR-01/04 | Consulta paginada de acordos: URL com período 5 dias + pageSize 50 + paginação até disabled |
| `extracao-dados-oneds` | AD-042/043/044 | Extração de dados OneDS: envelopeId via data-qa row, tbody strict, sanitização Para:/To: |
| `conciliacao-atualizacao` | AD-041 cruzamento + AD-046/048/049 | Conciliação e atualização: cruzamento envelopeId/email, update irreversível, download PDF + SSE |
| `trava-concorrencia-periodica` | AD-045/047/052 | Trava de concorrência e agendamento periódico: isRunning, schedule.intervalMinutes 5-30, stop() leak fix |
| `refatoracao-sincronizacao-status` | AD-073/074 | Refatoração SOLID/JSDoc da esteira de sincronização: `DocusignEnvelope.js`, `contractSyncService.js`, decomposição do `statusSyncScheduler.js` em 5 módulos atômicos |
| `status-aguardando-assinatura` | AD-075 | Status nominal de assinatura: captura `pendingSigner`/`docusignStatusDetail` no robô, persistência em `Contract`, SSE e badge `AGUARDANDO [NOME]`/`ANULADO` (T5 frontend cross-repo em `gestor-oportunidades`) |
| `desativacao-fallback-servidor-browser` | AD-076 | Fleet-only enforcement: `robotScheduler`/`statusSyncScheduler` retornam `reason: "fleet_offline"` sem Playwright inline no servidor quando a frota está offline; `POST /test-login` preservado |
| `refatoracao-funcoes-atomicas` | AD-077 | Decomposição modular 1 arquivo/função com barrels DIP: `browserrobot/agreements/`, `controllers/instance/updateJobStatus/`, `seletorApiRobot/envelopeMatcher/` + `statusSync/` (canônico aqui; fatia do robô standalone referenciada em `robot-specs`) |
| `polimento-transmissao-logs` | LOG spec / AD-063 | Correções pós-review da esteira de logs SSE: mock T3 `findById().lean()`, dedup `getLogs` em `getAllInstances.js`, cap FIFO 500 em `robot/src/utils/logger.js` |

## Segregação AD-041
- **Envio**: `envio-sob-demanda` (fila RobotJob, .exe)
- **Conciliação**: `consulta-paginada-acordos` → `extracao-dados-oneds` → `conciliacao-atualizacao` orquestrados por `trava-concorrencia-periodica` via `statusSyncScheduler.js` + `POST /sync-status`
