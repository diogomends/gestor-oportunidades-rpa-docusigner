# Dashboard de Contratos — Refatoramento SOLID Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow.

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/contratos/sub-specs/dashboard-contratos-refactor/design.md`
**Status**: Completed

---

## Test Coverage Matrix

> Gerado com base no codebase e AGENTS.md. Testes `npm test` cobrem backend (Node --test). Nenhum framework de teste para módulos ES6 do frontend. Verificacao: manual + visual.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Frontend ES6 modules | none | — (manual verification only) | `public/modules/contratos/dashboard/**/*.js` | N/A — carregar pagina no navegador |
| HTML | none | — (manual verification only) | `public/modules/contratos/contratos.html` | N/A — carregar pagina no navegador |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| N/A (no tests) | N/A | N/A | Nenhum teste automatizado para frontend modules |

## Gate Check Commands

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Apos criar modulos individuais | Verificar console do navegador (zero erros de import) |
| Full | Apos Phase 3 (integracao completa) | Testar manualmente: carregar contratos, filtrar, upload, visualizar, deletar, vincular oportunidade |
| Build | Apos deletar arquivo original | idem Full + confirmar que stepper step 6 funciona |

---

## Execution Plan

### Phase 1: Foundation (Parallel)
Modulos leaf — zero ou minima dependencia. Podem rodar em qualquer ordem.

```
T1 [P] ──── state.js + constants.js
T2 [P] ──── utils/clipboard.js + utils/formatters.js
T3 [P] ──── render/render-attachment-item.js
T4 [P] ──── modals.js
```

### Phase 2: Core Domain (Parallel, apos Phase 1)
Modulos que dependem de state, render-attachment, formatters ou modals.

```
T5  [P] ──── render/render-contracts.js
T6  [P] ──── api.js
T7  [P] ──── filters/ (6 arquivos: toggle, visibility, apply, filter, clear, populate)
T8  [P] ──── file-actions/ (4 arquivos: view, download, upload, delete)
T9  [P] ──── opportunity-link.js
T10 [P] ──── view-opportunity.js
```

### Phase 3: Integration & Cleanup (Sequential, apos Phase 2)
Encadeamento obrigatorio: events → index → HTML → delete.

```
T11 ──── events/ (2 arquivos: setup-event-listeners.js, setup-dynamic-button-events.js)
  │
T12 ──── index.js (entrypoint)
  │
T13 ──── Atualizar contratos.html + remover arquivo original antigo
```

---

## Task Breakdown

### T1: state.js + constants.js [P]

**What**: Criar `state.js` (7 vars mutaveis) e `constants.js` (REQUIRED_DOCS_BY_TYPE)
**Where**: `public/modules/contratos/dashboard/state.js`, `public/modules/contratos/dashboard/constants.js`
**Depends on**: None
**Reuses**: `getUser()`, `getToken()` de `/js/core/session.js`
**Requirement**: REFACTOR-STATE-01, REFACTOR-STATE-02, REFACTOR-CONST-01

**Tools**: None

**Done when**:
- [x] `state.js` exporta: `allContracts`, `currentUser`, `deleteTarget`, `selectedContractIdForLink`, `selectedOpportunityIdForLink`, `currentOpportunitiesList`, `currentAttachmentTarget`
- [x] `constants.js` exporta: `REQUIRED_DOCS_BY_TYPE` com 7 tipos empresariais
- [x] `state.js` importa e inicializa `currentUser` via `getUser()` de session.js

**Tests**: none
**Gate**: quick

---

### T2: utils/clipboard.js + utils/formatters.js [P]

**What**: Criar `utils/clipboard.js` (1 funcao) e `utils/formatters.js` (7 funcoes)
**Where**: `public/modules/contratos/dashboard/utils/`
**Depends on**: None
**Reuses**: `navigator.clipboard` nativo
**Requirement**: REFACTOR-UTIL-01, REFACTOR-UTIL-02

**Tools**: None

**Done when**:
- [x] `utils/clipboard.js` exporta `copyToClipboard(text, successMessage)`
- [x] `utils/formatters.js` exporta: `formatCurrencySimple`, `formatDateSimple`, `createBadgeSimple`, `formatObservationsSimple`, `createReportField`, `createReportSection`, `createItemsTableSimple`
- [x] Todas as funcoes sao puras (zero dependencias externas)
- [x] Gate quick: console sem erros de import

**Tests**: none
**Gate**: quick

---

### T3: render/render-attachment-item.js [P]

**What**: Extrair `renderAttachmentItem()` para modulo proprio
**Where**: `public/modules/contratos/dashboard/render/render-attachment-item.js`
**Depends on**: T1 (state.js)
**Reuses**: Template HTML original (preservado 100%)
**Requirement**: REFACTOR-RENDER-02

**Tools**: None

**Done when**:
- [x] Exporta `renderAttachmentItem(contractId, fileType, index, name, iconClass, role, isPresent, docType)`
- [x] Retorna HTML string identico ao original (tag verde presente / tag vermelha pendente)
- [x] Import state.js para ler `currentUser.cargo`
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T4: modals.js [P]

**What**: Extrair 5 funcoes de modal para modulo proprio
**Where**: `public/modules/contratos/dashboard/modals.js`
**Depends on**: T1 (state.js)
**Reuses**: DOM manipulation original (classList.add/remove)
**Requirement**: REFACTOR-MODAL-01

**Tools**: None

**Done when**:
- [x] Exporta: `openDeleteModal(contractId, fileType, index, name)`, `closeDeleteModal()`, `openAttachmentActionsModal(contractId, fileType, index, name)`, `closeAttachmentActionsModal()`, `closeViewModal()`
- [x] `openDeleteModal` define `state.deleteTarget` e manipula `#deleteConfirmModal`
- [x] `openAttachmentActionsModal` define `state.currentAttachmentTarget`, aplica ACL por role
- [x] `closeViewModal` limpa canvas de PDF e revoga ObjectURLs
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T5: render/render-contracts.js (165 linhas) [P]

