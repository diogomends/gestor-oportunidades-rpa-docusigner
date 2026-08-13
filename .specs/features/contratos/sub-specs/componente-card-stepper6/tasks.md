# Tasks: Stepper 6 Dashboard de Contratos

## Task 1: Remover `#navContractsDashboardItem` da Sidebar

**Description:** Remover o link `#navContractsDashboardItem` em `public/modules/sidebar/sidebar.html` e limpar a referência `"navContractsDashboardItem"` dos papéis em `public/js/core/ui/sidebar.js`.

**Verification:** Teste automatizado verificando se a estrutura de papéis em `sidebar.js` não contém mais `navContractsDashboardItem`.

---

## Task 2: Atualizar `contratos.html` para incluir a Etapa 6 do Stepper e os Modais do Dashboard

**Description:**
1. Adicionar o HTML do Stepper Step 6 (`<div class="stepper-connector" id="connector-5-6"></div>` e `<div class="stepper-step" data-step="6">...</div>`).
2. Adicionar o CSS de `dashboard-contratos-docusigner.css` e o `<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>` no `<head>` de `contratos.html`.
3. Adicionar a `<div class="page-container" id="page-dashboard">` contendo o cabeçalho de busca e o container de cards `#contractsContainer`.
4. Adicionar os modais `#deleteConfirmModal` e `#viewAttachmentModal` em `contratos.html`.

**Verification:** Inspecionar `contratos.html` garantindo presença do step 6, `page-dashboard` e modais.

---

## Task 3: Atualizar Navegação e Integração JavaScript

**Description:**
1. Atualizar `public/modules/contratos/navigation.js` para estender o limite de passos para 6 (ex: `connector-5-6`, botão voltar/avançar na etapa 5 navegando para 6).
2. Atualizar `public/modules/contratos/contratos.js` e `dashboard-contratos-docusigner.js` para inicializar a listagem do dashboard quando a Etapa 6 for selecionada.

**Verification:** Executar `npm test` para garantir integridade e testes de regressão.

---

## Task 4: Refatorar Layout do Card no Step 6

**Description:**

1. **Remover títulos de seção de documentos:** No template `renderContracts()` em `dashboard-contratos-docusigner.js`, remover `<div class="documents-title">`, `<div class="doc-section-title">Gerados</div>` e `<div class="doc-section-title">Documentos do Cliente</div>`.

2. **Remover action buttons dos anexos presentes:** Em `renderAttachmentItem()`, remover `<div class="attachment-actions">` (botões view/download/delete) da branch `isPresent`. O `.attachment-item.present` deve ficar clicável com `cursor: pointer` e data attributes para abrir modal.

3. **Criar modal de ações do anexo:** Adicionar `#attachmentActionsModal` em `contratos.html` com botões de Visualizar, Download e Excluir (controlados por ACL). Adicionar funções `openAttachmentActionsModal()` / `closeAttachmentActionsModal()` e event listener em `setupDynamicButtonEvents()` em `dashboard-contratos-docusigner.js`.

4. **Reorganizar `card-top` em linha única:** Alterar o template para:
   ```
   card-top: [client-name-link] [cnpj] [status-badge] [card-date]
   ```

5. **Mover `client-line` + `plan-box` para segunda linha:** Fora do `card-top`, criar linha com `<span class="client-line">` e `<div class="plan-box">`.

6. **Ajustes de CSS:** Em `dashboard-contratos-docusigner.css`, atualizar `.card-top` para layout horizontal flex, e estilizar `.attachment-item.present` como elemento clicável.

**Arquivos afetados:**
- `public/modules/contratos/dashboard-contratos-docusigner.js`
- `public/modules/contratos/dashboard-contratos-docusigner.css`
- `public/modules/contratos/contratos.html`

**Verification:** Inspecionar visualmente os cards no Step 6 e verificar que:
- Não há textos "DOCUMENTOS", "GERADOS" ou "DOCUMENTOS DO CLIENTE"
- `.attachment-item.present` não tem ícones de ação; ao clicar abre modal
- `.card-top` tem nome + documento + status + data em uma linha
- `.client-line` e `.plan-box` estão juntos na segunda linha

---

## Task 5: Criar endpoint `GET /api/opportunities/:id`

**Description:**

Criar um endpoint para buscar uma oportunidade por ID, necessário para o modal de detalhes da Task 6.

1. Criar `src/modules/opportunities/controllers/get-opportunity-by-id.js`:
   - `async function getOpportunityById(req, res)`
   - Validar o ID com `mongoose.Types.ObjectId.isValid(id)`
   - Buscar `Opportunity.findById(id).populate("responsavel_id", "nome email").populate("equipe_id", "nome")`
   - Retornar 404 se não encontrada
   - Retornar `res.json(opportunity)` se encontrada

2. Adicionar a rota em `src/routes/opportunityRoutes.js`:
   ```js
   router.route("/:id").get(getOpportunityById).put(...).delete(...)
   ```

3. Exportar no barrel `src/controllers/opportunityController.js`.

**Arquivos afetados:**
- `src/modules/opportunities/controllers/get-opportunity-by-id.js` (novo)
- `src/routes/opportunityRoutes.js`
- `src/controllers/opportunityController.js`

**Verification:** `npm test` e requisição `GET /api/opportunities/:id` retornando o documento.

---

## Task 6: Corrigir `client-name-link` para abrir modal na mesma página

**Description:**

Atualmente `client-name-link` abria `dashboard.html?view={opportunityId}` em nova aba (`target="_blank"`), carregando a página inteira do CRM. Deve abrir um modal dentro da própria página de contratos (Step 6) exibindo os dados cadastrados da oportunidade.

1. **Adicionar `#viewOpportunityModal` em `contratos.html`:**
   ```html
   <div class="modal-overlay" id="viewOpportunityModal">
     <div class="modal-content" style="max-width: 1200px">
       ...
     </div>
   </div>
   ```

2. **Alterar `client-name-link` em `renderContracts()`:**
   - De: `<a href="${oppLink}" target="_blank" class="client-name-link">...`
   - Para: `<span onclick="openViewOpportunityModal('${opportunityId}')" class="client-name-link">...`

3. **Remover variável `oppLink`** (linhas 424-426).

4. **Adicionar funções globais em `dashboard-contratos-docusigner.js`:**
   - `async function openViewOpportunityModal(id)` — busca via `GET /api/opportunities/${id}` e renderiza relatório no modal
   - `function closeViewOpportunityModal()` — oculta o modal
   - Helpers: `buildOpportunityReportHTML()`, `createReportSection()`, `createReportField()`, `createItemsTableSimple()`, `formatCurrencySimple()`, `formatDateSimple()`, `createBadgeSimple()`, `formatObservationsSimple()`

**Arquivos afetados:**
- `public/modules/contratos/contratos.html`
- `public/modules/contratos/dashboard-contratos-docusigner.js`

**Verification:**
- Clicar no nome do cliente abre modal na mesma página com todos os dados cadastrados
- Modal fecha corretamente
