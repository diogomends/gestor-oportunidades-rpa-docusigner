# Desativação do Fallback de Navegador no Servidor Specification

## Problem Statement
Quando os robôs locais/standalone estão desligados, os agendadores de segundo plano no servidor (`robotScheduler` e `statusSyncScheduler`) tentam executar ações RPA inline utilizando Playwright no container do backend. Como o ambiente do servidor não possui a sessão interativa persistida ou tem características de rede distintas, o DocuSign dispara repetidamente e-mails de código de verificação (MFA/2FA), incomodando os operadores e falhando a automação.

A arquitetura do sistema foi projetada para distribuição com robôs dedicados (Dual-Robot Distribution: `robot-query-N` e `robot-enviar-N`). O servidor backend deve atuar estritamente como orquestrador de fila e banco de dados, sem abrir instâncias headless de navegador automaticamente quando a frota estiver offline.

## Goals
- [ ] Impedir que o `statusSyncScheduler` (e `contractStatusSyncService`) dispare Playwright no container quando a frota de robôs de consulta (`query` ou `all`) estiver offline.
- [ ] Registrar em log de forma clara quando a varredura periódica de status for ignorada devido à ausência de robôs de consulta ativos, sem criar jobs pendentes ou abrir navegador no servidor.
- [ ] Impedir que o `robotScheduler` dispare Playwright no container quando a frota de robôs de envio (`update` ou `all`) estiver offline, mantendo os jobs pendentes na fila exclusivamente para consumo pelos robôs externos.
- [ ] Preservar o submódulo `browserrobot` e a rota manual administrativa `POST /test-login` para testes explícitos acionados por administradores.
- [ ] Preservar 100% das rotas de API, contratos de dados, endpoints do robô e comportamento da frota standalone.

## Out of Scope
Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| --- | --- |
| Desativação do endpoint manual `POST /test-login` | Deve permanecer disponível para testes e diagnósticos manuais realizados por administradores. |
| Alterações no robô standalone (`robot/`) | Os executáveis standalone continuarão operando via polling normal (`/instance/next-job`). |
| Alterações em rotas HTTP e schemas Mongoose | Nenhuma rota de API ou schema do banco de dados será alterado. |
| Criação de testes unitários isolados | Diretrizes do projeto estipulam testes de regressão de fluxos integrados. |

---

## Assumptions & Open Questions
Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Comportamento do `statusSyncScheduler` sem frota | Apenas logar que a frota está offline e pular a execução sem criar jobs pendentes nem abrir browser | Decisão do usuário para evitar sobrecarga de jobs e disparo de 2FA | Sim |
| Comportamento do `robotScheduler` sem frota | O servidor apenas gerencia a fila e nunca tenta executar o envio via navegador headless localmente | Decisão do usuário; envios devem ser processados apenas por robôs externos | Sim |
| Preservação de testes manuais | Manter suporte a Playwright no servidor apenas quando acionado expressamente em rotas manuais (`POST /test-login`) | Permite aos administradores testar credenciais quando necessário | Sim |
| Regras de JSDoc e SOLID | 100% das funções criadas ou modificadas terão JSDoc completo e responsabilidade única | Padrão arquitetural obrigatório do projeto | Sim |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Desativação de Execução Automática de Navegador no Backend ⭐ MVP

**User Story**: Como administrador do sistema e operador de contratos, quero que o servidor backend nunca inicie o navegador Playwright de forma automática em segundo plano quando os robôs locais estiverem desligados, para que não ocorram disparos indevidos de códigos de verificação (MFA) do DocuSign.

**Why P1**: Elimina a causa raiz do spam de e-mails de verificação e consolida o papel do servidor como orquestrador central de fila.

**Acceptance Criteria**:

1. WHEN `statusSyncScheduler` executar uma rodada de sincronização de status E nenhum robô com role `query` ou `all` estiver ativo (heartbeat recente) THEN the scheduler SHALL registrar em log que não há robôs ativos e encerrar a rodada sem invocar `browserrobot.executeWithBrowser`.
2. WHEN `robotScheduler` verificar a fila de jobs/contratos pendentes E nenhum robô com role `update` ou `all` estiver ativo THEN the scheduler SHALL registrar em log que a frota está offline e não iniciar o envio via navegador no servidor.
3. WHEN um administrador invocar a rota manual `POST /api/robot-docusign/test-login` THEN the servidor SHALL permitir o teste de login via `browserrobot` normalmente.
4. The sistema SHALL preservar 100% dos testes de regressão passando sem falhas.

**Independent Test**: Executar a suíte de testes de regressão (`npm test`) garantindo que os agendadores pulam a execução de navegador quando não há instâncias de robô registradas, e que as rotas de API continuam intactas.
