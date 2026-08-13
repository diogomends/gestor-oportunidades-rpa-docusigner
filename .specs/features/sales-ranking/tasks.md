# Lista de Tarefas (Tasks) - Ranking de Vendas v2.1 — statusMode

Este documento contém as tarefas atômicas para adicionar o filtro de modo de status (`fechado` | `abertas` | `ambos`) ao ranking de vendas.

---

## Fase 1: Backend — Query Param e Filtros

### T-01: Adicionar `statusMode` ao Zod schema e controller
- [x] **Descrição**: Adicionar `statusMode: z.enum(["fechado", "abertas", "ambos"]).optional().default("fechado")` ao schema `rankingQuerySchema` em `get-sales-ranking.js`. Passar `statusMode` para o service.
- [x] **Arquivos**:
  - `src/modules/sales-ranking/controllers/get-sales-ranking.js`
- [x] **Critérios de Aceitação**:
  - `statusMode` aceita apenas `"fechado"`, `"abertas"`, `"ambos"`
  - Default é `"fechado"` (comportamento atual preservado)
  - Valor inválido retorna 400
- [x] **Verificação**: GET com `?statusMode=invalido` → 400. GET sem param → default `fechado`.

### T-02: Atualizar `buildRankingQuery` para suportar statusMode
- [x] **Descrição**: Modificar `buildRankingQuery` para aceitar `statusMode` e ajustar o `$match` conforme o modo:
  - `"fechado"`: `status_negociacao: "Fechado"`, `data_fechamento` obrigatório, filtro por `data_fechamento`.
  - `"abertas"`: `status_negociacao: { $nin: ["Cancelado", "Reprovado", "Reprovado por Crédito", "Debito na TIM", "Fechado", "Concluido"] }`. Sem filtro de `data_fechamento`. Data usa `created_at`.
  - `"ambos"`: Retorna dois queries separados (um para fechados, um para abertas) para o service fazer merge.
- [x] **Arquivos**:
  - `src/modules/sales-ranking/shared/sales-ranking-pipeline.js`
- [x] **Critérios de Aceitação**:
  - `fechado` mantém comportamento idêntico ao v2.0
  - `abertas` exclui exatamente os status listados
  - `ambos` retorna `{ queries: [queryFechados, queryAbertas] }`
  - ACL permanece aplicada em ambos os queries
  - Date filter: `fechado` usa `data_fechamento`, `abertas` usa `created_at`
- [x] **Verificação**: Testar cada modo com diferentes ACL roles e confirmar filtros corretos.

### T-03: Atualizar `calculateSalesRanking` para merge no modo "ambos"
- [x] **Descrição**: Quando `statusMode === "ambos"`, executar dois finds (fechados + abertas), merge os resultados em um único array, e agregar por vendedor. Quando `fechado` ou `abertas`, executar um único find.
- [x] **Arquivos**:
  - `src/modules/sales-ranking/services/calculate-sales-ranking.js`
- [x] **Critérios de Aceitação**:
  - Modo `fechado`: mesmos resultados do v2.0 (regressão zero)
  - Modo `abertas`: retorna ranking de oportunidades abertas
  - Modo `ambos`: ranking agregado de abertas + fechadas
  - `statusMode` é incluído na response shape
  - Sort e limit funcionam em todos os modos
- [x] **Verificação**: Comparar modo `fechado` com dados do v2.0 — idênticos. Testar `ambos` com dados de ambos os tipos.

---

## Fase 2: Frontend — Seletor de Status

### T-04: Adicionar `statusMode` ao `sales-ranking-service.js`
- [x] **Descrição**: Adicionar suporte a `params.statusMode` no `fetchSalesRanking`. Incluir na URL se fornecido.
- [x] **Arquivos**:
  - `public/js/modules/sales-ranking/sales-ranking-service.js`
- [x] **Critérios de Aceitação**:
  - `statusMode` é enviado como query param quando definido
  - Não enviado quando undefined (mantém compatibilidade)
- [x] **Verificação**: Abrir Network tab → request deve conter `statusMode=abertas` quando selecionado.

