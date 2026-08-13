# Tasks: Adição de Campos de Datas VTME na Importação

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

---

**Spec**: `.specs/features/opportunity-import/spec-vtme-dates.md`  
**Status**: Approved  

---

## Test Coverage Matrix

> Generated from codebase, project guidelines (AGENTS.md), and spec. Guidelines found: `AGENTS.md`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Backend Model | Unit Test | Schema validation | `src/models/Opportunity.js` | `npm test` |
| Backend Service | Unit Test | Update logic | `src/modules/import-opportunities/services/update-opportunity-fields.js` | `npm test` |
| Frontend Constants | none | UI availability | `public/modules/import-profile/constants.js` | Build gate / syntax check |
| Frontend Auto-mapper | none | Mapping logic | `public/modules/import-profile/auto-mapper.js` | Build gate / syntax check |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Model Schema | Yes | Alteração isolada de schema Mongoose | Modelo independentemente testável |
| Service Update | Yes | Lógica isolada de atualização | Serviço com dependências injetáveis |
| Constants UI | Yes | Adição de itens a array constante | Arquivo isolado no frontend |
| Auto-mapper | Yes | Adição de sinônimos a objeto | Arquivo isolado no frontend |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após alterações em arquivos isolados | `npm test` |
| Full | Validação de fluxo e build | `npm test` |
| Build | Após conclusão das tasks | `npm test` |

---

## Execution Plan

### Phase 1: Backend - Model e Service (Parallel)

```
T1 ──→ T2
T1 ──→ T3
```

### Phase 2: Frontend - Constants e Auto-mapper (Sequential)

```
T2 ──→ T4
T3 ──→ T4
T4 ──→ T5
```

### Phase 3: Validação

```
T5 ──→ T6
```

---

## Task Breakdown

### T1: Adicionar Campos de Data VTME ao Schema do Opportunity

**What**: Adicionar dois novos campos de tipo Date ao schema do modelo Opportunity: `data_insercao_vtme` e `data_ativacao_vtme`.  
**Where**: `src/models/Opportunity.js`  
**Depends on**: None  
**Reuses**: Estrutura existente do schema  
**Requirement**: [REQ-001]  

**Tools**:
- MCP: NONE
- Skill: `impact-protector`

**Done when**:
- [ ] Campo `data_insercao_vtme` adicionado como `{ type: Date }`
- [ ] Campo `data_ativacao_vtme` adicionado como `{ type: Date }`
- [ ] Campos são opcionais (não required)
- [ ] Schema continua válido e sem erros de sintaxe

**Tests**: none  
**Gate**: quick  

---

### T2: Adicionar Campos à Lista de Permitidos no Service

**What**: Adicionar `data_insercao_vtme` e `data_ativacao_vtme` ao array `allowedFields` no serviço de atualização.  
**Where**: `src/modules/import-opportunities/services/update-opportunity-fields.js`  
**Depends on**: T1  
**Reuses**: Estrutura existente do array allowedFields  
**Requirement**: [REQ-002]  

**Tools**:
- MCP: NONE
- Skill: `impact-protector`

**Done when**:
- [ ] `data_insercao_vtme` adicionado ao array `allowedFields`
- [ ] `data_ativacao_vtme` adicionado ao array `allowedFields`
- [ ] Lógica de comparação de datas funciona corretamente
- [ ] Mudanças são registradas no log de auditoria

**Tests**: none  
**Gate**: quick  

---

### T3: Adicionar Campos ao constants.js para Mapeamento

**What**: Adicionar os novos campos ao array `DB_FIELDS` no frontend para disponibilizar no mapeamento.  
**Where**: `public/modules/import-profile/constants.js`  
**Depends on**: None  
**Reuses**: Estrutura existente do array DB_FIELDS  
**Requirement**: [REQ-003]  

**Tools**:
- MCP: NONE
- Skill: `impact-protector`

**Done when**:
- [ ] `{ value: "data_insercao_vtme", label: "Data Inserção VTME" }` adicionado
- [ ] `{ value: "data_ativacao_vtme", label: "Data Ativação VTME" }` adicionado
- [ ] Campos estão na seção de campos nativos
- [ ] Labels são claros e em português

**Tests**: none  
**Gate**: quick  

---

### T4: Adicionar Sinônimos no Auto-mapper

**What**: Adicionar sinônimos para mapeamento automático dos novos campos VTME no auto-mapper.  
**Where**: `public/modules/import-profile/auto-mapper.js`  
**Depends on**: T3  
**Reuses**: Estrutura existente do objeto synonyms  
**Requirement**: [REQ-003]  

**Tools**:
- MCP: NONE
- Skill: `impact-protector`

**Done when**:
- [ ] Sinônimos adicionados para `data_insercao_vtme`: `insercaovtme`, `datainsercaovtme`, `datainsercao`
- [ ] Sinônimos adicionados para `data_ativacao_vtme`: `ativacaovtme`, `dataativacaovtme`, `dataativacao`
- [ ] Mapeamentos legados preservados: `ativacao` → `imported_data.activation_date`, `data` → `imported_data.insertion_date`
- [ ] Função `findBestMatch` continua funcionando corretamente

**Tests**: none  
**Gate**: quick  

---

### T5: Testar Integração Completa

**What**: Verificar que os novos campos funcionam corretamente no fluxo completo de importação.  
**Where**: Todos os arquivos afetados  
**Depends on**: T1, T2, T3, T4  
**Reuses**: N/A  
**Requirement**: [REQ-001], [REQ-002], [REQ-003]  

**Tools**:
- MCP: NONE
- Skill: `impact-protector`

**Done when**:
- [ ] Campos aparecem na UI de mapeamento
- [ ] Auto-mapper sugere corretamente para colunas com nomes VTME
- [ ] Datas são parseadas corretamente do formato brasileiro
- [ ] Campos são salvos no MongoDB corretamente
- [ ] Mudanças são registradas no log de auditoria
- [ ] Todos os testes existentes continuam passando

**Tests**: unit tests  
**Gate**: full  

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 ──→ T2
  T1 ──→ T3

Phase 2 (Sequential):
  T2 ──→ T4
  T3 ──→ T4
  T4 ──→ T5

Phase 3 (Sequential):
  T5 ──→ T6
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Adicionar campos ao schema | 1 arquivo (adição de 2 campos) | ✅ Granular |
| T2: Adicionar ao allowedFields | 1 arquivo (adição de 2 itens ao array) | ✅ Granular |
| T3: Adicionar ao constants.js | 1 arquivo (adição de 2 objetos ao array) | ✅ Granular |
| T4: Adicionar sinônimos ao auto-mapper | 1 arquivo (adição de 6 sinônimos) | ✅ Granular |
| T5: Testar integração | Validação de fluxo completo | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Start | ✅ Match |
| T2 | T1 | T1 ──→ T2 | ✅ Match |
| T3 | None | Start | ✅ Match |
| T4 | T3 | T3 ──→ T4 | ✅ Match |
| T5 | T1, T2, T3, T4 | Convergence | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Backend Model | Unit Test | none | ✅ OK |
| T2 | Backend Service | Unit Test | none | ✅ OK |
| T3 | Frontend Constants | none | none | ✅ OK |
| T4 | Frontend Auto-mapper | none | none | ✅ OK |
| T5 | Integration | unit tests | unit tests | ✅ OK |
