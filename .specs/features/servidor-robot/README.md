# Domínio: servidor-robot

Servidor Central `backend/src` (porta 3111) — API REST, fila RobotJob, orquestração, conciliação.

## Sub-features

| Sub-feature | Origem / AD | Conteúdo |
|---|---|---|
| `orquestracao-jobs` | `robot-docusigner` REQ-001..012 (god-spec) | Orquestração de jobs: RobotJob, SystemConfig, sessão, automação browser, orquestrador e rotas (fila e execução) |
| `disparo-assincrono-sse` | `sub-specs/job-async-sse` | Disparo assíncrono com SSE: 202 Accepted + stream de progresso + Nginx |
| `contratos-elegiveis` | `eligible-contracts-non-draft` | Filtro de contratos elegíveis: contractEligibility, blocklist $nin, hasPdf/hasRecipientEmail (AD-038/051) |
| `envio-sob-demanda` | AD-041 parte 1 | Envio sob demanda: POST /trigger exclusivo, lock atômico next-job (AD-039/052) |
| `consulta-paginada-acordos` | AD-041 + docusign-agreements-query REQ-AGR-01/04 | Consulta paginada de acordos: URL com período 5 dias + pageSize 50 + paginação até disabled |
| `extracao-dados-oneds` | AD-042/043/044 | Extração de dados OneDS: envelopeId via data-qa row, tbody strict, sanitização Para:/To: |
| `conciliacao-atualizacao` | AD-041 cruzamento + AD-046/048/049 | Conciliação e atualização: cruzamento envelopeId/email, update irreversível, download PDF + SSE |
| `trava-concorrencia-periodica` | AD-045/047/052 | Trava de concorrência e agendamento periódico: isRunning, schedule.intervalMinutes 5-30, stop() leak fix |

## Segregação AD-041
- **Envio**: `envio-sob-demanda` (fila RobotJob, .exe)
- **Conciliação**: `consulta-paginada-acordos` → `extracao-dados-oneds` → `conciliacao-atualizacao` orquestrados por `trava-concorrencia-periodica` via `statusSyncScheduler.js` + `POST /sync-status`