### T-05: Adicionar seletor de status ao `sales-ranking-component.js`
- [x] **Descrição**: Adicionar radio buttons (`<input type="radio">`) acima da tabela com 3 opções (fechado, abertas, ambos). No `change`, atualizar `currentStatusMode` e refetch o ranking.
- [x] **Arquivos**:
  - `public/js/modules/sales-ranking/sales-ranking-component.js`
- [x] **Critérios de Aceitação**:
  - Radio buttons renderizados acima da tabela, alinhados à direita
  - 3 opções: "Fechado", "Abertas", "Abertos + Fechados"
  - Default: "Fechado"
  - Ao mudar radio → refetch com novo `statusMode`
  - Mensagem de "Nenhuma venda fechada" muda conforme o modo:
    - `fechado`: "Nenhuma venda fechada no período."
    - `abertas`: "Nenhuma oportunidade aberta encontrada."
    - `ambos`: "Nenhuma oportunidade encontrada."
  - Estado preservado durante vida do componente (refetch mantém seleção)
- [x] **Verificação**: Trocar entre modos → dados mudam. Recarregar dashboard → reseta para "Fechado".

### T-06: Atualizar `ranking-grid.js` para passar `statusMode`
- [x] **Descrição**: Se `options.statusMode` for fornecido, passar para o componente.
- [x] **Arquivos**:
  - `public/js/features/dashboard/logic/ranking-grid.js`
- [x] **Critérios de Aceitação**:
  - `statusMode` é repassado se presente em options
  - Se não presente, componente usa default `fechado`
- [x] **Verificação**: Chamar `renderSalesRanking({ statusMode: "abertas" })` → select inicia em "Abertas".

---

## Fase 3: Testes

### T-07: Testar `buildRankingQuery` com statusMode
- [x] **Descrição**: Adicionar testes para os 3 modos de status no `sales-ranking-pipeline.test.js`.
- [x] **Arquivos**:
  - `src/modules/sales-ranking/shared/sales-ranking-pipeline.test.js`
- [x] **Critérios de Aceitação**:
  - Teste `fechado`: query contém `status_negociacao: "Fechado"` e `data_fechamento` obrigatório
  - Teste `abertas`: query contém `$nin` com status excluídos
  - Teste `ambos`: retorna array de 2 queries
  - Teste ACL preservada em cada modo
  - Teste date filter usa campo correto por modo
- [x] **Verificação**: `node --test src/modules/sales-ranking/shared/sales-ranking-pipeline.test.js` passa.

### T-08: Testar `calculateSalesRanking` com statusMode
- [x] **Descrição**: Testar o service com mock de `Opportunity.find` para os 3 modos.
- [x] **Arquivos**:
  - `src/modules/sales-ranking/services/calculate-sales-ranking.test.js`
- [x] **Critérios de Aceitação**:
  - Teste `fechado`: regressão — dados idênticos ao v2.0
  - Teste `abertas`: retorna ranking de abertas
  - Teste `ambos`: merge correto de ambos os conjuntos
  - Teste `statusMode` presente na response
- [x] **Verificação**: `node --test src/modules/sales-ranking/services/calculate-sales-ranking.test.js` passa.

---

## Resumo de Arquivos Afetados

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/modules/sales-ranking/controllers/get-sales-ranking.js` | Adicionar `statusMode` ao Zod schema |
| `src/modules/sales-ranking/shared/sales-ranking-pipeline.js` | Branching de query por `statusMode` |
| `src/modules/sales-ranking/services/calculate-sales-ranking.js` | Merge logic para modo `ambos` |
| `public/js/modules/sales-ranking/sales-ranking-service.js` | Adicionar param `statusMode` |
| `public/js/modules/sales-ranking/sales-ranking-component.js` | Adicionar radio buttons e lógica de refetch |
| `public/js/features/dashboard/logic/ranking-grid.js` | Passar `statusMode` se disponível |

---

## Legado Protegido (Impact Protector)

- **HTML**: `#cardSalesRanking`, `#salesRankingGrid` em `dashboard.html` — inalterados
- **DOM**: Container e grid preservados — radio buttons adicionados como filhos de `#salesRankingGrid`
- **Role View**: `role-view.js` inalterado
- **Controller Zod**: Schema existente preservado, `statusMode` adicionado como opcional com default
- **Routes**: `routes.js` e `index.js` inalterados
- **Regressão**: Modo `fechado` (default) produz exatamente os mesmos resultados do v2.0
