# Dashboard de Contratos DocuSign — Refatoramento SOLID

## Problem Statement

O arquivo `dashboard-contratos-docusigner.js` (1397 linhas, 39 funções) concentra múltiplas responsabilidades acopladas: estado global, chamadas de API, renderização de DOM, manipulação de modais, filtros, upload, formatação e eventos. Isso viola o SRP (Single Responsibility Principle) e dificulta manutenção, testes e navegação no código.

## Goals

- [ ] Quebrar o monolito de 1397 linhas em ~25 arquivos coesos, cada um com 1-7 funções do mesmo domínio
- [ ] Eliminar toda dependência de `window.*` substituindo `onclick` inline por `addEventListener`
- [ ] Preservar 100% do comportamento existente (zero regression)
- [ ] Centralizar estado mutável em módulo próprio (`state.js`)

## Out of Scope

| Item | Motivo |
| ---- | ------ |
| Alteração de lógica de negócio | Refatoramento estrutural, não funcional |
| Criação/remoção de endpoints | Nenhuma mudança no backend |
| Refatoramento do CSS | Apenas JS é alvo |
| Criação de testes novos | Refatoramento preserva comportamento, não adiciona funcionalidade |
| Alteração no stepper de contratos | Navegação permanece idêntica |

---

## User Stories

### P1: Módulo de Estado Centralizado

**User Story**: Como desenvolvedor, quero que o estado global (contratos, usuário, alvos de modais) viva em um único módulo (`state.js`) com exports nomeados, para que qualquer submódulo importe o estado sem depender de escopo de closure.

**Acceptance Criteria**:

1. `REFACTOR-STATE-01`: WHEN o módulo for carregado THEN `state.js` SHALL exportar `allContracts`, `currentUser`, `deleteTarget`, `selectedContractIdForLink`, `selectedOpportunityIdForLink`, `currentOpportunitiesList`, `currentAttachmentTarget` como vars mutáveis
2. `REFACTOR-STATE-02`: WHEN qualquer submódulo importar `state.js` THEN SHALL ler/escrever o mesmo estado compartilhado

### P1: Módulo de Constantes

**User Story**: Como desenvolvedor, quero que `REQUIRED_DOCS_BY_TYPE` esteja em um arquivo separado (`constants.js`) para ser reutilizado sem arrastar o resto do dashboard.

**Acceptance Criteria**:

3. `REFACTOR-CONST-01`: WHEN `constants.js` for importado THEN SHALL exportar `REQUIRED_DOCS_BY_TYPE` com os mesmos 7 tipos empresariais e seus documentos exigidos

### P1: Módulo de API

**User Story**: Como desenvolvedor, quero que todas as chamadas `fetch` estejam isoladas em `api.js` para facilitar mocking em testes futuros.

**Acceptance Criteria**:

4. `REFACTOR-API-01`: WHEN `api.js` for importado THEN SHALL exportar `loadContracts()` que faz GET `/api/contracts` e atualiza `state.allContracts` + chama `renderContracts`
5. `REFACTOR-API-02`: WHEN `api.js` for importado THEN SHALL exportar `fetchClientDocLink(contractId)` que retorna `{ linkUrl }`

### P1: Módulos de Eventos Separados

**User Story**: Como desenvolvedor, quero que `setupEventListeners` e `setupDynamicButtonEvents` estejam em arquivos próprios dentro de `events/` para isolar a camada de UI.

**Acceptance Criteria**:

6. `REFACTOR-EVENTS-01`: WHEN `events/setup-event-listeners.js` for executado THEN SHALL registrar listeners para: `searchContract` (input), `btnCancelDelete` (click), `btnConfirmDelete` (click), `btnCloseViewModal` (click), `btnCloseAttachmentActions` (click), `btnCancelAttachmentActions` (click), `btnAttView` (click), `btnAttDownload` (click), `btnAttDelete` (click), `btnCloseLinkOppModal` (click), `btnCancelLinkOpp` (click), `btnConfirmLinkOpp` (click), `searchOppInput` (input)
7. `REFACTOR-EVENTS-02`: WHEN `events/setup-dynamic-button-events.js` for executado THEN SHALL registrar listeners em elementos .attachment-item.present, .btn-upload, .btn-copy-doc-link, .btn-resend-docusign, .btn-link-opportunity

### P1: Módulos de Renderização Separados

**User Story**: Como desenvolvedor, quero que `renderContracts` e `renderAttachmentItem` estejam em arquivos próprios dentro de `render/`.

**Acceptance Criteria**:

8. `REFACTOR-RENDER-01`: WHEN `render/render-contracts.js` for importado THEN SHALL exportar `renderContracts(contracts)` que gera os cards no `#contractsContainer` com status, badges, planos e anexos
9. `REFACTOR-RENDER-02`: WHEN `render/render-attachment-item.js` for importado THEN SHALL exportar `renderAttachmentItem(contractId, fileType, index, name, iconClass, role, isPresent, docType)` que retorna HTML string de tag verde (presente) ou vermelha (pendente)

### P1: Módulo de Filtros Separado em 6 Arquivos

