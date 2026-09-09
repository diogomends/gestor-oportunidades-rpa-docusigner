# Refatoração Modular do robotDocusignController (SOLID & Atomic Handlers) Specification

## Problem Statement
O arquivo [`backend/src/modules/robot-docusign/controllers/robotDocusignController.js`](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades-rpa-docusigner/backend/src/modules/robot-docusign/controllers/robotDocusignController.js) acumulou 869 linhas, concentrando 13 operações distintas (enfileiramento individual e em lote de jobs, consulta de status, listagem paginada, métricas consolidadas, logs em ordem reversa, consulta e atualização de configurações com criptografia, teste interativo de login Playwright com MFA, consulta de fila, disparo de processamento de contratos pendentes, sincronização geral de status e streaming SSE de progresso).
Essa concentração viola o Single Responsibility Principle (SRP) e o Interface Segregation Principle (ISP) do SOLID, eleva a complexidade ciclomática e o consumo de contexto de agentes de IA, além de aumentar o risco de regressões em edições concorrentes.

## Goals
- [ ] Decompor `robotDocusignController.js` em **13 handlers atômicos dedicados (1 arquivo por função)** com nomes altamente claros e semânticos sob `backend/src/modules/robot-docusign/controllers/docusign/`.
- [ ] Manter `robotDocusignController.js` como **Fachada/Barrel DIP**, exportando todas as 13 funções com seus nomes semânticos e legados, além do `export default`, garantindo **zero breaking changes** nos roteadores (`routes.js`) e em testes existentes.
- [ ] Isolar schemas Zod (`triggerSchema`, `triggerBatchSchema`, `updateConfigSchema`, `testLoginSchema`) dentro de seus respectivos arquivos atômicos.
- [ ] Garantir conformidade rigorosa com JSDoc completo em 100% das funções e schemas.
- [ ] Preservar integralmente respostas padronizadas `{ error, message }` (AD-057) e ordenação reversa de steps (AD-063).

## Out of Scope
| Feature | Reason |
|---|---|
| Alteração de rotas ou caminhos HTTP | Roteamento em `routes.js` está consolidado e deve permanecer intacto. |
| Alteração de schemas ou regras de banco de dados | Modelos `RobotJob`, `RobotInstance`, `Contract`, `SystemConfig` e `User` permanecerão inalterados. |
| Criação de testes unitários isolados | Conforme regra global do projeto para tasks TLC, apenas validações de regressão e inventário de rotas são permitidas. |

## User Stories & Acceptance Criteria (EARS)

### REQ-ARCH-01: Modularidade e Atomicidade (SRP)
- **WHEN** uma requisição HTTP for recebida por qualquer rota do Robô DocuSign, **THEN** o sistema **SHALL** processar a requisição através de um handler atômico isolado em `controllers/docusign/` com escopo estrito à sua funcionalidade.

### REQ-ARCH-02: Preservação de Compatibilidade (DIP / Barrel)
- **WHEN** módulos externos (ex: `routes.js`, testes) importarem de `controllers/robotDocusignController.js`, **THEN** a fachada **SHALL** fornecer todas as 13 funções e o objeto padrão `default` sem desvios de assinatura.

### REQ-ARCH-03: Integridade de Regras de Negócio e Segurança
- **WHEN** `enqueueSingleJob` / `triggerJob` executa, **THEN** o enfileiramento assíncrono via `robotOrchestrator.enqueueJob` **SHALL** retornar HTTP 202 com `jobId` real e payload `{ success: true, message, jobId, status: "pending" }`.
- **WHEN** `enqueueBatchJobs` / `triggerBatch` executa, **THEN** os jobs em lote **SHALL** ser enfileirados retornando HTTP 202 com array `jobIds`.
- **WHEN** `updateRobotConfiguration` / `updateConfig` executa, **THEN** as senhas em `credentials` e `token_notification_email` **SHALL** ser encriptadas via `encryptText` e persistidas no `SystemConfig`.
- **WHEN** `getJobExecutionLogs` / `getJobLogs` ou `streamJobProgressSSE` / `streamJobProgress` executam, **THEN** os steps de execução **SHALL** ser entregues em ordem cronológica reversa (`[...steps].reverse()`).

## Mapeamento de Arquivos e Funções

| Arquivo de Destino | Função Principal | Linhas Estimadas |
|---|---|:---:|
| `controllers/docusign/enqueueSingleJob.js` | `enqueueSingleJob` / `triggerJob` | ~55 |
| `controllers/docusign/enqueueBatchJobs.js` | `enqueueBatchJobs` / `triggerBatch` | ~55 |
| `controllers/docusign/getJobStatusById.js` | `getJobStatusById` / `getJobStatus` | ~45 |
| `controllers/docusign/listFilteredJobs.js` | `listFilteredJobs` / `listJobs` | ~75 |
| `controllers/docusign/getExecutionMetrics.js` | `getExecutionMetrics` / `getMetrics` | ~70 |
| `controllers/docusign/getJobExecutionLogs.js` | `getJobExecutionLogs` / `getJobLogs` | ~45 |
| `controllers/docusign/getRobotConfiguration.js` | `getRobotConfiguration` / `getConfig` | ~25 |
| `controllers/docusign/updateRobotConfiguration.js` | `updateRobotConfiguration` / `updateConfig` | ~65 |
| `controllers/docusign/testDocusignLogin.js` | `testDocusignLogin` / `testLogin` | ~70 |
| `controllers/docusign/getPendingJobQueue.js` | `getPendingJobQueue` / `getQueue` | ~25 |
| `controllers/docusign/processPendingJobs.js` | `processPendingJobs` / `processPending` | ~25 |
| `controllers/docusign/syncAllContractsStatus.js` | `syncAllContractsStatus` / `syncAllStatuses` | ~25 |
| `controllers/docusign/streamJobProgressSSE.js` | `streamJobProgressSSE` / `streamJobProgress` | ~85 |
| `controllers/robotDocusignController.js` (Barrel) | Re-exports (13 funções + default) | ~55 |

## Success Criteria
- [ ] O arquivo `robotDocusignController.js` é reduzido de 869 linhas para ~55 linhas de exportações diretas.
- [ ] 13 novos arquivos atômicos criados sob `controllers/docusign/`, cada um com responsabilidade única.
- [ ] 100% das funções possuem documentação JSDoc completa (`@param`, `@returns`, `@async`).
- [ ] Inventário de rotas permanece 100% íntegro.
