# Módulo & Componente: Ranking de Vendas (sales-ranking)
> Especificação técnica para cálculo server-side do ranking de vendas com agregação MongoDB e componente frontend ESM desacoplado.

## Visão Geral
Este módulo substitui a agregação client-side do ranking de vendas por uma rota dedicada no backend (`GET /api/sales-ranking`) utilizando a engine de agregação do MongoDB. O frontend consome os dados agregados via um componente ES6 modular e reutilizável (`public/js/modules/sales-ranking/`).

**Versão**: 2.1 — Filtro de statusMode (fechado/abertas/ambos)

---

## Backend (`src/modules/sales-ranking/`)

### Endpoints
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/sales-ranking` | Retorna o ranking de vendedores filtrado por período e escopo de permissão (ACL) |

### Query Params
- `startDate` (string, ISO/YYYY-MM-DD): Data inicial do filtro de período.
- `endDate` (string, ISO/YYYY-MM-DD): Data final do filtro de período.
- `sortBy` (string, opcional): `receita` (padrão) ou `unidades`.
- `limit` (number, opcional): Quantidade de registros no ranking (padrão: `10`, máx: `50`).
- `teamId` (string, opcional): Filtro por ID da equipe.
- `statusMode` (string, opcional): Modo de filtro por status. Valores:
  - `"fechado"` (padrão): Ranking por data de fechamento (apenas oportunidades com `status_negociacao: "Fechado"` e `data_fechamento` preenchido).
  - `"abertas"`: Ranking de oportunidades abertas — exclui status `Cancelado`, `Reprovado`, `Reprovado por Crédito`, `Debito na TIM`, `Fechado` e `Concluido`. Usa `created_at` como data de referência (não `data_fechamento`).
  - `"ambos"`: Combina abertas + fechadas. Agrega ambos os conjuntos com regras de data distintas por tipo.

### Permissões & Regras de ACL (RBAC)
- **Admin**: Visualiza o ranking global de todas as vendas da empresa.
- **Supervisor**: Visualiza o ranking da equipe sob sua gestão (`supervisor_id`).
- **Coordenador**: Visualiza o ranking da sua equipe ou equipe específica (`teamId`).
- **Vendedor**: Visualiza o ranking da sua equipe, destacando a própria posição no ranking.

### Arquivos
| Arquivo | Responsabilidade |
|---------|------------------|
| `src/modules/sales-ranking/index.js` | Barrel export do módulo |
| `src/modules/sales-ranking/routes.js` | Definição da rota com `authMiddleware.protect` |
| `src/modules/sales-ranking/controllers/get-sales-ranking.js` | Controller HTTP (validação de query params via Zod, invocação de service) |
| `src/modules/sales-ranking/services/calculate-sales-ranking.js` | Serviço de negócio (construção do pipeline MongoDB com ACL) |
| `src/modules/sales-ranking/shared/sales-ranking-pipeline.js` | Funções utilitárias (parse monetário, construção de filtros ACL) |

### Pipeline de Agregação (MongoDB)
1. **$match** (conforme `statusMode`):
   - **`fechado`** (atual): `status_negociacao: "Fechado"`, `data_fechamento` obrigatório, filtro por `data_fechamento`.
   - **`abertas`**: `status_negociacao: { $nin: ["Cancelado", "Reprovado", "Reprovado por Crédito", "Debito na TIM", "Fechado", "Concluido"] }`. Filtro por `created_at`.
   - **`ambos`**: União de ambos os pipelines com `$unionWith` (ou TWO queries + merge no service).
   - Filtro de escopo por usuário/equipe (conforme ACL do `req.user`).
2. **$lookup** (para popular `responsavel_id`):
   - `from`: `users`
   - `localField`: `responsavel_id`
   - `foreignField`: `_id`
   - `as`: `responsavel`
3. **$group**:
   - `_id`: `$responsavel_id`
   - `receita`: `$sum` de receita parseada (tratar strings "R$ 1.500,00")
   - `unidades`: `$sum: 1`
   - `nome`: `$first` do nome do vendedor (com fallback para campos string)
4. **$sort**:
   - Por `receita: -1` ou `unidades: -1` conforme o parâmetro `sortBy`.
5. **$limit**:
   - Respeita o parâmetro `limit` (default: 10).

### Campo `data_fechamento` (NOVO)
- **Tipo**: `Date` no schema `Opportunity`
- **Obrigatório**: `false` (preenchido automaticamente ao fechar)
- **Auto-preenchimento**: Quando `status_negociacao` muda para `"Fechado"`, `data_fechamento` é definido como `Date.now` (se ainda não estiver definido)
- **Endpoints que modificam**:
  - `PATCH /api/opportunities/:id/status` (kanban drag-and-drop)
  - `PUT /api/opportunities/:id` (edição completa)
  - `POST /api/opportunities` (criação com status "Fechado")

### Response Shape (JSON)
```json
{
  "totalVendedores": 15,
  "statusMode": "fechado",
  "periodo": {
    "startDate": "2026-08-01T00:00:00.000Z",
    "endDate": "2026-08-31T23:59:59.999Z"
  },
  "ranking": [
    {
      "position": 1,
      "sellerId": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Carlos Silva",
      "unidades": 12,
      "receita": 145000.00
    },
    {
      "position": 2,
      "sellerId": "64f1a2b3c4d5e6f7a8b9c0d2",
      "name": "Ana Oliveira",
      "unidades": 9,
      "receita": 98500.50
    }
  ]
}
```

---

## Frontend (`public/js/modules/sales-ranking/`)

### Componente Frontend (ESM)
Componente desacoplado que gerencia seu próprio ciclo de busca e renderização na div `#salesRankingGrid`.

