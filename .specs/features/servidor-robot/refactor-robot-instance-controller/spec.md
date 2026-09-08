# Refatoração Modular do robotInstanceController (SOLID & Atomic Handlers) Specification

## Problem Statement
O arquivo [`backend/src/modules/robot-docusign/controllers/robotInstanceController.js`](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades-rpa-docusigner/backend/src/modules/robot-docusign/controllers/robotInstanceController.js) acumulou 1.040 linhas, concentrando múltiplas responsabilidades distintas (autenticação dual por chave e senha, consulta de configuração, polling e trava atômica de jobs com deduplicação de signatários, atualização de status de jobs com guarda anti-fantasma UUID v4, heartbeat periódico, streaming SSE de telemetria, fallback HTTP e leitura multi-caminho de arquivos PDF).
Essa concentração viola o Single Responsibility Principle (SRP do SOLID), eleva a carga cognitiva e o consumo de contexto de agentes de IA, e aumenta o risco de regressões em edições concorrentes.

## Goals
- [ ] Decompor `robotInstanceController.js` em **handlers atômicos dedicados (1 arquivo por função)** sob `backend/src/modules/robot-docusign/controllers/instance/`.
- [ ] Manter `robotInstanceController.js` como **Fachada/Barrel DIP**, exportando exatamente as mesmas 9 funções públicas e o export default, garantindo **zero breaking changes** nos roteadores (`routes.js`, `routes/robotInstanceRoutes.js`) e em testes existentes.
- [ ] Otimizar cada arquivo para consumo por IAs e desenvolvedores (arquivos pequenos entre 25 e 240 linhas, com isolamento total de dependências e schemas Zod específicos).
- [ ] Garantir conformidade rigorosa com JSDoc completo em 100% das funções e schemas.

## Out of Scope
| Feature | Reason |
|---|---|
| Alteração de rotas ou caminhos HTTP | Roteamento em `routes.js` e `robotInstanceRoutes.js` já está consolidado e deve permanecer intacto. |
| Alteração de schemas ou regras de banco de dados | Modelos `RobotInstance`, `RobotJob`, `Contract` e coleções ACL não sofrerão alterações estruturais. |
| Criação de testes unitários isolados | Conforme regra global do projeto para tasks TLC, apenas validações de regressão e inventário de rotas são permitidas. |

## User Stories & Acceptance Criteria (EARS)

### REQ-ARCH-01: Modularidade e Atomicidade (SRP)
- **WHEN** uma requisição HTTP atinge qualquer endpoint de instância do robô, **THEN** o sistema **SHALL** processar a requisição através de um handler atômico isolado em `controllers/instance/` com escopo estrito à sua funcionalidade.

### REQ-ARCH-02: Preservação de Compatibilidade (DIP / Barrel)
- **WHEN** módulos externos (ex: `routes.js`, `robotInstanceRoutes.js`) importarem de `controllers/robotInstanceController.js`, **THEN** a fachada **SHALL** fornecer todas as 9 funções (`authenticateInstance`, `getInstanceConfig`, `getNextJob`, `updateJobStatus`, `registerHeartbeat`, `downloadContractPdf`, `getAllInstances`, `getInstanceTelemetry`, `streamInstanceTelemetry`) e o objeto padrão `default` sem desvios de assinatura.

### REQ-ARCH-03: Integridade de Regras de Negócio e Segurança
- **WHEN** `authenticateInstance` executa, **THEN** o sistema **SHALL** validar tokens, chaves `X-Robot-Key` SHA-256 e credenciais legadas de acordo com as regras existentes (AD-014).
- **WHEN** `getNextJob` executa, **THEN** a trava atômica de 10 minutos, filtros por role e deduplicação de signatários **SHALL** ser preservados integralmente.
- **WHEN** `updateJobStatus` executa com status `completed` em `send`/`resend`, **THEN** o guard anti-fantasma (UUID v4 de 36 caracteres) **SHALL** rejeitar conclusões sem `envelopeId` válido.
- **WHEN** `registerHeartbeat` ou `streamInstanceTelemetry` executam, **THEN** a emissão SSE `instance:telemetry` e buffers em memória **SHALL** funcionar sem interrupções.
- **WHEN** `downloadContractPdf` executa, **THEN** a resolução em disco (`/app/uploads`) e o fallback HTTP via `gestorApiClient` **SHALL** ser mantidos.

## Mapeamento de Arquivos e Funções

| Arquivo de Destino | Função Principal | Linhas Estimadas |
|---|---|:---:|
| `controllers/instance/authenticateInstance.js` | `authenticateInstance` | ~155 |
| `controllers/instance/getInstanceConfig.js` | `getInstanceConfig` | ~45 |
| `controllers/instance/getNextJob.js` | `getNextJob` | ~240 |
| `controllers/instance/updateJobStatus.js` | `updateJobStatus` | ~170 |
| `controllers/instance/registerHeartbeat.js` | `registerHeartbeat` | ~65 |
| `controllers/instance/downloadContractPdf.js` | `downloadContractPdf` | ~55 |
| `controllers/instance/getAllInstances.js` | `getAllInstances` | ~45 |
| `controllers/instance/getInstanceTelemetry.js` | `getInstanceTelemetry` | ~25 |
| `controllers/instance/streamInstanceTelemetry.js` | `streamInstanceTelemetry` | ~50 |
| `controllers/robotInstanceController.js` (Barrel) | Re-exports (9 funções + default) | ~35 |

## Success Criteria
- [ ] O arquivo `robotInstanceController.js` é reduzido de 1.040 linhas para ~35 linhas de exportações diretas.
- [ ] 9 novos arquivos atômicos criados sob `controllers/instance/`, cada um com responsabilidade única.
- [ ] 100% das funções possuem documentação JSDoc completa (`@param`, `@returns`, `@async`).
- [ ] Inventário de rotas permanece 100% íntegro (`make routes-inventory-check` passa sem divergências).