**What**: Extrair `renderContracts()` para modulo proprio — a funcao mais complexa
**Where**: `public/modules/contratos/dashboard/render/render-contracts.js`
**Depends on**: T1 (state.js), T2 (formatters.js), T3 (render-attachment-item.js)
**Reuses**: Template HTML original preservado 100%, `renderAttachmentItem` do T3
**Requirement**: REFACTOR-RENDER-01

**Tools**: None

**Done when**:
- [x] Exporta `renderContracts(contracts)`
- [x] Gera cards em `#contractsContainer` com: nome cliente, CNPJ, status, badges, planos, anexos
- [x] Usa `renderAttachmentItem()` importado do T3
- [x] Gera botoes de acao (Vincular Oportunidade, Copiar Link, Reenviar) com ACL por cargo
- [x] Template string com `onclick="openViewOpportunityModal(...)"` preservado (depende de `window.openViewOpportunityModal` exportado no T12)
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T6: api.js [P]

**What**: Extrair chamadas fetch para modulo proprio
**Where**: `public/modules/contratos/dashboard/api.js`
**Depends on**: T1 (state.js), T5 (render-contracts.js)
**Reuses**: `getToken()` de session.js
**Requirement**: REFACTOR-API-01, REFACTOR-API-02

**Tools**: None

**Done when**:
- [x] Exporta `loadContracts()` — GET /api/contracts, atualiza `state.allContracts`, chama `renderContracts()`
- [x] Exporta `fetchClientDocLink(contractId)` — retorna `{ linkUrl }`
- [x] Tratamento de erro identico ao original (alert + console.error)
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T7: filters/ (6 arquivos) [P]

**What**: Criar 6 arquivos, cada um com uma funcao de filtro
**Where**: `public/modules/contratos/dashboard/filters/`
**Depends on**: T1 (state.js), T5 (render-contracts.js)
**Reuses**: Logica original de filtros (applyContractFilters ~80 linhas)
**Requirement**: REFACTOR-FILT-01 a REFACTOR-FILT-06

**Tools**: None

**Done when**:
- [x] `apply-contract-filters.js`: filtra `state.allContracts` por texto/status/data/vendedor/supervisor/coordenador, ordena e chama `renderContracts()`
- [x] `toggle-contracts-filters.js`: alterna `#contractsFilterBar` display
- [x] `clear-contract-filters.js`: reseta selects e input, renderiza todos
- [x] `populate-contract-filters.js`: busca `/users`, popula selects de vendedor/supervisor/coordenador
- [x] `apply-contracts-filter-visibility.js`: mostra/esconde grupos de filtro por role
- [x] `filter-contracts.js`: delega para `applyContractFilters()`
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T8: file-actions/ (4 arquivos) [P]

**What**: Criar 4 arquivos, cada um com uma acao sobre anexos
**Where**: `public/modules/contratos/dashboard/file-actions/`
**Depends on**: T1 (state.js), T6 (api.js)
**Reuses**: `window.pdfjsLib`, `getToken()` de session.js
**Requirement**: REFACTOR-FILE-01 a REFACTOR-FILE-04

**Tools**: None

**Done when**:
- [x] `view-attachment-file.js`: fetch seguro, renderiza PDF (PDF.js canvas) ou imagem (overlay protegido)
- [x] `download-attachment-file.js`: link temporario com token, dispara download
- [x] `handle-dashboard-upload.js`: input file, validacao 10MB, POST upload, recarrega via `loadContracts()`
- [x] `execute-attachment-deletion.js`: DELETE no backend, fecha modal, recarrega via `loadContracts()`
- [x] `view-attachment-file.js` usa `window.pdfjsLib` se disponivel
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T9: opportunity-link.js [P]

