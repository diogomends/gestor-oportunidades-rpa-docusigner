# Refatoração dos Módulos de Contratos e PDF com Princípios SOLID (tasks.md)

## Execution Protocol

Implement these tasks with the `tlc-spec-driven` skill.

**Design**: `.specs/features/refactor-pdf-solid/design.md`  
**Status**: Completed  

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| PDF Subfolder / Generators | integration / manual | Suporte a injeção de dependência e geração dos bytes em `pdf/` | `public/modules/contratos/pdf/*.js` | `node --test` |
| Data Sanitizer | unit / manual | Funções puras de sanitização de strings e documentos | `public/modules/contratos/services/dataSanitizer.js` | `node --test` |
| Offer Store | unit / manual | Gestão do `OfferStoreState` de ofertas em memória | `public/modules/contratos/components/offerStore.js` | `node --test` |
| Contract Mediator | integration / manual | Fluxo de `generateContract()` e `generateAllContracts()` desacoplado | `public/modules/contratos/contractMediator.js` | `node --test` |

---

## Execution Plan

### Phase 1: Subdiretório PDF e Renomeações (T1 -> T2 -> T3 -> T4)
### Phase 2: Form Collector & Data Sanitizer (T5 -> T6)
### Phase 3: Offer Store & DOM Decoupling (T7 -> T8)
### Phase 4: Orquestrador Mediator e Atualização de HTML (T9 -> T10)

---

## Task Breakdown

### Phase 1: Subdiretório PDF e Renomeações Semânticas

#### T1: Criar Diretório `public/modules/contratos/pdf/` e Mover Templates (`pdfTemplates.js`) [REQ-SOLID-PDF]
**What**: Criar a subpasta `pdf/` e mover/renomear `pdf_data.js` para `public/modules/contratos/pdf/pdfTemplates.js`, mantendo o repositório Base64 exposto em `window.pdfTemplates`.
**Where**: `public/modules/contratos/pdf/pdfTemplates.js`
**Depends on**: None
**Done when**:
- [x] Subpasta `pdf/` criada.
- [x] `pdf_data.js` renomeado e movido para `pdf/pdfTemplates.js`.
- [x] Dados Base64 dos PDFs originais restaurados com sintaxe JavaScript válida (sem quebras de linha em string).

#### T2: Mover e Renomear Layout de Coordenadas (`pdfCoordinatesLayout.js`) [REQ-SOLID-PDF]
**What**: Mover e renomear `pdfLayout.js` para `public/modules/contratos/pdf/pdfCoordinatesLayout.js` com o mapa explícito de coordenadas e helper defensivo para busca de templates.
**Where**: `public/modules/contratos/pdf/pdfCoordinatesLayout.js`
**Depends on**: T1
**Done when**:
- [x] `pdfLayout.js` movido e renomeado para `pdfCoordinatesLayout.js` exposto em `window.pdfCoordinatesLayout` com alias retroativo `window.pdfLayout`.
- [x] Implementado helper defensivo `getTemplateBase64` prevendo erros de indefinição em `window.pdfTemplates`.

#### T3: Engine de Renderização (`pdfRenderer.js`) e Helper de Download (`pdfDownloader.js`) [REQ-SOLID-PDF]
**What**: Criar `pdfRenderer.js` (desenho de baixo nível pdf-lib) e `pdfDownloader.js` (I/O DOM) dentro da subpasta `pdf/`.
**Where**: `public/modules/contratos/pdf/pdfRenderer.js` e `pdfDownloader.js`
**Depends on**: T2
**Done when**:
- [x] Criados `pdfRenderer.js` e `pdfDownloader.js` na subpasta `pdf/`.

#### T4: Montador de Documentos (`documentGenerators.js`) [REQ-SOLID-PDF]
**What**: Criar `documentGenerators.js` dentro da subpasta `pdf/` unificando `generateTermo()`, `generateProposta()` e `generatePermanencia()`.
**Where**: `public/modules/contratos/pdf/documentGenerators.js`
**Depends on**: T3
**Done when**:
- [x] `documentGenerators.js` localizado em `pdf/` consumindo `pdfTemplates.js`, `pdfCoordinatesLayout.js` e `pdfRenderer.js`.

---

### Phase 2: Form Collector & Data Sanitizer

#### T5: Criar Utilitário de Sanitização (`dataSanitizer.js`) [REQ-SOLID-FORM]
**What**: Extrair regras de limpeza de documentos e strings para um módulo utilitário puro.
**Where**: `public/modules/contratos/services/dataSanitizer.js`
**Depends on**: None
**Done when**:
- [x] Módulo `dataSanitizer.js` criado e exportado globalmente em `window.dataSanitizer`.

#### T6: Refatorar `contractFormCollector.js` [REQ-SOLID-FORM]
**What**: Atualizar `collectFormData()` em `public/modules/contratos/services/contractFormCollector.js` para delegar sanitização a `dataSanitizer.js`.
**Where**: `public/modules/contratos/services/contractFormCollector.js`
**Depends on**: T5
**Done when**:
- [x] `contractFormCollector.js` foca unicamente na extração dos elementos dos Passos 1 e 2 do DOM.

---

### Phase 3: Offer Store & DOM Decoupling

#### T7: Criar Gerenciador de Estado de Ofertas (`offerStore.js`) [REQ-SOLID-OFFER]
**What**: Extrair `OfferStoreState` de `offerManager.js` para o arquivo isolado `offerStore.js`.
**Where**: `public/modules/contratos/components/offerStore.js`
**Depends on**: None
**Done when**:
- [x] `offerStore.js` gerencia estado de ofertas e linhas de portabilidade desvinculado do DOM.

#### T8: Refatorar `offerManager.js` [REQ-SOLID-OFFER]
**What**: Refatorar `addOfertaSection()` e `addPortabilityLine()` em `public/modules/contratos/components/offerManager.js` para utilizarem `offerStore.js` e focarem na manipulação do DOM.
**Where**: `public/modules/contratos/components/offerManager.js`
**Depends on**: T7
**Done when**:
- [x] `offerManager.js` atua puramente como renderizador DOM da Etapa 2.

---

### Phase 4: Orquestrador Mediator e Atualização de HTML

#### T9: Criar Mediator de Contratos (`contractMediator.js`) [REQ-SOLID-ORCH]
**What**: Criar `contractMediator.js` para orquestrar o fluxo de submissão.
**Where**: `public/modules/contratos/contractMediator.js`
**Depends on**: T4, T6, T8
**Done when**:
- [x] `contractMediator.js` orquestra coleta, validação, geração de PDFs em `pdf/` e envio via API Client.

#### T10: Atualizar `contratos.html` e `contratos.js` [REQ-SOLID-ORCH]
**What**: Atualizar as tags `<script src="...">` em `contratos.html` apontando para os novos arquivos da subpasta `pdf/` e vincular `contratos.js` ao `contractMediator.js`.
**Where**: `public/modules/contratos/contratos.html` e `contratos.js`
**Depends on**: T9
**Done when**:
- [x] Tags `<script src="...">` em `contratos.html` atualizadas para a subpasta `pdf/`.
- [x] `contratos.js` refatorado para delegar ações da UI ao `contractMediator.js`.ara delegar ações da UI ao `contractMediator.js`.

---

## Requirement Traceability

| Task | Requirement ID |
| ---- | -------------- |
| T1, T2, T3, T4 | REQ-SOLID-PDF |
| T5, T6 | REQ-SOLID-FORM |
| T7, T8 | REQ-SOLID-OFFER |
| T9, T10 | REQ-SOLID-ORCH |