**User Story**: Como desenvolvedor, quero que cada função de filtro tenha seu próprio arquivo em `filters/`.

**Acceptance Criteria**:

10. `REFACTOR-FILT-01`: WHEN `filters/apply-contract-filters.js` for importado THEN SHALL exportar `applyContractFilters()` que filtra `state.allContracts` por texto, status, data, vendedor, supervisor, coordenador e ordenação, e chama `renderContracts`
11. `REFACTOR-FILT-02`: WHEN `filters/toggle-contracts-filters.js` for importado THEN SHALL exportar `toggleContractsFilters()` que alterna visibilidade de `#contractsFilterBar`
12. `REFACTOR-FILT-03`: WHEN `filters/clear-contract-filters.js` for importado THEN SHALL exportar `clearContractFilters()` que reseta todos os filtros e renderiza `state.allContracts`
13. `REFACTOR-FILT-04`: WHEN `filters/populate-contract-filters.js` for importado THEN SHALL exportar `populateContractFilters()` que busca `/users` e popula os selects de filtro por cargo
14. `REFACTOR-FILT-05`: WHEN `filters/apply-contracts-filter-visibility.js` for importado THEN SHALL exportar `applyContractsFilterVisibility()` que mostra/esconde grupos de filtro por role
15. `REFACTOR-FILT-06`: WHEN `filters/filter-contracts.js` for importado THEN SHALL exportar `filterContracts()` que delega para `applyContractFilters()`

### P1: Módulo de Ações de Arquivo Separado em 4 Arquivos

**User Story**: Como desenvolvedor, quero que cada ação de arquivo (visualizar, baixar, upload, deletar) tenha seu próprio arquivo em `file-actions/`.

**Acceptance Criteria**:

16. `REFACTOR-FILE-01`: WHEN `file-actions/view-attachment-file.js` for importado THEN SHALL exportar `viewAttachmentFile(contractId, fileType, index, name)` que renderiza PDF com PDF.js ou imagem no modal `#viewAttachmentModal`
17. `REFACTOR-FILE-02`: WHEN `file-actions/download-attachment-file.js` for importado THEN SHALL exportar `downloadAttachmentFile(contractId, fileType, index)` que dispara download via link temporário
18. `REFACTOR-FILE-03`: WHEN `file-actions/handle-dashboard-upload.js` for importado THEN SHALL exportar `handleDashboardUpload(contractId, docType, docName)` que abre seletor de arquivo, valida tipo/tamanho e faz upload via POST
19. `REFACTOR-FILE-04`: WHEN `file-actions/execute-attachment-deletion.js` for importado THEN SHALL exportar `executeAttachmentDeletion()` que faz DELETE e recarrega contratos

### P1: Módulos de Modal Mantidos Coesos

**User Story**: Como desenvolvedor, quero que as funções de abrir/fechar modais estejam agrupadas por domínio.

**Acceptance Criteria**:

20. `REFACTOR-MODAL-01`: WHEN `modals.js` for importado THEN SHALL exportar `openDeleteModal`, `closeDeleteModal`, `openAttachmentActionsModal`, `closeAttachmentActionsModal`, `closeViewModal`
21. `REFACTOR-OPP-01`: WHEN `opportunity-link.js` for importado THEN SHALL exportar `openLinkOpportunityModal`, `closeLinkOppModal`, `renderOpportunitiesList`, `executeLinkOpportunity`
22. `REFACTOR-VIEW-01`: WHEN `view-opportunity.js` for importado THEN SHALL exportar `openViewOpportunityModal`, `closeViewOpportunityModal`, `buildOpportunityReportHTML`
22b. `REFACTOR-VIEW-02`: WHEN `view-contract.js` for importado THEN SHALL exportar `openViewContractModal`, `closeViewContractModal`, `buildContractReportHTML`

### P1: Utilitários Agrupados

**User Story**: Como desenvolvedor, quero que `copyToClipboard` esteja em `utils/clipboard.js` e os 7 helpers de formatação estejam em `utils/formatters.js`.

**Acceptance Criteria**:

23. `REFACTOR-UTIL-01`: WHEN `utils/clipboard.js` for importado THEN SHALL exportar `copyToClipboard(text, successMessage)`
24. `REFACTOR-UTIL-02`: WHEN `utils/formatters.js` for importado THEN SHALL exportar: `formatCurrencySimple`, `formatDateSimple`, `createBadgeSimple`, `formatObservationsSimple`, `createReportField`, `createReportSection`, `createItemsTableSimple`

### P1: Entrypoint Substitui onclick por addEventListener

**User Story**: Como desenvolvedor, quero que `index.js` seja o único ponto de entrada e que o HTML `contratos.html` não tenha mais `onclick` inline.

**Acceptance Criteria**:

25. `REFACTOR-HTML-01`: WHEN `contratos.html` for carregado THEN o script SHALL ser `<script type="module" src="/modules/contratos/dashboard/index.js">`
26. `REFACTOR-HTML-02`: WHEN a página carregar THEN nenhum botão de filtro ou modal de oportunidade SHALL usar atributo `onclick` no HTML — todos os eventos SHALL ser registrados via `addEventListener`
27. `REFACTOR-HTML-03`: WHEN o stepper ativar o step 6 THEN `window.loadContractsDashboard` SHALL estar disponível (exportado pelo entrypoint)

