# Envio de Contratos — Sob Demanda (AD-041 parte 1)

## Problem Statement
Envio de contratos para DocuSign deve ser estritamente sob demanda via interface web (POST /api/robot-docusign/trigger), nunca automatico. Instancias desktop robot-docusigner-*.exe consomem fila RobotJob (pending/retrying) via lock atomico.

> Segregacao em duas rotinas distintas (AD-041): esta spec cobre Envio. A rotina de Conciliacao e coberta por consulta-agreements, extracao-oneds, cruzamento-atualizacao, trava-concorrencia-periodica.

## Requisitos

### REQ-ENV-01 — Trigger sob demanda
- POST /api/robot-docusign/trigger (protect) body contractId cria RobotJob pending e responde 202 sem bloquear.
- POST /api/robot-docusign/trigger-batch (protect+admin) para lote.
- Nenhum scheduler cria RobotJob automaticamente; robotScheduler apenas consome jobs existentes.

### REQ-ENV-02 — Consumo pela frota
- GET /instance/next-job (protect) faz findOneAndUpdate atomico com lock 10min; atribui locked_by, lock_expires_at.
- Validacao contractEligibility pos-lock; se inelegivel marca job failed e reverte Contract status em_processamento_robot para originalStatus.

### REQ-ENV-03 — Execucao no .exe
- robot/src/job-runner.js valida pdfUrl e recipientEmail antes de chromium.launch.
- Reporta via PATCH /instance/job/:jobId/status e POST /instance/heartbeat.

## Criterios (EARS)
- WHEN POST /trigger chamado THEN SHALL criar RobotJob pending e retornar 202 em <500ms.
- WHEN nenhum trigger manual THEN SHALL nao criar jobs automaticamente (AD-052).
- WHEN .exe poll sem jobs THEN SHALL retornar 204.
- WHEN job consumido THEN SHALL lock atomico impedir dupla execucao.

## Trace
AD-041, AD-038/051, AD-052. Implementado em controllers/robotInstanceController.js, seletorApiRobot/robotScheduler.js, robot/src/job-runner.js.
