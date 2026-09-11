# Sincronização e Exibição de Status "Aguardando Assinatura de [Nome]" Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

---

**Spec**: `.specs/features/status-aguardando-assinatura/spec.md`
**Status**: Em Execução — Fases 1–2 concluídas (T1–T4 ✅ + code review/correções); T5 (frontend cross-repo) e gate final pendentes

---

## Test Coverage Matrix

> Generated from codebase and project guidelines (`AGENTS.md`, `.agents/rules/global.md`). Regressão exclusiva com runner nativo Node.js.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Models / Schemas | integration | Validação de schema e persistência de novos campos | `tests/backend/models/*.test.js` | `npm run test:backend` |
| Parser / Robô RPA | integration | Regressão de normalização de status e extração de signatários | `tests/robot/*.test.js` | `npm run test:robot` |
| Sincronização / Backend | integration | Regressão de varredura e matching de envelopes | `tests/backend/services/*.test.js` | `npm run test:backend` |
| Frontend UI / Dashboard | manual | Verificação visual dos badges dinâmicos e filtros | `gestor-oportunidades` UI | manual |

---

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após alterações no Robô RPA | `npm run test:robot` |
| Full | Após alterações no Backend / Services | `npm run test:backend` |
| Build | Após conclusão das fases | `npm test` |

---

## Execution Plan

### Phase 1: Foundation & Persistence
```
T1 → T2
```

### Phase 2: Core RPA & Backend Integration
```
T2 → T3 → T4
```

### Phase 3: Frontend Presentation & Regression
```
T4 → T5 → T6
```

---

## Task Breakdown

### T1: Atualização de Schemas no Backend

**What**: Adicionar campos `pendingSigner`, `docusignStatusDetail`, `rawDocusignStatus` aos schemas Mongoose com JSDoc completo.
**Where**: `backend/src/models/Contract.js`
**Depends on**: None
**Requirement**: STATUS-02
**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Campos adicionados ao Schema `contractSchema` e anotações `@typedef` atualizadas (typedef de `status` corrigido para incluir `em_processamento_robot`)
- [x] JSDoc completo em conformidade com as regras do projeto
- [x] Gate check passes: `npm run test:backend` — regressão direcionada `tests/backend/models/Contract.test.js` ✔

**Tests**: integration
**Gate**: full

---

### T2: Atualização de Schemas de Envelopes

**What**: Adicionar campos de status detalhado ao schema de DocusignEnvelope e modelo compartilhado.
**Where**: `backend/src/models/DocusignEnvelope.js`
**Depends on**: T1
**Requirement**: STATUS-02
**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Schema `DocusignEnvelope` atualizado com novos campos de signatário e status detalhado (upsert realizado por `contractStatusSyncService`)
- [x] Gate check passes: `npm run test:backend` — regressão direcionada via suíte de varredura ✔

**Tests**: integration
**Gate**: full

---

### T3: Extração de Signatários no Robô RPA

**What**: Atualizar `statusParser.js` e `agreements.js` para capturar `rawStatus` e extrair o `pendingSigner` limpo ou mensagens de terceiros.
**Where**: `robot/src/browser/statusParser.js`
**Depends on**: T2
**Requirement**: STATUS-01
**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Função `normalizeEnvelopeStatus` extrai `pendingSigner` e preserva rótulos como "Anulado" e "Aguardando terceiros" (+ `stripPendingSignerNoise` e paridade pt-BR/en com termo `waiting` — correção F1)
- [x] `extractEnvelopesFromCurrentPage` inclui metadados enriquecidos no payload (`rawStatus`, `statusDetail`, `pendingSigner`)
- [x] Gate check passes: `npm run test:robot` — `tests/robot/browser/docusign.test.js` ✔ (fachada `docusign.js` re-exporta `extractPendingSigner`)

**Tests**: integration
**Gate**: quick

---

### T4: Orquestração de Sincronização e Emissão SSE

**What**: Integrar novos campos no matcher de envelopes, salvar no banco e emitir evento SSE `job:progress`.
**Where**: `backend/src/modules/robot-docusign/seletorApiRobot/contractStatusSyncService.js`
**Depends on**: T3
**Requirement**: STATUS-03
**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `contractStatusSyncService` persiste novos campos e emite `job:progress` com `pendingSigner` (varredura direta e modo pull via `result.envelopes`)
- [x] `contractEnvelopeMatcher` e `contractSyncService` repassam dados sem perda (matcher: `aguardando`/`waiting*` → `enviado`)
- [x] Gate check passes: `npm run test:backend` — `tests/backend/services/statusSyncScheduler.test.js` ✔ + `tests/backend/controllers/updateJobStatus-logs.test.js` 3/3 ✔

**Tests**: integration
**Gate**: full

---

### T5: Renderização de Badges e Filtros no Frontend

**What**: Atualizar utilitários de status e filtros do CRM Funil para renderizar badges `AGUARDANDO [NOME]` e `ANULADO` com truncamento e tooltip.
**Where**: `c:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/contratos/dashboard/utils/contract-status.js`
**Depends on**: T4
**Requirement**: STATUS-04, STATUS-05
**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `getContractStatusMeta` formata statusLabel como `AGUARDANDO [NOME]` ou `ANULADO`
- [ ] Nomes > 25 caracteres são truncados com reticências
- [ ] Filtros do dashboard aceitam contratos com assinaturas pendentes

**Tests**: none
**Gate**: build

---

### T6: Validação Integrada de Regressão

**What**: Executar testes de regressão para assegurar integridade dos contratos de API e fluxos de automação.
**Where**: `tests/`
**Depends on**: T5
**Requirement**: STATUS-06
**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Testes de regressão do backend e do robô passam sem falhas — suítes direcionadas: `tests/robot/browser/docusign.test.js`, `tests/backend/services/statusSyncScheduler.test.js`, `tests/backend/controllers/updateJobStatus-logs.test.js` (3/3), `tests/backend/models/Contract.test.js`
- [ ] Gate check passes: `npm test` — suíte completa pendente; executar imediatamente antes do commit

**Tests**: integration
**Gate**: build

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Atualização de Schemas no Backend | 1 file (Contract.js) | ✅ Granular |
| T2: Atualização de Schemas de Envelopes | 1 file (DocusignEnvelope.js) | ✅ Granular |
| T3: Extração de Signatários no Robô RPA | 1 file (statusParser.js) | ✅ Granular |
| T4: Orquestração de Sincronização e Emissão SSE | 1 file (contractStatusSyncService.js) | ✅ Granular |
| T5: Renderização de Badges e Filtros no Frontend | 1 file (contract-status.js) | ✅ Granular |
| T6: Validação Integrada de Regressão | Suíte de testes | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | None | ✅ Match |
| T2 | T1 | T1 | ✅ Match |
| T3 | T2 | T2 | ✅ Match |
| T4 | T3 | T3 | ✅ Match |
| T5 | T4 | T4 | ✅ Match |
| T6 | T5 | T5 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1: Atualização de Schemas no Backend | Models / Schemas | integration | integration | ✅ OK |
| T2: Atualização de Schemas de Envelopes | Models / Schemas | integration | integration | ✅ OK |
| T3: Extração de Signatários no Robô RPA | Parser / Robô RPA | integration | integration | ✅ OK |
| T4: Orquestração de Sincronização e Emissão SSE | Sincronização / Backend | integration | integration | ✅ OK |
| T5: Renderização de Badges e Filtros no Frontend | Frontend UI / Dashboard | none | none | ✅ OK |
| T6: Validação Integrada de Regressão | Suíte de testes | integration | integration | ✅ OK |