### P1: Zero Regression

**User Story**: Como desenvolvedor, quero que o comportamento do dashboard seja IDÊNTICO após o refatoramento.

**Acceptance Criteria**:

28. `REFACTOR-REGR-01`: WHEN a página carregar THEN os contratos SHALL ser carregados e renderizados como antes
29. `REFACTOR-REGR-02`: WHEN o usuário clicar em "Vincular Oportunidade" THEN o modal SHALL abrir com busca e vinculação funcionando
30. `REFACTOR-REGR-03`: WHEN o usuário clicar em um anexo presente THEN o modal de ações SHALL abrir
31. `REFACTOR-REGR-04`: WHEN o usuário aplicar filtros THEN a lista SHALL ser filtrada corretamente
32. `REFACTOR-REGR-05`: WHEN admin clicar em deletar THEN modal de confirmação SHALL aparecer e a deleção SHALL funcionar
33. `REFACTOR-REGR-06`: WHEN suporte clicar em visualizar THEN o modal com PDF.js/imagem SHALL abrir

---

## Edge Cases

| # | Caso | Comportamento Esperado |
| - | ---- | ---------------------- |
| 1 | Módulo importa outro módulo que ainda não foi migrado | Import falha — todos os módulos devem ser criados antes do entrypoint ser carregado |
| 2 | Elemento DOM não existe no momento do addEventListener | Verificação de existência (`if (el)`) preservada como no original |
| 3 | `state.js` é importado em múltiplos módulos | A importação de ES module retorna a mesma instância (singleton natural) |
| 4 | Módulo em diretórios em níveis diferentes importa `state.js` ou `api.js` | Deve usar o caminho relativo correto (`./state.js` para arquivos na raiz de `dashboard/` e `../state.js` para subpastas como `render/` ou `filters/`) para evitar que a requisição caia na rota SPA do Nginx e retorne o HTML com tipo `text/html`, causando falhas de carregamento |

---

## Requirement Traceability

| ID | Story | Status |
| -- | ----- | ------ |
| REFACTOR-STATE-01 | Módulo de Estado | Verified |
| REFACTOR-STATE-02 | Módulo de Estado | Verified |
| REFACTOR-CONST-01 | Módulo de Constantes | Verified |
| REFACTOR-API-01 | Módulo de API | Verified |
| REFACTOR-API-02 | Módulo de API | Verified |
| REFACTOR-EVENTS-01 | Eventos Separados | Verified |
| REFACTOR-EVENTS-02 | Eventos Separados | Verified |
| REFACTOR-RENDER-01 | Renderização Separada | Verified |
| REFACTOR-RENDER-02 | Renderização Separada | Verified |
| REFACTOR-FILT-01 | Filtros Separados | Verified |
| REFACTOR-FILT-02 | Filtros Separados | Verified |
| REFACTOR-FILT-03 | Filtros Separados | Verified |
| REFACTOR-FILT-04 | Filtros Separados | Verified |
| REFACTOR-FILT-05 | Filtros Separados | Verified |
| REFACTOR-FILT-06 | Filtros Separados | Verified |
| REFACTOR-FILE-01 | Ações de Arquivo | Verified |
| REFACTOR-FILE-02 | Ações de Arquivo | Verified |
| REFACTOR-FILE-03 | Ações de Arquivo | Verified |
| REFACTOR-FILE-04 | Ações de Arquivo | Verified |
| REFACTOR-MODAL-01 | Modais | Verified |
| REFACTOR-OPP-01 | Vinculação Oportunidade | Verified |
| REFACTOR-VIEW-01 | Visualizar Oportunidade | Verified |
| REFACTOR-UTIL-01 | Utilitários | Verified |
| REFACTOR-UTIL-02 | Utilitários | Verified |
| REFACTOR-HTML-01 | Entrypoint HTML | Verified |
| REFACTOR-HTML-02 | Entrypoint HTML | Verified |
| REFACTOR-HTML-03 | Entrypoint HTML | Verified |
| REFACTOR-REGR-01 | Zero Regression | Verified |
| REFACTOR-REGR-02 | Zero Regression | Verified |
| REFACTOR-REGR-03 | Zero Regression | Verified |
| REFACTOR-REGR-04 | Zero Regression | Verified |
| REFACTOR-REGR-05 | Zero Regression | Verified |
| REFACTOR-REGR-06 | Zero Regression | Verified |

**Coverage:** 33 total, 33 mapped to tasks (T1-T13), 0 unmapped

---

## Success Criteria

- [x] `dashboard-contratos-docusigner.js` original deletado
- [x] `dashboard/` contém 25 arquivos, nenhum >165 linhas
- [x] Nenhum `onclick` no HTML de contratos
- [x] Carga e renderização de contratos preservada
- [x] Filtros, upload, visualização, deleção e vinculação preservados
