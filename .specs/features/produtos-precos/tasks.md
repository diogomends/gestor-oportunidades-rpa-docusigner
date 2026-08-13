# Módulo Produtos e Preços (modulo-produtos-precos) — Tasks

## Status: Completed

---

## Completed Tasks

### Fase 1: Arquitetura & Backend (`src/modules/produtos-precos/`)

- [x] **TASK-BE-01**: Criar schemas Zod de validação (`produtosPrecosSchemas.js`)
  - Validar payload com campos obrigatórios (`nome`, `valor`, `sistemaInterno`, etc.).
  - *Requisito Mapeado:* PROD-BE-02

- [x] **TASK-BE-02**: Criar Service e Controller do Módulo (`produtosPrecosService.js` / `produtosPrecosController.js`)
  - Implementar métodos CRUD com tratamento adequado de erros HTTP.
  - *Requisito Mapeado:* PROD-BE-01, PROD-BE-02, PROD-BE-03

- [x] **TASK-BE-03**: Criar Rotas do Módulo e registrar em `app.js` (`produtosPrecosRoutes.js`)
  - Substituir montagem legada de `offerRoutes.js` pelo novo módulo em `app.js`.
  - *Requisito Mapeado:* PROD-BE-01

- [x] **TASK-BE-04**: Atualizar Mongoose Schema `Offer.js` e pre-save hooks
  - Adicionar `isCombo`, `itensCombo` e `sistemaInterno` (enum: "Easy Vendas", "VTME").
  - Hook `pre("save")` para validação de integridade financeira das ofertas combo.
  - *Requisito Mapeado:* BE-OFFER-01, BE-OFFER-02

- [x] **TASK-BE-05**: Criar camada de repositório (`offerRepository.js`)
  - Extrair acesso a dados Mongoose do controller isolando chamadas a `Offer.js`.
  - *Requisito Mapeado:* BE-OFFER-05

- [x] **TASK-BE-06**: Implementar filtro `?sistemaInterno=` e normalização de ofertas legadas
  - Permitir filtragem por sistema de origem na rota `GET /api/offers`.
  - *Requisito Mapeado:* BE-OFFER-03, BE-OFFER-04

- [x] **TASK-BE-07**: Script de seed para ofertas Easy Vendas (`src/scripts/seed-offers.js`)
  - Ler e popular coleção `offers` no MongoDB sem duplicar registros.
  - *Requisito Mapeado:* SEED-01

- [x] **TASK-BE-08**: Sanitização de combos (`sanitizeComboPayload`) e persistência no Mongoose
  - Criar função auxiliar para validar, formatar e filtrar itens de combo (remover itens sem nome, converter valores/percentuais para Number).
  - Atualizar `offerRepository.js` para substituir explicitamente `offer.itensCombo = data.itensCombo` e forçar `offer.markModified('itensCombo')`.
  - Atualizar `offerController.js` para expor mensagens de erro de validação detalhadas (`error.message`).
  - *Requisito Mapeado:* PROD-BE-02, PROD-BE-03

### Fase 2: Componente de Modal e Frontend (`public/modules/produtos-precos/`)

- [x] **TASK-FE-01**: Criar e atualizar componentes de modal (`public/modules/produtos-precos/components/modal/`)
  - Suporte a edição, exibição e submissão AJAX de ofertas simples/combos e `sistemaInterno`.
  - Ampliação da largura do modal para `max-width: 800px`.
  - *Requisito Mapeado:* PROD-FE-01, PROD-FE-02, FE-MODAL-01

- [x] **TASK-FE-02**: Implementar HTML do Switch "É combo" e Tabela de Itens no `#offerModal`
  - Adicionar o elemento switch no HTML `public/modules/produtos-precos/components/modal/modal-produtos-precos.html`.
  - Adicionar a estrutura do contêiner `#comboSection` com tabela (`Item`, `Valor`, `Percentual`, `Ações` com `ph-x-circle`).
  - Adicionar o botão `#btnAddComboRow` ("Incluir nova linha") abaixo da tabela.
  - *Requisito Mapeado:* FE-MODAL-02, FE-MODAL-06