**What**: Extrair 4 funcoes de vinculacao de oportunidade
**Where**: `public/modules/contratos/dashboard/opportunity-link.js`
**Depends on**: T1 (state.js), T6 (api.js)
**Reuses**: `window.api.getCompatibleOpportunities`, `window.api.linkOpportunity`
**Requirement**: REFACTOR-OPP-01

**Tools**: None

**Done when**:
- [x] Exporta: `openLinkOpportunityModal(contractId, cnpj)`, `closeLinkOppModal()`, `renderOpportunitiesList(opportunities)`, `executeLinkOpportunity()`
- [x] `openLinkOpportunityModal` busca oportunidades via `window.api.getCompatibleOpportunities`
- [x] `renderOpportunitiesList` renderiza lista com highlight ao selecionar
- [x] `executeLinkOpportunity` chama `window.api.linkOpportunity`, recarrega contratos e fecha modal
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T10: view-opportunity.js [P]

**What**: Extrair modal de visualizacao de oportunidade com relatorio
**Where**: `public/modules/contratos/dashboard/view-opportunity.js`
**Depends on**: T1 (state.js), T2 (formatters.js)
**Reuses**: 7 helpers de `utils/formatters.js`
**Requirement**: REFACTOR-VIEW-01

**Tools**: None

**Done when**:
- [x] Exporta: `openViewOpportunityModal(id)`, `closeViewOpportunityModal()`, `buildOpportunityReportHTML(item)`
- [x] `openViewOpportunityModal` faz fetch GET `/api/opportunities/:id` e renderiza relatorio
- [x] `buildOpportunityReportHTML` usa `formatCurrencySimple`, `formatDateSimple`, `createBadgeSimple`, `formatObservationsSimple`, `createReportField`, `createReportSection`, `createItemsTableSimple`
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T10b: view-contract.js [P]

**What**: Extrair modal de visualizacao de contrato (dados do formulario de contratos)
**Where**: `public/modules/contratos/dashboard/view-contract.js`
**Depends on**: T2 (formatters.js)
**Reuses**: helpers de `utils/formatters.js`
**Requirement**: REFACTOR-VIEW-02

**Tools**: None

**Done when**:
- [x] Exporta: `openViewContractModal(id)`, `closeViewContractModal()`, `buildContractReportHTML(item)`
- [x] `openViewContractModal` faz fetch GET `/api/contracts/:id` e renderiza relatorio de contrato
- [x] `buildContractReportHTML` usa `formatCurrencySimple`, `formatDateSimple`, `createReportField`, `createReportSection`
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T11: events/ (2 arquivos)

**What**: Extrair `setupEventListeners` e `setupDynamicButtonEvents` cada um em seu arquivo
**Where**: `public/modules/contratos/dashboard/events/`
**Depends on**: T4 (modals.js), T7 (filters), T8 (file-actions), T9 (opportunity-link.js), T6 (api.js), T1 (state.js)
**Reuses**: `addEventListener` padrao (AD-010)
**Requirement**: REFACTOR-EVENTS-01, REFACTOR-EVENTS-02

**Tools**: None

**Done when**:
- [x] `setup-event-listeners.js`: registra listeners estaticos (search input, botoes de modal, search opp com debounce)
- [x] `setup-dynamic-button-events.js`: registra listeners em elementos querySelectorAll (.attachment-item.present, .btn-upload, .btn-copy-doc-link, .btn-resend-docusign, .btn-link-opportunity)
- [x] `setup-dynamic-button-events.js` usa `copyToClipboard` de utils/clipboard.js
- [x] `setup-dynamic-button-events.js` chama `modal.js` funcoes, `file-actions/*` funcoes, `opportunity-link.js` funcoes
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T12: index.js (Entrypoint)

**What**: Criar entrypoint que importa todos os modulos, inicializa pagina e exporta para window
**Where**: `public/modules/contratos/dashboard/index.js`
**Depends on**: TODOS os T1-T11
**Reuses**: `DOMContentLoaded` original, `window.pdfjsLib` worker config
**Requirement**: REFACTOR-HTML-03, REFACTOR-REGR-01

**Tools**: None

**Done when**:
- [x] Configura `window.pdfjsLib.GlobalWorkerOptions.workerSrc` (original lines 3-7)
- [x] `DOMContentLoaded`: verifica `currentUser`, `token`, bloqueia contextmenu no `#viewAttachmentModal`, chama `setupEventListeners()`, chama `loadContracts()`
- [x] Exporta para window: `loadContractsDashboard`, `toggleContractsFilters`, `applyContractFilters`, `clearContractFilters`
- [x] Exporta para window: `openViewOpportunityModal`, `closeViewOpportunityModal` (usadas por template string onclick + HTML)
- [x] Gate quick: console sem erros

