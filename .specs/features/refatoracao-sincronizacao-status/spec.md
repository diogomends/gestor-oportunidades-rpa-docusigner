# Spec — Refatoração de Módulos de Sincronização e Modelos DocuSigner

## Problem Statement
Refatorar exclusivamente os componentes pertencentes a este repositório (`gestor-oportunidades-rpa-docusigner`) listados no inventário (`DocusignEnvelope.js`, `contractSyncService.js` e `statusSyncScheduler.js`), aplicando os princípios SOLID, PonyTail, JSDoc obrigatório, anti-phantom hardening e testes exclusivos de regressão, descartando os arquivos pertencentes ao repositório externo (`gestor-oportunidades`).

## Escopo e Delimitação de Impacto

### Arquivos Pertencentes a este Projeto (No Escopo)
1. `backend/src/models/DocusignEnvelope.js` (34 linhas) — Schema e conexão Mongoose.
2. `backend/src/modules/robot-docusign/seletorApiRobot/contractSyncService.js` (95 linhas) — Sincronização desacoplada de status e cálculo de diretórios.
3. `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js` (395 linhas) — Agendador de sincronização de status, matching de envelopes e conciliação.
4. `backend/src/modules/robot-docusign/services/` — Barrels/fachadas DIP que reexportam os serviços.

### Arquivos Externos Desconsiderados (Fora do Escopo - Projeto `gestor-oportunidades`)
- `protectOrRobot.js` (middleware no Gestor)
- `routes.js` (rotas de contratos com upload multer no Gestor)
- `contractController.js` (controller de contratos no Gestor)
- `contractService.js` (serviço de contratos no Gestor)

### Componentes e Rotas Preservados e Intocados (Impact Protector)
- Rotas Express de `/api/robot-docusign` (`/trigger`, `/trigger-batch`, `/status/:jobId`, `/jobs`, `/instance/*`, etc.).
- Automação Playwright em `robot/src/browser/*` e `backend/src/modules/robot-docusign/browserrobot/*`.
- Autenticação por chave (`X-Robot-Key`) e credenciais IMAP nativas (MFA).
- Modelos `Contract.js`, `User.js`, `SystemConfig.js`, `RobotJob.js`, `RobotInstance.js`.

---

## Requisitos (EARS)

### REQ-REF-01 — Padronização de Tipagem e JSDoc em Modelos
- **EARS**: THE `DocusignEnvelope.js` SHALL fornecer anotações `@typedef` completas de schema, tipagem `@type {import('mongoose').Model<DocusignEnvelopeDoc>}` no export e registro seguro na conexão `crm_contracts`.

### REQ-REF-02 — Refatoração Modular e SOLID do `contractSyncService.js`
- **EARS**: WHEN o status de um contrato for alterado THEN the `contractSyncService` SHALL orquestrar a chamada HTTP (`gestorApiClient`) com fallback robusto Mongoose em `DocusignEnvelope` e `Contract`, garantindo isolamento de falhas, anti-phantom success e JSDoc em 100% das funções.

### REQ-REF-03 — Decomposição e PonyTail no `statusSyncScheduler.js`
- **EARS**: WHEN a sincronização periódica for executada THEN the `statusSyncScheduler` SHALL delegar etapas de validação de horário/permissões, busca de contratos ativos, conciliação/match e persistência a funções atômicas puras, mantendo o controle de lock (`isRunning`) e logs estruturados sem criar sobre-engenharia.

### REQ-REF-04 — Testes Exclusivos de Regressão
- **EARS**: THE suíte de testes em `tests/backend/services/statusSyncScheduler.test.js` SHALL cobrir fluxos de ponta a ponta e regressão das rotinas refatoradas, sendo proibida a criação de testes unitários isolados.

---

## Critérios de Aceite
1. Todas as funções e modelos refatorados contêm JSDoc completo e válido.
2. Contratos de API, schemas Mongoose e comportamento de conciliação permanecem 100% compatíveis.
3. Testes de regressão executam via runner nativo (`npm test` / `npm run test:backend`).