- [x] **TASK-FE-03**: Desenvolver Lógica JS em `public/modules/produtos-precos/components/modal/` e `combo.js`
  - Alternância de exibição ao mudar o switch "É combo".
  - Adição de novas linhas dinamicamente (incluindo navegação por teclado `Tab`/`Enter`).
  - Remoção de linhas via clique no ícone `ph-x-circle` à direita.
  - Cálculo bidirecional (Percentual -> Valor e Valor -> Percentual) com máscaras de moeda/porcentagem.
  - Recálculo dinâmico ao alterar o valor total da oferta `name="valor"`.
  - Habilitação/desabilitação do botão submit baseado no fechamento da soma.
  - Suporte à edição de ofertas combo existentes (preenchimento do modal via `GET`).
  - Badge "Combo" com tooltip na listagem da tabela `#offersTableBody` em `produtos-precos.js`.
  - *Bug fix (2026-07-31)*: `parseCurrencyString` corrigido para tolerar múltiplas vírgulas (estado intermediário da máscara). `updateComboValidation` com tratamento de valores vazios e arredondamento de 2 casas para evitar floating-point drift.
  - *Bug fix (2026-07-31)*: `populateForm` — select `sistemaInterno` agora valida contra `["Easy Vendas", "VTME"]` antes de setar valor; fallback para `"Easy Vendas"` se inválido. (PR #233)
  - *Requisito Mapeado:* FE-MODAL-03, FE-MODAL-04, FE-MODAL-05, FE-MODAL-07, FE-MODAL-08, FE-MODAL-09

- [x] **TASK-FE-04**: Popular select `#neg-oferta` dinamicamente no Módulo de Contratos
  - Consumir ofertas do Easy Vendas via API em `public/modules/contratos/components/offerManager.js`.
  - *Requisito Mapeado:* NEGOFF-FE-01

- [x] **TASK-FE-05**: Implementar drag and drop nativo nos itens do combo
  - Arrastar pela linha inteira (`draggable="true"` no `<tr>`), sem handle dedicado.
  - HTML5 Drag and Drop API (dragstart, dragover, drop, dragend) no `<tbody>`.
  - Reordenação DOM preservada no payload `itensCombo` ao salvar.
  - `updateComboValidation()` chamado após reordenação.
  - CSS: `tr.dragging` (opacidade 0.4), `tr.drag-over` (borda tracejada).
  - *Requisito Mapeado:* FE-MODAL-10

### Fase 3: Campos de Permanência no Modal (campos-permanencia-oferta) — Status: Completed

- [x] **TASK-BE-09**: Adicionar os 11 campos de permanência ao schema `Offer.js` (opcionais, `tempoPermanencia` default 24), ao `createOfferSchema`/`updateOfferSchema` (Zod) e ao `offerRepository.update()` (persistência no PUT).
  - *Requisito Mapeado:* PERM-OF-01 a PERM-OF-07

- [x] **TASK-FE-06**: Adicionar seção "Dados de Permanência" ao `#offerModal` (`modal-produtos-precos.html` + `.js`): blocos VOZ/DADOS com máscara de moeda (`data-mask="currency"`), campo `tempoPermanencia` default 24, `populateForm` com formatação `1.234,56` e `handleSubmit` omitindo campos vazios.
  - *Requisito Mapeado:* PERM-OF-01, PERM-OF-02, PERM-OF-03, PERM-OF-06

#### Ajuste pós-implantação (2026-08-04)

- [x] **TASK-FE-07**: Zero default nos 8 campos de valor de permanência e nos campos valor/percentual dos itens do combo (`0,00` quando vazios; sempre enviados como número, vazio → `0`). Atualiza `combo.js` (`addComboRow`) e `modal-produtos-precos.js` (`populateForm` + `handleSubmit`).
- [x] **TASK-FE-08**: Normalizar percentuais do combo ao editar (`modal-produtos-precos.js` `open()` — recalcula `percentual = round(valor_i / somaValores * 100, 2)`) e adicionar checagem `|somaPercentuais - 100| <= 0.1` em `updateComboValidation` (`combo.js`), paridade com o hook `Offer.js:105-111`. Corrige `400 "Erro ao atualizar oferta"` em combos legados com percentuais inconsistentes (import via `insertMany` ignora o hook).
- [x] **TASK-BE-10**: Criar `src/scripts/repair-combos-percentuais.js` — recomputa percentuais dos combos com `|somaPerc - 100| > 0.1` a partir dos valores (pula combos com valores inválidos ou `save()` rejeitado) e gera relatório.
