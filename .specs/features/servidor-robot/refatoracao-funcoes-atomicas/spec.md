# Refatoração e Decomposição Modular em Funções Atômicas Specification

## Problem Statement
Diversos arquivos do backend e do robô Playwright concentravam múltiplas responsabilidades e funções em módulos únicos (`agreementsService.js`, `updateJobStatus.js`, `contractEnvelopeMatcher.js`, `contractStatusSyncService.js`, `agreements.js` e `statusParser.js`). Essa concentração dificultava manutenções pontuais, testes e leitura cirúrgica por desenvolvedores e IAs.

Esta refatoração divide cada função em seu próprio arquivo atômico com nomes altamente semânticos e compreensíveis (1 arquivo por função), organizando-os em subpastas por domínio e mantendo arquivos originais como fachadas/barrels DIP com 100% de compatibilidade retroativa com rotas, agendadores, controladores e suíte de testes.

## Goals
- [ ] Decompor `agreementsService.js` (7 funções) em arquivos atômicos sob `browserrobot/agreements/` (`normalizeSearchText.js`, `cleanSignerNameNoise.js`, `extractPendingSignerName.js`, `normalizeDocusignEnvelopeStatus.js`, `buildAgreementsFilterUrl.js`, `extractPageEnvelopeRows.js`, `queryRepresentativeAgreementsPaginated.js`).
- [ ] Decompor `updateJobStatus.js` isolando `reconcileCompletedQueryAgreements.js` em módulo atômico sob `controllers/instance/updateJobStatus/`.
- [ ] Decompor `contractEnvelopeMatcher.js` (3 funções) em arquivos atômicos sob `seletorApiRobot/envelopeMatcher/` (`normalizeComparisonText.js`, `convertDocusignStatusToContractStatus.js`, `matchContractWithDocusignEnvelope.js`).
- [ ] Decompor `contractStatusSyncService.js` (2 funções) em arquivos atômicos sob `seletorApiRobot/statusSync/` (`getStatusSyncRunningState.js`, `orchestrateAllContractsStatusSync.js`).
- [ ] Decompor `agreements.js` (2 funções) e `statusParser.js` (4 funções) do robô em pastas dedicadas `browser/agreements/` e `browser/statusParser/`.
- [ ] Manter os arquivos de origem como barrels/fachadas DIP re-exportando named e default exports com JSDoc completo.

## Out of Scope
Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| --- | --- |
| Alteração na lógica de negócio e regras de negócio | Trata-se de refatoração estrutural pura sem mudança de comportamento. |
| Alteração nas rotas HTTP públicas e privadas | Assinaturas de API e endpoints existentes devem ser 100% preservados. |
| Criação de testes unitários isolados | Diretriz do projeto estipula exclusivamente testes de regressão de fluxos ponta a ponta. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Padrão de 1 arquivo por função | Cada função exportada e utilitária reside em seu próprio arquivo | Segue estritamente diretriz de arquitetura modular SOLID/PonyTail e pedido do usuário | Sim |
| Nomenclatura semântica autoexplicativa | Arquivos com nomes altamente descritivos do seu propósito de negócio | Facilita localização de bugs e entendimento por desenvolvedores e IAs | Sim |
| Agrupamento por pasta semântica | Criar subpastas relacionais (`agreements/`, `envelopeMatcher/`, `statusSync/`, `statusParser/`, `updateJobStatus/`) | Organização lógica limpa e coesa | Sim |
| Retrocompatibilidade via Barrels | Módulos originais re-exportam todas as funções named + default export + aliases legados | Preserva 100% dos imports existentes de controladores, agendadores e testes | Sim |
| JSDoc obrigatório | 100% dos novos arquivos e barrels terão JSDoc completo | Regra obrigatória do projeto | Sim |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Decomposição Modular Backend e Robô ⭐ MVP

**User Story**: Como desenvolvedor e arquiteto de software, quero que as funções dos módulos de acordos, atualização de job, cruzamento de envelopes e parser de status estejam decompostas em 1 arquivo por função com nomes altamente descritivos e agrupadas por pasta, para que a manutenção seja modular, compreensível e livre de efeitos colaterais.

**Acceptance Criteria**:

1. WHEN `backend/src/modules/robot-docusign/browserrobot/agreements/` for acessado THEN o módulo SHALL conter 1 arquivo dedicado para cada função (`normalizeSearchText`, `cleanSignerNameNoise`, `extractPendingSignerName`, `normalizeDocusignEnvelopeStatus`, `buildAgreementsFilterUrl`, `extractPageEnvelopeRows`, `queryRepresentativeAgreementsPaginated`).
2. WHEN `backend/src/modules/robot-docusign/browserrobot/agreementsService.js` for importado THEN o módulo SHALL re-exportar todas as funções mantendo compatibilidade com importadores existentes.
3. WHEN `backend/src/modules/robot-docusign/controllers/instance/updateJobStatus.js` for executado THEN o controller SHALL orquestrar a atualização de status utilizando o helper atômico isolado `reconcileCompletedQueryAgreements.js`.
4. WHEN `backend/src/modules/robot-docusign/seletorApiRobot/contractEnvelopeMatcher.js` for acessado THEN o módulo SHALL re-exportar `normalizeComparisonText`, `convertDocusignStatusToContractStatus` e `matchContractWithDocusignEnvelope` a partir de arquivos atômicos sob `seletorApiRobot/envelopeMatcher/`.
5. WHEN `backend/src/modules/robot-docusign/seletorApiRobot/contractStatusSyncService.js` for acessado THEN o módulo SHALL re-exportar `getStatusSyncRunningState` e `orchestrateAllContractsStatusSync` a partir de arquivos atômicos sob `seletorApiRobot/statusSync/`.
6. WHEN `robot/src/browser/agreements.js` e `robot/src/browser/statusParser.js` forem carregados pelo robô THEN o robô SHALL executar com sucesso importando as funções atômicas de `browser/agreements/` e `browser/statusParser/`.
7. O sistema SHALL manter 100% dos testes de regressão existentes passando sem alterações em rotas ou contratos de API.
