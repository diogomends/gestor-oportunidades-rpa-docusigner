# Transmissão de Logs SSE na Íntegra (Robô -> Servidor -> Gestor de Oportunidades) Specification

## Problem Statement
Atualmente, quando os robôs executam tarefas automatizadas via Playwright (como envio de contratos, conciliação de acordos e resolução de MFA/IMAP), os logs detalhados de execução gerados em `logger.js` são exibidos exclusivamente no console local da máquina cliente e não chegam ao Servidor Central nem ao Gestor de Oportunidades.
Além disso, no Gestor de Oportunidades, divergências no nome de propriedades (`logs` vs `telemetryLogs`), a ausência do parâmetro `?includeLogs=true` na consulta de instâncias e a falta de eventos SSE nomeados (`event: log`, `event: done`) impedem que os operadores visualizem o log completo no terminal quando alternam para o modo **"Na Íntegra" (Raw)**, gerando a percepção de falta de visibilidade ou desconexão.

## Related Specifications (Gestor de Oportunidades)
Esta especificação interage diretamente e estende as especificações existentes no repositório relacionado `gestor-oportunidades`:
- [`gestor-oportunidades/.specs/features/robot-docusigner/SPEC.md`](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/.specs/features/robot-docusigner/SPEC.md): Especificação macro do Robô DocuSigner no Gestor de Oportunidades.
- [`gestor-oportunidades/.specs/features/robot-docusigner/sub-specs/telemetry-idle-logs/spec.md`](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/.specs/features/robot-docusigner/sub-specs/telemetry-idle-logs/spec.md): Especificação de ingestão de telemetria ociosa e logs do scheduler.
- [`gestor-oportunidades/.specs/features/robot-docusigner/sub-specs/logs-solid-refactor/spec.md`](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/.specs/features/robot-docusigner/sub-specs/logs-solid-refactor/spec.md): Modularização do renderizador, formatador e store de logs do terminal.
- [`gestor-oportunidades/.specs/features/robot-docusigner/sub-specs/job-async-sse/spec.md`](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/.specs/features/robot-docusigner/sub-specs/job-async-sse/spec.md): Especificação do fluxo SSE de acompanhamento assíncrono de jobs.
- [`gestor-oportunidades/.specs/features/config-sistema/sub-specs/robot-docusign/spec.md`](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/.specs/features/config-sistema/sub-specs/robot-docusign/spec.md): Configurações operacionais e credenciais do robô.

## Goals
- [x] Implementar a captura e acumulação em memória dos logs de execução de jobs no robô standalone (`logger.js`), enviando-os em lote no payload de status (`PATCH /instance/job/:jobId/status`).
- [x] Atualizar o handler `updateJobStatus.js` no Servidor Central para receber os logs e propagá-los no barramento de eventos `robotEvents` (`job:progress`).
- [x] Enriquecer o streaming SSE de jobs (`GET /jobs/:jobId/stream`) com o payload de logs e emissão graciosa de eventos (`event: done`).
- [x] Padronizar a exposição dual (`logs` e `telemetryLogs`) em `getAllInstances.js` e `getInstanceTelemetry.js` para compatibilidade total com clientes novos e legados.
- [x] Atualizar o cliente e terminal do Gestor de Oportunidades (`robotDocusignApi.js`, `instanceTelemetry.js`, `instanceLogStream.js`) para suportar a ingestão dos logs brutos e exibi-los condicionalmente apenas quando o modo **"Na Íntegra"** estiver selecionado, preservando o modo **"Resumido"**.

## Out of Scope
| Feature | Reason |
|---|---|
| Persistência de logs brutos textuais no MongoDB | Logs textuais efêmeros não devem inflacionar o banco de dados; o MongoDB preserva apenas o array consolidado de `steps` em `RobotJob`. |
| Alteração no pipeline de 8 etapas do Playwright | O fluxo de automação de envio e seletores DocuSign já está validado e deve permanecer intacto. |
| Alteração nas rotas públicas de autenticação do robô | A autenticação por chave de API SHA-256 e JWT permanece inalterada. |

## Assumptions & Open Questions

| Assumption | Chosen default | Rationale |
|---|---|---|
| Bufferização de logs de execução no robô | Em memória durante a execução do job | Evita I/O de disco e envia logs agrupados nas transições de etapa do job. |
| Compatibilidade de nomes de telemetria | Exposição dual de `logs` e `telemetryLogs` no backend | Garante funcionamento imediato de frontends novos e legados sem quebra de contrato. |
| Separação visual de modos no Gestor | Logs brutos e telemetria só visíveis no modo "Na Íntegra" | Mantém o modo "Resumido" limpo com cards macro conforme requisito de usabilidade. |
| Encerramento de conexões SSE | Emissão de `event: done` antes de fechar o stream HTTP | Permite fechamento gracioso pelo navegador sem disparar erros de rede no console. |

