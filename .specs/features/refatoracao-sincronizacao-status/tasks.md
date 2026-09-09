# Tasks — Refatoração de Sincronização e Modelos DocuSigner

```
┌───────────────────────────────────────────────┐
│ Phase 1: Modelos & Serviços Base (Refactor)   │
│ ├─ TASK-REF-01: DocusignEnvelope.js (JSDoc)   │
│ └─ TASK-REF-02: contractSyncService.js (SRP)  │
└───────────────────────┬───────────────────────┘
                        ▼
┌───────────────────────────────────────────────┐
│ Phase 2: Agendador & Scheduler (Refactor)     │
│ └─ TASK-REF-03: statusSyncScheduler.js (Clean)│
└───────────────────────┬───────────────────────┘
                        ▼
┌───────────────────────────────────────────────┐
│ Phase 3: Regressão & Documentação             │
│ ├─ TASK-REF-04: Testes de Regressão           │
│ └─ TASK-REF-05: Atualização Documentação/State│
└───────────────────────────────────────────────┘
```

---

## Phase 1: Modelos & Serviços Base

- [x] `TASK-REF-01`: Refatorar e documentar `backend/src/models/DocusignEnvelope.js`
  - **Description**: Adicionar `@typedef` Mongoose completo, documentação de todos os campos do schema e anotação `@type {import('mongoose').Model<DocusignEnvelopeDoc>}` no export com conexão resiliente `crm_contracts`.
  - **Depends on**: None
  - **Tests**: `npm run test:backend`
  - **Gate**: Model compila e resolve sem erros de schema.

- [x] `TASK-REF-02`: Refatorar `backend/src/modules/robot-docusign/seletorApiRobot/contractSyncService.js`
  - **Description**: Aplicar JSDoc completo, isolamento de exceções, anti-phantom hardening e aderência estrita a SRP/PonyTail sem quebrar contratos da API externa ou Mongoose.
  - **Depends on**: `TASK-REF-01`
  - **Tests**: `npm run test:backend`
  - **Gate**: Funções `syncContractStatus` e `buildDownloadPath` passam nos testes de integração.

---

## Phase 2: Agendador & Scheduler

- [x] `TASK-REF-03`: Refatorar e modularizar `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`
  - **Description**: Modularizar e desacoplar responsabilidades em funções atômicas (checagem de lock, validação de regras de acesso/permissão, matching de contratos, persistência irreversível e download de PDFs assinados), mantendo JSDoc obrigatório e sem sobre-engenharia.
  - **Depends on**: `TASK-REF-02`
  - **Tests**: `npm run test:backend`
  - **Gate**: Cobertura de fluxo completo de sincronização de contratos sem regressões.

---

## Phase 3: Regressão & Documentação

- [x] `TASK-REF-04`: Testes exclusivos de regressão
  - **Description**: Execução de testes unitários isolados interrompida conforme instrução do usuário (regra TLC: apenas regressão).
  - **Depends on**: `TASK-REF-03`
  - **Gate**: Sem quebra de contratos de export.

- [x] `TASK-REF-05`: Atualizar documentação em `.specs/STATE.md` e `AGENTS.md`
  - **Description**: Registrar nova decisão arquitetural (AD-073) em `.specs/STATE.md` e sincronizar o resumo em `AGENTS.md` refletindo as melhorias e isolamento dos módulos.
  - **Depends on**: `TASK-REF-04`
  - **Tests**: `make routes-inventory-check` (se aplicável)
  - **Gate**: Documentação sincronizada e consistente.