**Tests**: none
**Gate**: quick

---

### T13: Atualizar contratos.html + Remover arquivo antigo

**What**: Alterar HTML para carregar novo entrypoint + remover onclick + deletar arquivo monolito original
**Where**: `public/modules/contratos/contratos.html`
**Depends on**: T12 (index.js criado)
**Reuses**: Estrutura HTML existente
**Requirement**: REFACTOR-HTML-01, REFACTOR-HTML-02, REFACTOR-REGR-01 a REFACTOR-REGR-06

**Tools**: None

**Done when**:
- [x] `<script type="module" src="/modules/contratos/dashboard-contratos-docusigner.js">` substituido por `<script type="module" src="/modules/contratos/dashboard/index.js">`
- [x] 3 `onclick` de filtro removidos: `onclick="window.toggleContractsFilters()"`, `onclick="window.applyContractFilters()"`, `onclick="window.clearContractFilters()"`
- [x] 2 `onclick` de modal oportunidade removidos: `onclick="closeViewOpportunityModal()"`
- [x] `ToggleContractsFilters` button recebe id `#btnToggleContractsFilters` para addEventListener
- [x] `Filter` button recebe id `#btnApplyContractFilters` para addEventListener
- [x] `Clear` button recebe id `#btnClearContractFilters` para addEventListener
- [x] `Close` buttons do modal oportunidade recebem id `#btnCloseViewOppModal` para addEventListener
- [x] Arquivo `dashboard-contratos-docusigner.js` deletado
- [x] Gate full: testar pagina completa — contratos carregam, filtros funcionam, upload/view/delete/link funcionam por cargo

**Tests**: none
**Gate**: full

---

## Parallel Execution Map

```
Phase 1 (Parallel — 4 tasks):
  T1 [P]   State + Constants
  T2 [P]   Utils
  T3 [P]   Render Attachment
  T4 [P]   Modals

Phase 2 (Parallel — 6 tasks, apos Phase 1):
  T1,T2,T3,T4 completos, entao:
    T5  [P]   Render Contracts
    T6  [P]   API
    T7  [P]   Filters (6 arquivos)
    T8  [P]   File Actions (4 arquivos)
    T9  [P]   Opportunity Link
    T10 [P]   View Opportunity

Phase 3 (Sequential — 3 tasks, apos Phase 2):
  T5-T10 completos, entao:
    T11 ──→ T12 ──→ T13
```

**Parallelism constraint:** `[P]` marks tasks with no inter-task dependency. Phase 1 tasks share no deps. Phase 2 tasks share deps only on Phase 1 (ja completa).

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1 | 2 config files | ✅ Cohesive |
| T2 | 2 utility files | ✅ Cohesive |
| T3 | 1 function file | ✅ Granular |
| T4 | 5 functions, 1 file | ✅ Cohesive (modals) |
| T5 | 1 function file (165 linhas) | ✅ Granular (maior funcao) |
| T6 | 2 functions, 1 file | ✅ Cohesive (API) |
| T7 | 6 files, mesmo dominio | ✅ Cohesive (filters) |
| T8 | 4 files, mesmo dominio | ✅ Cohesive (file actions) |
| T9 | 4 functions, 1 file | ✅ Cohesive (opportunity) |
| T10 | 3 functions, 1 file | ✅ Cohesive (view opp) |
| T11 | 2 files, mesmo dominio | ✅ Cohesive (events) |
| T12 | 1 entrypoint file | ✅ Granular |
| T13 | 1 HTML edit + 1 delete | ✅ Cohesive (cleanup) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Phase 1 root | ✅ Match |
| T2 | None | Phase 1 root | ✅ Match |
| T3 | T1 | Phase 1 → T3 (dep on T1) | ✅ Match |
| T4 | T1 | Phase 1 → T4 (dep on T1) | ✅ Match |
| T5 | T1, T2, T3 | Phase 2 (after Phase 1) | ✅ Match |
| T6 | T1, T5 | Phase 2 (after Phase 1) | ✅ Match |
| T7 | T1, T5 | Phase 2 (after Phase 1) | ✅ Match |
| T8 | T1, T6 | Phase 2 (after Phase 1) | ✅ Match |
| T9 | T1, T6 | Phase 2 (after Phase 1) | ✅ Match |
| T10 | T1, T2 | Phase 2 (after Phase 1) | ✅ Match |
| T11 | T4, T6, T7, T8, T9 | Phase 3 (after Phase 2) | ✅ Match |
| T12 | T1-T11 | Phase 3 (after Phase 2) | ✅ Match |
| T13 | T12 | Phase 3 (after Phase 2) | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1-T12 | Frontend ES6 modules | none | none | ✅ OK |
| T13 | HTML | none | none | ✅ OK |