Open questions: none (all resolved in discussion).

## User Stories

### US-LOG-01: Visualização de Logs de Execução na Íntegra
As an operador do Gestor de Oportunidades
I want to visualizar todas as linhas de log geradas pelo robô durante o processamento de um contrato
So that eu possa auditar cada passo da automação (downloads, navegação, preenchimento, MFA) quando necessário.

### US-LOG-02: Alternância entre Modo Resumido e Na Íntegra
As an operador do Gestor de Oportunidades
I want to alternar facilmente entre a visão consolidada de cards e o terminal de logs brutos
So that o painel não fique poluído durante a operação normal, mas ofereça detalhamento em diagnósticos.

### US-LOG-03: Visibilidade de Instâncias Ociosas
As an administrador do sistema
I want to acompanhar a telemetria e batimentos das instâncias mesmo quando não há jobs ativos
So that eu tenha certeza de que os robôs estão conectados e prontos para processamento.

## Requirements (EARS)

### LOG-01: Captura e Acumulação de Logs no Robô
- **WHEN** o robô executar qualquer instrução através de `logger.js` durante o processamento de um job, **THEN** o sistema **SHALL** armazenar a mensagem formatada em um buffer de logs em memória.

### LOG-02: Transmissão de Logs de Execução para a API Central
- **WHEN** o `JobRunner` atualizar o status de um job via `PATCH /instance/job/:jobId/status`, **THEN** o cliente HTTP do robô **SHALL** drenar o buffer de logs e enviar o array `logs` no corpo da requisição.

### LOG-03: Propagação de Logs no Barramento do Servidor
- **WHEN** o handler `updateJobStatus` receber o array `logs`, **THEN** o servidor **SHALL** emitir o evento `job:progress` contendo os logs acumulados para todos os clientes SSE conectados.

### LOG-04: Streaming SSE de Jobs Enriquecido
- **WHEN** um cliente escutar o endpoint `GET /jobs/:jobId/stream`, **THEN** o servidor **SHALL** transmitir os logs do job em tempo real e **SHALL** emitir o evento nomeado `event: done` antes de encerrar o stream ao concluir o job.

### LOG-05: Exposição Dual de Telemetria no Backend
- **WHEN** um cliente consultar `GET /instances` ou `GET /instances/:instanceId/telemetry`, **THEN** o servidor **SHALL** retornar simultaneamente os campos `logs` e `telemetryLogs` com o histórico de telemetria da instância.

### LOG-06: Ingestão e Exibição Condicional no Gestor de Oportunidades
- **WHEN** o frontend do Gestor de Oportunidades consultar instâncias ou receber streams SSE, **THEN** ele **SHALL** requisitar `?includeLogs=true`, ingerir as linhas recebidas e **SHALL** renderizá-las no console quando o modo "Na Íntegra" estiver ativo.

## Acceptance Criteria
- **AC-01**: **WHEN** um job for executado pelo robô standalone, **THEN** o payload do `PATCH /instance/job/:jobId/status` **SHALL** conter o array `logs` com as mensagens emitidas por `logger.step`, `logger.info`, `logger.success`, `logger.warn` e `logger.error`.
- **AC-02**: **WHEN** a rota `GET /api/robot-docusign/jobs/:jobId/stream` for conectada por um navegador, **THEN** os eventos SSE **SHALL** entregar as linhas de log em tempo real e emitir o evento `done` no término do job.
- **AC-03**: **WHEN** a rota `GET /api/robot-docusign/instances?includeLogs=true` for chamada, **THEN** o JSON de resposta **SHALL** conter simultaneamente as propriedades `logs` e `telemetryLogs`.
- **AC-04**: **WHEN** o operador clicar no botão "Na Íntegra" no painel do Gestor de Oportunidades, **THEN** a UI **SHALL** exibir todas as linhas de log de telemetria e execução, e **WHEN** clicar em "Resumo", **THEN** a UI **SHALL** ocultar linhas brutas e exibir apenas cards de jobs.
- **AC-05**: **WHEN** mensagens de log forem trafegadas, **THEN** o banco MongoDB **SHALL** permanecer livre de gravações de texto bruto efêmero.

## Requirement Traceability

| Requirement ID | Description | Status |
|---|---|---|
| LOG-01 | Captura e buffer em memória de logs no robô standalone | implemented |
| LOG-02 | Transmissão de array de logs via PATCH status de jobs | implemented |
| LOG-03 | Propagação de logs no barramento robotEvents (job:progress) | implemented |
| LOG-04 | Streaming SSE com logs em tempo real e evento gracioso done | implemented |
| LOG-05 | Exposição dual logs e telemetryLogs nas rotas de instâncias | implemented |
| LOG-06 | Ingestão resiliente e exibição condicional no Gestor de Oportunidades | implemented |
