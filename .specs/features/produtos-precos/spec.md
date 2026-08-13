# Módulo Produtos e Preços (modulo-produtos-precos) — Specification

## Problem Statement

Atualmente, o gerenciamento de ofertas/produtos e preços está encapsulado no módulo `src/modules/produtos-precos/` no backend e `public/modules/produtos-precos/` no frontend, seguindo os princípios SOLID e arquitetura modular.

Além das rotas CRUD e validações Zod, o módulo inclui a gestão visual de ofertas simples e combos através do modal `#offerModal`, com suporte a tabelas dinâmicas de itens, cálculo bidirecional de percentual/valor e travas visuais/lógicas de integridade financeira.

## Goals

- Migrar e encapsular a lógica de backend de ofertas em `src/modules/produtos-precos/` (controller, routes, service, repository e validações Zod).
- Manter total retrocompatibilidade da API REST em `/api/offers`.
- Encapsular a interface do módulo em `public/modules/produtos-precos/`.
- Integrar a interface ao componente de modal `#offerModal` em `public/modules/produtos-precos/components/modal/`.
- Suportar ofertas do tipo "Combo" no `#offerModal`: switch toggle "É combo", tabela dinâmica de 3 colunas (`Item`, `Valor (R$)`, `Percentual (%)`), adição/remoção de linhas e recálculo bidirecional automático.
- Impedir salvamento de combos com divergência entre a soma dos itens e o valor total da oferta.
- Exibir badge "Combo" com popover/tooltip explicativo na listagem de ofertas (`#offersTableBody`).

## Out of Scope

| Funcionalidade | Motivo |
| -------------- | ------ |
| Alteração no Schema Mongoose `Offer` fora das propriedades de combo/sistemaInterno | A estrutura legada foi preservada. |
| Alterações em outros módulos | Outras rotas e páginas (`/api/contracts`, etc.) permanecem intocadas. |
| Sistema de checkout/pagamento | Fora do escopo do catálogo de ofertas. |

## Edge Cases