### Novo: Seletor de Modo de Status
O componente adiciona radio buttons (`<input type="radio">`) acima da tabela com 3 opções:

| Value | Label | Comportamento |
|-------|-------|---------------|
| `fechado` | Fechado | Ranking por data de fechamento (atual, padrão) |
| `abertas` | Abertas | Oportunidades abertas, excluindo canceladas/perdidas/fechadas |
| `ambos` | Abertos + Fechados | União de ambos os conjuntos |

**Posicionamento**: Acima da tabela, alinhado à direita, com estilo `flex` e `gap`.
**Evento**: `change` no radio → refetch com `statusMode` atualizado → re-renderiza a tabela.
**Estado**: `currentStatusMode` persistido durante a sessão do componente (resetado ao sair).

### Arquivos
| Arquivo | Responsabilidade |
|---------|------------------|
| `public/js/modules/sales-ranking/sales-ranking-service.js` | Comunicação HTTP (`fetch('/api/sales-ranking?...')`), adiciona param `statusMode` |
| `public/js/modules/sales-ranking/sales-ranking-component.js` | Renderiza seletor + tabela, gerencia estado do seletor |

### Integração
- `public/js/features/dashboard/logic/ranking-grid.js`: Wrapper que delega para o módulo desacoplado. Passa `statusMode` via options se fornecido.
- **Remover dead code**: O parâmetro `options` (array legado) não deve mais ser aceito — apenas objetos de filtro.

---

## Regras e Garantias de Preservação (Impact Protector)
- **HTML e DOM**: Mantém o container `<div class="chart-card" id="cardSalesRanking">` e a div `#salesRankingGrid` em `public/dashboard.html`. Radio buttons adicionados como filhos de `#salesRankingGrid`.
- **Role View**: Preserva o controle de exibição por perfil de usuário em `public/js/features/dashboard/logic/role-view.js`.
- **Compatibilidade**: Respeita os filtros globais de data existentes na interface.
- **Regressão zero**: Modo `fechado` (default) produz exatamente os mesmos resultados do v2.0.

---

## Changelog

### v2.1 (Atual)
- **FEATURE**: Radio buttons de modo de status no frontend (`fechado` | `abertas` | `ambos`)
- **FEATURE**: Novo query param `statusMode` no backend
- **FEATURE**: Modo `abertas` — ranking de oportunidades abertas (exclui canceladas, perdidas, fechadas)
- **FEATURE**: Modo `ambos` — união de abertas + fechadas
- **FIX**: Modo `abertas` usa `created_at` como data de referência (sem `data_fechamento`)

### v2.0
- **MIGRATION**: Agregação migrada de JS memory para MongoDB `$group/$sort` pipeline
- **FEATURE**: Campo `data_fechamento` (Date) adicionado ao schema Opportunity
- **FIX**: Filtro de data agora usa `data_fechamento` em vez de `created_at`
- **FIX**: Apenas oportunidades com `data_fechamento` preenchido são exibidas no ranking
- **CLEANUP**: Removido dead code em `ranking-grid.js` (parâmetro array legado)

### v1.0 (Original)
- Implementação inicial com JS aggregation
