# Refatoração dos Módulos de Contratos e PDF com Princípios SOLID (spec.md)

## Problem Statement

Atualmente, o fluxo de geração e gestão de contratos no frontend apresenta acoplamento, inconsistências de nomenclatura e acúmulo de responsabilidades em 4 arquivos principais, violando os princípios SOLID (SRP, ISP, OCP, DIP) e boas práticas de arquitetura de pastas:

1. **Inconsistência de Nomenclatura e Estrutura dos Arquivos de PDF**:
   - `pdf_data.js` mistura snake_case com camelCase e possui nome não-semântico (armazena os templates em branco em Base64).
   - `pdfLayout.js` tem nome genérico que não expressa com clareza a responsabilidade de definir o mapa de coordenadas (X/Y).
   - Os arquivos de PDF (`pdfGenerator.js`, `pdfLayout.js`, `pdf_data.js`) estão espalhados na raiz do módulo `public/modules/contratos/` em vez de organizados em um subdiretório dedicado `pdf/`.

2. **Classes Monolíticas e Responsabilidades Acopladas**:
   - `pdfGenerator.js` (SRP / ISP / OCP): Classe monolítica que faz desenho de texto (`writeTextOnPage`), lê coordenadas, instancia `pdf-lib`, compila os 3 documentos e aciona download DOM (`downloadPdfFile`).
   - `contractFormCollector.js` (SRP): Função `collectFormData()` extrai inputs dos Passos 1 e 2 e executa sanitização de documentos no mesmo fluxo.
   - `offerManager.js` (SRP / ISP): Combina o gerenciamento de estado em memória (`OfferStoreState`) com manipulação direta da árvore DOM (`addOfertaSection`, `addPortabilityLine`).
   - `contratos.js` (SRP / DIP): Orquestrador superacoplado que captura eventos da UI, aciona validação, gera PDFs e dispara upload HTTP para a API.

---

## As 5 Diretrizes de Organização e Padronização Incorporadas

1. **Eliminação de Mistura de Padrões (`snake_case` vs `camelCase`)**: Padronizar todos os arquivos de código JavaScript em `camelCase`.
2. **Nomenclatura Semântica para Templates**: Renomear `pdf_data.js` para `pdfTemplates.js` para indicar que ele armazena os templates Base64 dos PDFs modelos em branco.
3. **Clareza de Responsabilidade no Layout**: Renomear `pdfLayout.js` para `pdfCoordinatesLayout.js` para deixar explícito o mapeamento de coordenadas X/Y para o PDFLib.
4. **Subdiretório Dedicado `pdf/`**: Agrupar todos os arquivos de renderização e geração de PDF dentro de `public/modules/contratos/pdf/`.
5. **Padronização de Convenções de Nomes no Projeto**:
   - Código JS: `camelCase` (ex: `contractFormCollector.js`, `pdfCoordinatesLayout.js`, `pdfTemplates.js`, `dataSanitizer.js`, `offerStore.js`, `contractMediator.js`).
   - Estilos e Marcação HTML/CSS: `kebab-case` (ex: `contratos.html`, `contratos.css`, `dashboard-contratos-docusigner.css`).

---

## Nova Estrutura de Arquivos Proposta (`public/modules/contratos/`)

```
public/modules/contratos/
├── pdf/
│   ├── pdfTemplates.js            # Base64 dos PDFs originais em branco (renomeado de pdf_data.js)
│   ├── pdfCoordinatesLayout.js    # Mapeamento das coordenadas X/Y (renomeado de pdfLayout.js)
│   ├── pdfRenderer.js             # Engine de renderização de baixo nível com pdf-lib
│   ├── documentGenerators.js      # Geradores dos 3 documentos (Termo, Proposta, Permanência)
│   └── pdfDownloader.js           # Helper I/O para acionar download no navegador DOM
├── services/
│   ├── cepService.js
│   ├── clipboardService.js
│   ├── contractFormCollector.js   # Focado unicamente na extração dos inputs dos Passos 1 e 2
│   ├── dataSanitizer.js           # NOVO: Limpeza e sanitização de dados do formulário
│   └── docusignService.js
├── components/
│   ├── offerManager.js            # Focado exclusivamente na manipulação do DOM e UI da Etapa 2
│   ├── offerStore.js              # NOVO: Gestão de estado em memória (OfferStoreState)
│   └── ordersHistory.js
├── contractMediator.js            # NOVO: Orquestrador do fluxo (Coleta -> Sanitização -> Validação -> PDF -> API)
├── api.js
├── contratos.css
├── contratos.html                 # Atualizado para carregar os novos caminhos em pdf/
├── contratos.js                   # Reduzido a listener de eventos da UI
├── errors.js
├── masks.js
├── navigation.js
├── toast.js
├── ui.js
├── uiEvents.js
└── validators.js
```