| Caso | Comportamento Esperado |
| ---- | ---------------------- |
| Campo valor do item em estado intermediário da máscara (ex: `"1,234,56"`) | `parseCurrencyString` converte corretamente para `1234.56` (última vírgula = decimal, demais removidas) |
| Campo valor vazio ou inválido na soma do combo | Tratado como `0` sem quebrar a validação |
| Floating-point drift na soma (ex: `0.1 + 0.2 !== 0.3`) | `somaItens` e `mainValor` arredondados para 2 casas antes da comparação (`diff <= 0.01`) |
| `offer.sistemaInterno` com valor inválido (undefined, null, string vazia, espaço extra) no `populateForm` | Select fica no valor anterior silenciosamente. **Fix (PR #233):** Validar contra lista `["Easy Vendas", "VTME"]` antes de setar; fallback para `"Easy Vendas"` |

---

## User Stories

### P1: Reestruturação do Módulo no Backend

**User Story:** Como desenvolvedor/mantenedor, quero que as rotas e regras do catálogo de ofertas fiquem organizadas em `src/modules/produtos-precos/` para garantir manutenibilidade e seguir o padrão SOLID do projeto.

**Acceptance Criteria:**

1. PROD-BE-01: WHEN requisição chega em `/api/offers` THEN sistema SHALL processar através das rotas e controladores do módulo `src/modules/produtos-precos/`.
2. PROD-BE-02: WHEN dados de criação/atualização de oferta são enviados THEN sistema SHALL validar a estrutura via Zod Service antes da persistência.
3. PROD-BE-03: WHEN ocorre erro de validação ou banco THEN sistema SHALL retornar status HTTP adequado (400/500) com mensagem descritiva em JSON.

### P1: Encapsulamento e Modal de Ofertas no Frontend

**User Story:** Como administrador, quero gerenciar (criar, editar, listar e remover) ofertas simples e combos na Tabela de Preços através do modal `#offerModal` encapsulado no módulo.

**Acceptance Criteria:**

4. PROD-FE-01: WHEN usuário acessa a Tabela de Preços THEN sistema SHALL carregar `/modules/produtos-precos/produtos-precos.html` e utilizar o modal gerenciado em `public/modules/produtos-precos/components/modal/`.
5. PROD-FE-02: WHEN o formulário do modal é submetido THEN sistema SHALL enviar os dados via API `/api/offers` e atualizar a tabela dinâmica de ofertas sem recarregar a página.
6. FE-MODAL-01: WHEN `#offerModal` abre THEN tamanho do modal SHALL ser ampliado (`max-width: 800px`) garantindo visualização confortável dos componentes.
7. FE-MODAL-02: WHEN switch "É combo" é ativado THEN a tabela de 3 colunas + ações SHALL ser exibida (iniciando com 1 linha).
8. FE-MODAL-03: WHEN switch "É combo" é desativado THEN a tabela de itens SHALL ser oculta e os dados de combo limpos.
9. FE-MODAL-04: WHEN usuário digita Percentual (%) THEN o campo Valor (R$) da linha SHALL ser calculated automaticamente `(Percentual * ValorTotal / 100)`.
10. FE-MODAL-05: WHEN usuário digita Valor (R$) THEN o campo Percentual (%) da linha SHALL ser calculated automaticamente `(ValorItem / ValorTotal * 100)` com 2 casas decimais.
11. FE-MODAL-06: WHEN botão "Incluir nova linha" é clicado ou `Tab`/`Enter` é pressionado no último campo THEN uma nova linha SHALL ser adicionada ao final.
12. FE-MODAL-07: WHEN ícone `ph-x-circle` na direita da linha é clicado THEN a linha correspondente SHALL ser removida e os totais recalculados. Se restar apenas 1 linha, o ícone fica oculto.
13. FE-MODAL-08: WHEN a soma dos itens do combo diverge do valor total da oferta THEN o botão "Salvar" SHALL ser desabilitado. O feedback visual de soma foi removido e documentado como componente separado em `combo-sum-feedback`.
14. FE-MODAL-09: WHEN tabela `#offersTableBody` renderiza ofertas do tipo combo THEN uma badge "Combo" SHALL ser exibida com tooltip interativo.
15. FE-MODAL-10: WHEN usuário arrasta linha de combo (drag no `<tr>`) THEN a linha SHALL ser reordenada na tabela e a ordem SHALL ser preservada no payload `itensCombo` ao salvar.

---

## Requirement Traceability

| ID | História | AC | Implementado Em | Status |
| -- | -------- | -- | --------------- | ------ |
| PROD-BE-01 | Reestruturação Backend | Rotas/Controllers em src/modules/produtos-precos/ | `src/modules/produtos-precos/` | Verified |
| PROD-BE-02 | Validação Zod | Validação de payload no Service | `produtosPrecosSchemas.js` | Verified |
| PROD-BE-03 | Tratamento de Erros | Retorno de erro estruturado JSON | `produtosPrecosController.js` | Verified |
| PROD-FE-01 | Encapsulamento Frontend | Interface em public/modules/produtos-precos/ | `public/modules/produtos-precos/` | Verified |
| PROD-FE-02 | CRUD via API | Submissão e atualização da tabela via AJAX | `produtos-precos.js` | Verified |
| FE-MODAL-01 | Aumento de tamanho do modal | `#offerModal` max-width: 800px | `public/modules/produtos-precos/components/modal/modal.css` | Verified |
| FE-MODAL-02 | Switch toggle "É combo" | Exibição da tabela de itens ao ativar switch | `modal-produtos-precos.html` | Verified |
| FE-MODAL-03 | Desativação de combo | Ocultação e limpeza de dados de combo | `modal-produtos-precos.js` | Verified |
| FE-MODAL-04 | Cálculo automático % -> R$ | Digitar percentual calcula valor | `combo.js` | Verified |
| FE-MODAL-05 | Cálculo automático R$ -> % | Digitar valor calcula percentual | `combo.js` | Verified |
| FE-MODAL-06 | Adição de nova linha | Botão "Incluir nova linha" e navegação teclado | `combo.js` | Verified |
| FE-MODAL-07 | Remoção de linha | Ícone `ph-x-circle` remove linha | `combo.js` | Verified |
| FE-MODAL-08 | Validação de soma de combo | Trava visual/lógica do botão Salvar se divergente | `combo.js` | Verified |
| FE-MODAL-09 | Badge "Combo" na listagem | Badge com tooltip em `#offersTableBody` | `produtos-precos.js` | Verified |
| FE-MODAL-10 | Drag and drop itens combo | Arrastar `<tr>` reordena linhas | `combo.js` | Verified |

**Cobertura:** 15 requisitos, 15 mapeados, 0 sem mapeamento ✔️

---

## Success Criteria

- [x] Módulo `src/modules/produtos-precos/` criado e registrado em `src/app.js`.
- [x] Zod utilizado para validação de entrada de dados de produtos/ofertas.
- [x] Frontend `public/modules/produtos-precos/` consome os componentes de modal em `public/modules/produtos-precos/components/modal/`.
- [x] Suporte completo a ofertas combo com cálculo bidirecional e trava de integridade financeira.
- [x] 100% de retrocompatibilidade com a API `/api/offers` mantida.
