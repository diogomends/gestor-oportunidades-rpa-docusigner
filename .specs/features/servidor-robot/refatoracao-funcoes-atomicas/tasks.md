# Refatoração e Decomposição Modular em Funções Atômicas Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

---

**Spec**: `.specs/features/servidor-robot/refatoracao-funcoes-atomicas/spec.md`
**Status**: Completed

---

## Test Coverage Matrix

> Generated from codebase and project guidelines (`AGENTS.md`, `.agents/rules/global.md`). Regressão exclusiva com runner nativo Node.js.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Browserrobot RPA | integration | Regressão de consulta de acordos e normalização | `tests/backend/services/*.test.js` | `npm run test:backend` |
| SeletorApiRobot Matcher | integration | Regressão de matching de envelopes e sincronização | `tests/backend/services/*.test.js` | `npm run test:backend` |
| Controller Instance | integration | Regressão de atualização de status e anti-fantasma | `tests/backend/controllers/*.test.js` | `npm run test:backend` |
| Robô Standalone Browser | integration | Regressão de automação Playwright e parsers | `tests/robot/*.test.js` | `npm run test:robot` |
| Regressão Geral | integration | Integridade de todos os fluxos e barrels | `tests/**/*.test.js` | `npm test` |

---

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após alterações no Robô RPA | `npm run test:robot` |
| Full | Após alterações no Backend / Services | `npm run test:backend` |
| Build | Após conclusão das fases | `npm test` |

---

## Execution Plan

### Phase 1: Browserrobot Agreements Decomposition
```
T1
```

### Phase 2: SeletorApiRobot Submodules Decomposition
```
T1 → T2 → T3
```

### Phase 3: Instance Controller Helpers Decomposition
```
T3 → T4
```

### Phase 4: Standalone Robot Decomposition
```
T4 → T5 → T6
```

### Phase 5: Regression & Verification
```
T6 → T7
```

---

## Task Breakdown

### T1: Decomposição de AgreementsService no Browserrobot

**What**: Decompor `agreementsService.js` (7 funções) em arquivos atômicos sob `backend/src/modules/robot-docusign/browserrobot/agreements/` (`normalizeSearchText.js`, `cleanSignerNameNoise.js`, `extractPendingSignerName.js`, `normalizeDocusignEnvelopeStatus.js`, `buildAgreementsFilterUrl.js`, `extractPageEnvelopeRows.js`, `queryRepresentativeAgreementsPaginated.js`) e manter `agreementsService.js` como fachada DIP.
**Where**: `backend/src/modules/robot-docusign/browserrobot/agreementsService.js`
**Depends on**: None
**Requirement**: ATOM-01, ATOM-06

**Done when**:
- [x] Subpasta `agreements/` criada com os 7 arquivos atômicos individuais
- [x] `agreementsService.js` preserva re-exportações named e default export com JSDoc completo
- [x] Gate check passes: `npm run test:backend`

**Tests**: integration
**Gate**: full

---

### T2: Decomposição de ContractEnvelopeMatcher

**What**: Decompor `contractEnvelopeMatcher.js` (3 funções) em arquivos atômicos sob `backend/src/modules/robot-docusign/seletorApiRobot/envelopeMatcher/` (`normalizeComparisonText.js`, `convertDocusignStatusToContractStatus.js`, `matchContractWithDocusignEnvelope.js`) e manter `contractEnvelopeMatcher.js` como fachada DIP.
**Where**: `backend/src/modules/robot-docusign/seletorApiRobot/contractEnvelopeMatcher.js`
**Depends on**: T1
**Requirement**: ATOM-03, ATOM-06

**Done when**:
- [x] Subpasta `envelopeMatcher/` criada com os 3 arquivos atômicos individuais
- [x] `contractEnvelopeMatcher.js` atua como fachada DIP re-exportando named e default exports
- [x] Gate check passes: `npm run test:backend`

**Tests**: integration
**Gate**: full

---

### T3: Decomposição de ContractStatusSyncService

**What**: Decompor `contractStatusSyncService.js` (2 funções) em arquivos atômicos sob `backend/src/modules/robot-docusign/seletorApiRobot/statusSync/` (`getStatusSyncRunningState.js`, `orchestrateAllContractsStatusSync.js`) e manter `contractStatusSyncService.js` como fachada DIP.
**Where**: `backend/src/modules/robot-docusign/seletorApiRobot/contractStatusSyncService.js`
**Depends on**: T2
**Requirement**: ATOM-04, ATOM-06

**Done when**:
- [x] Subpasta `statusSync/` criada com arquivos atômicos
- [x] `contractStatusSyncService.js` preserva re-exportações named e default export com JSDoc completo
- [x] Gate check passes: `npm run test:backend`

**Tests**: integration
**Gate**: full

---

### T4: Decomposição de UpdateJobStatus e Reconciliação Batch

**What**: Isolar `reconcileCompletedQueryAgreements.js` em módulo atômico sob `backend/src/modules/robot-docusign/controllers/instance/updateJobStatus/reconcileCompletedQueryAgreements.js` e manter `updateJobStatus.js` limpo e focado no controller handler.
**Where**: `backend/src/modules/robot-docusign/controllers/instance/updateJobStatus.js`
**Depends on**: T3
**Requirement**: ATOM-02, ATOM-06

**Done when**:
- [x] `reconcileCompletedQueryAgreements.js` criado com JSDoc completo e validação Zod isolada
- [x] `updateJobStatus.js` importa o helper atômico e executa o fluxo com anti-fantasma e SSE
- [x] Gate check passes: `npm run test:backend`

**Tests**: integration
**Gate**: full

---

### T5: Decomposição de StatusParser no Robô Standalone

**What**: Decompor `robot/src/browser/statusParser.js` (4 funções) em arquivos atômicos sob `robot/src/browser/statusParser/` (`normalizeComparisonText.js`, `cleanSignerNameNoise.js`, `extractPendingSignerName.js`, `normalizeDocusignEnvelopeStatus.js`) e manter `statusParser.js` como fachada DIP.
**Where**: `robot/src/browser/statusParser.js`
**Depends on**: T4
**Requirement**: ATOM-05, ATOM-06

**Done when**:
- [x] Subpasta `robot/src/browser/statusParser/` criada com os 4 arquivos atômicos
- [x] `robot/src/browser/statusParser.js` atua como fachada DIP com re-exportação named e default
- [x] Gate check passes: `npm run test:robot`

**Tests**: integration
**Gate**: quick

---

### T6: Decomposição de Agreements no Robô Standalone

**What**: Decompor `robot/src/browser/agreements.js` (2 funções) em arquivos atômicos sob `robot/src/browser/agreements/` (`extractPageEnvelopeRows.js`, `queryRepresentativeAgreementsPaginated.js`) e manter `agreements.js` como fachada DIP.
**Where**: `robot/src/browser/agreements.js`
**Depends on**: T5
**Requirement**: ATOM-05, ATOM-06

**Done when**:
- [x] Subpasta `robot/src/browser/agreements/` criada com arquivos atômicos
- [x] `robot/src/browser/agreements.js` atua como fachada DIP com re-exportação named e default
- [x] Gate check passes: `npm run test:robot`

**Tests**: integration
**Gate**: quick

---

### T7: Validação e Regressão Integrada

**What**: Validar integridade geral dos barrels, resolução de módulos ES Modules e execução da suíte de regressão sem erros.
**Where**: `tests/`
**Depends on**: T6
**Requirement**: ATOM-06

**Done when**:
- [x] Todos os módulos refatorados exportam contratos idênticos aos originais
- [x] Gate check passes: `npm test`

**Tests**: integration
**Gate**: build