---

## Goals

- [ ] Reorganizar e renomear os arquivos de PDF na subpasta `public/modules/contratos/pdf/` (`pdfTemplates.js`, `pdfCoordinatesLayout.js`, `pdfRenderer.js`, `documentGenerators.js`, `pdfDownloader.js`).
- [ ] Extrair a sanitização de `contractFormCollector.js` para `dataSanitizer.js`.
- [ ] Isolamento do estado em memória (`OfferStoreState`) em `offerStore.js`.
- [ ] Desacoplamento do orquestrador de submissão através do `contractMediator.js`.
- [ ] Atualizar todas as referências `<script src="...">` em `contratos.html` preservando 100% da compatibilidade.

---

## User Stories

### P1: Reorganização e Refatoração do Módulo PDF (`pdf/`) ⭐ MVP

**User Story**: Como desenvolvedor, quero os arquivos de PDF agrupados em `public/modules/contratos/pdf/` com nomes semânticos (`pdfTemplates.js`, `pdfCoordinatesLayout.js`, `pdfRenderer.js`, `documentGenerators.js`, `pdfDownloader.js`), para ter alta coesão e organização clara.

**Acceptance Criteria**:
1. WHEN os arquivos de PDF forem carregados em `contratos.html` THEN eles SHALL estar localizados sob o subdiretório `/modules/contratos/pdf/`.
2. WHEN `pdfTemplates.js` for importado THEN ele SHALL fornecer a constante Base64 dos templates.
3. WHEN `pdfCoordinatesLayout.js` for chamado THEN ele SHALL fornecer as especificações de coordenadas X/Y (`getTermoSpec`, `getPropostaSpec`, `getPermanenciaSpec`).
4. WHEN o download for disparado THEN ele SHALL ser delegado para `pdfDownloader.js`.

---

### P2: Sanitização Isolada de Dados do Formulário (`dataSanitizer.js`)

**User Story**: Como desenvolvedor, quero a sanitização isolada de `contractFormCollector.js` em `dataSanitizer.js`, para que a extração de formulário siga estritamente SRP.

**Acceptance Criteria**:
1. WHEN `collectFormData()` for acionado THEN ele SHALL delegar o tratamento de dados a `dataSanitizer.js`.

---

### P3: Separação de Estado de Ofertas (`offerStore.js`)

**User Story**: Como desenvolvedor, quero que `offerStore.js` gerencie o `OfferStoreState`, permitindo que `offerManager.js` atue apenas no DOM.

**Acceptance Criteria**:
1. WHEN ofertas forem manipuladas THEN o estado SHALL ser atualizado em `offerStore.js` sem acoplamento direto com árvores DOM.

---

### P4: Orquestração Desacoplada (`contractMediator.js`)

**User Story**: Como desenvolvedor, quero um mediador em `contractMediator.js` para gerenciar a execução dos contratos, deixando `contratos.js` focado em eventos de UI.

**Acceptance Criteria**:
1. WHEN o usuário solicitar o contrato THEN `contractMediator.js` SHALL orquestrar a coleta, validação, geração e envio para a API.

---

## Success Criteria

- [ ] Arquivos de PDF movidos para `public/modules/contratos/pdf/` com nomes `pdfTemplates.js` e `pdfCoordinatesLayout.js`.
- [ ] Tags de `<script>` em `contratos.html` atualizadas e operacionais.
- [ ] Padrões de nomes unificados (`camelCase` para `.js`, `kebab-case` para `.html`/`.css`).
- [ ] 100% de compatibilidade mantida na geração e download de contratos.
