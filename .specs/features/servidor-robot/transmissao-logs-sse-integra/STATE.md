# Feature State: Transmissão de Logs SSE na Íntegra

## Status
- **State**: Concluído / Implementado
- **Data**: 2026-09-09
- **Escopo**: Robô Standalone, Servidor Central DocuSigner, Gestor de Oportunidades Frontend

## Resumo das Decisões de Arquitetura (ADR Resumo)
1. **Buffer de Logs em Memória**: Drenagem sob demanda (`drainJobLogs()`) evita overhead de I/O em disco e consolida logs no payload de status do job.
2. **Exposição Dual (`logs` / `telemetryLogs`)**: Mantém compatibilidade total com clientes antigos e novos sem risco de regressão.
3. **Evento Gracioso `done` no SSE**: Permite que navegadores encerrem o listener de SSE sem registrar cancelamento de socket como erro no DevTools.
4. **Ingestão no Gestor de Oportunidades**: `entry.logs` é direcionado para `appendRawRobotLog` com marcação `isRaw: true`, exibido condicionalmente no modo "Na Íntegra" do terminal.

## Histórico de Modificações
- `robot/src/utils/logger.js`: Adicionado buffer e funções `drainJobLogs` / `clearJobLogs`.
- `robot/src/job-runner.js`: Limpeza no início do job e drenagem de logs em cada chamada `updateJobStatus`.
- `robot/src/api-client.js`: Documentação de `logs` no JSDoc de `updateJobStatus`.
- `backend/src/modules/robot-docusign/controllers/instance/updateJobStatus.js`: Inclusão de `logs` no Zod schema e repasse para `emitProgress`.
- `backend/src/modules/robot-docusign/seletorApiRobot/orchestratorEvents.js`: Propagação de `logs` no evento `job:progress`.
- `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`: Streaming SSE com logs e emissão de `event: done`.
- `backend/src/modules/robot-docusign/controllers/instance/getAllInstances.js`: Retorno dual de `logs` e `telemetryLogs`.
- `backend/src/modules/robot-docusign/controllers/instance/getInstanceTelemetry.js`: Retorno dual de `logs` e `telemetryLogs`.
- `gestor-oportunidades/public/modules/config-sistema/robot-docusign/js/servicos/robotDocusignApi.js`: Parâmetro `?includeLogs=true` em `fetchInstances()`.
- `gestor-oportunidades/public/modules/config-sistema/robot-docusign/js/monitoramento/instanceTelemetry.js`: Ingestão de `inst.logs || inst.telemetryLogs`.
- `gestor-oportunidades/public/modules/config-sistema/robot-docusign/js/monitoramento/instanceStreamBridge.js`: Roteamento de `entry.logs` para `appendRawRobotLog`.
