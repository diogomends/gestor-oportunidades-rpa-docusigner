# KPIs (Métricas e Cards do Dashboard)
> Especificação completa da funcionalidade de KPIs, contemplando regras de cálculo server-side (backend) e renderização/layout dos cards (frontend).

## Visão Geral
Funcionalidade responsável pelo cálculo e exibição das 9 métricas principais do dashboard e gráfico de evolução (sparkline). O backend agrega dados de oportunidades via MongoDB e expõe o endpoint `GET /api/kpis`. O frontend consome esses dados pré-calculados e os exibe em uma grade flex responsiva encapsulada em um container padronizado `glass-panel` com controle de colapso/expansão.

## Backend (Cálculo e API)

### Endpoints
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/kpis` | Retorna todas as 9 KPIs + sparkline do período filtrado |

### Query params (herda filtros do dashboard)
- `startDate`, `endDate` — range de datas
- `teamId`, `sellerId`, `supervisorId`, `coordinatorId` — filtros hierárquicos

### Arquivos Backend
| Arquivo | Responsabilidade |
|---------|------------------|
| `src/modules/kpis/services/calculate-kpis.js` | Agregações MongoDB para cada métrica |
| `src/modules/kpis/controllers/get-kpis.js` | Controller: valida params, chama service, responde JSON |
| `src/modules/kpis/routes.js` | Monta rota `GET /api/kpis` com `protect` |
| `src/modules/kpis/shared/aggregations.js` | Pipelines MongoDB reutilizáveis |

### Métricas Calculadas
| Campo | Agregação |
|-------|-----------|
| `receitasRealizadas` | `SUM(receita)` onde `status_negociacao = "Fechado"` |
| `acessosGanhas` | `SUM(quantidade_acessos)` onde `status_negociacao = "Fechado"` |
| `oportunidadesGanhas` | `COUNT` onde `status_negociacao = "Fechado"` |
| `potencialReceitas` | `SUM(receita)` onde status ativo (não Fechado/Cancelado/Reprovado) |
| `potencialAcessos` | `SUM(quantidade_acessos)` onde status ativo |
| `oportunidadesAtivas` | `COUNT` onde status ativo |
| `taxaConversao` | `(receitasRealizadas / SUM(total)) * 100` |
| `cancelada.valor` / `canceladas.valor` | `SUM(receita)` onde `status_negociacao = "Cancelado"` |
| `cancelada.acessos` / `canceladas.acessos` | `SUM(quantidade_acessos)` onde `status_negociacao = "Cancelado"` |
| `novosLeads.semanaAtual` | `COUNT` de leads na semana corrente (Seg-Sáb) |
| `novosLeads.periodoFiltrado` | `COUNT` total no período filtrado |
| `sparkline` | Array de 8 inteiros (leads por semana, últimas 8) |

### Response Shape (Contrato de API)
```json
{
  "receitasRealizadas": 125000.50,
  "acessosGanhas": 45,
  "oportunidadesGanhas": 12,
  "potencialReceitas": 380000.00,
  "potencialAcessos": 120,
  "oportunidadesAtivas": 34,
  "taxaConversao": 25.3,
  "cancelada": { "valor": 15000.00, "acessos": 8 },
  "novosLeads": { "semanaAtual": 7, "periodoFiltrado": 89 },
  "sparkline": [5, 8, 12, 7, 15, 10, 14, 7]
}
```

### Princípios Backend
- **Agregação no banco**: usa `$group`, `$sum`, `$match` — não carrega documentos inteiros
- **Status ativo**: exclui `["Fechado", "Concluido", "Cancelado", "Reprovado", "Reprovado por Crédito"]`
- **Semana ISO**: segunda 00:00 a sábado 23:59
- **Sparkline**: últimas 8 semanas (incluindo atual), zeros para semanas sem leads

---

## Frontend (Renderização e Interface)

### Arquivos Frontend
| Arquivo | Responsabilidade |
|---------|------------------|
| `public/js/features/dashboard/components/kpi-cards.js` | Fetch + render dos 9 cards + sparkline |
| `public/js/pages/dashboard.js` | Registro da função global `window.toggleKpisSection()` para alternância de visibilidade do `#kpiGridContainer` |
| `public/css/dashboard.css` | Estilos `.glass-panel`, `.kpi-card`, `.kpi-grid`, `.kpi-value` |
| `public/dashboard.html` | Estrutura HTML estática da `#kpisSection`, cabeçalho e `#kpiGridContainer` |

### Estrutura do Wrapper & HTML
A seção de KPIs utiliza um envoltório padronizado `glass-panel` com controle de colapso/expansão:
- **Container Envoltório**: `div` com classe `.glass-panel` e `id="kpisSection"`.
- **Cabeçalho da Seção**:
  - Título: **Métricas e KPIs**
  - Ícone Phosphor: `<i class="ph ph-chart-bar"></i>`
  - Botão Toggle de Visibilidade: `<button id="btnToggleKpis" onclick="window.toggleKpisSection()">` contendo ícone `<i id="iconToggleKpis" class="ph ph-caret-up"></i>`.
- **Container Interno**: `div` com `id="kpiGridContainer"` e classe `.kpi-grid`, contendo os 9 cards de métricas.

```html
<div class="glass-panel" id="kpisSection">
  <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <i class="ph ph-chart-bar" style="font-size: 1.25rem; color: var(--accent-color, #4f46e5);"></i>
      <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Métricas e KPIs</h3>
    </div>
    <button id="btnToggleKpis" class="btn-icon" onclick="window.toggleKpisSection()" title="Recolher KPIs">
      <i id="iconToggleKpis" class="ph ph-caret-up"></i>
    </button>
  </div>
  <div id="kpiGridContainer" class="kpi-grid">
    <!-- 9 KPI Cards (DOM estático / manipulado dinamicamente) -->
  </div>
</div>
```

### Layout CSS (Flex Responsivo)
A grade de KPIs utiliza `flex-wrap` para que os cards se ajustem automaticamente ao comprimento do conteúdo:

```css
.kpi-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.kpi-card {
  background-color: rgba(255, 255, 255, 0.03);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  width: fit-content;
  min-width: 180px;
}
```
- **Flex-wrap**: cards fluem naturally conforme o conteúdo, sem preenchimento forçado.
- **Largura dinâmica**: `width: fit-content` faz cada card ocupar apenas o espaço necessário para seu texto.
- **Largura mínima**: `180px` evita cards excessivamente estreitos.
- **Media query**: em telas ≤1200px, `min-width: 160px` para manter legibilidade.

### Controle de Visibilidade (`window.toggleKpisSection`)
A função global exposta em `public/js/pages/dashboard.js` manipula a exibição da grade de KPIs:
- Alterna a visibilidade do container `#kpiGridContainer` (`display: none` / `display: flex`).
- Atualiza a classe do ícone `#iconToggleKpis` entre `ph-caret-up` (expandido) e `ph-caret-down` (recolhido).
- Atualiza o atributo `title` do botão `#btnToggleKpis` ("Recolher KPIs" / "Expandir KPIs").

### Fluxo Frontend
1. `KpiCards.init(filters)` — instancia o componente com filtros ativos
2. `fetchKpis(filters)` — chama `GET /api/kpis` com query params
3. `render(data)` — atualiza DOM via `setElementText(id, value)`
4. `renderSparkline(data.sparkline)` — renderiza área chart via ApexCharts

### Princípios Frontend
- **Sem cálculos**: o componente nunca soma, filtra ou agrega oportunidades no cliente
- **Idempotente**: chamar `render()` múltiplas vezes sobrescreve os valores no DOM
- **Defensivo**: valores `null/undefined` exibem fallback (`R$ 0,00`, `0`)

---

## Regras de Manutenção
- Novo status requer atualização em dois arrays no backend: `CLOSED_STATUSES` e `ACTIVE_STATUSES`
- Mudança na fórmula de agregação = ajustar pipeline em `aggregations.js`
- Adicionar novo KPI = criar `<div class="kpi-card">` no HTML dentro de `#kpiGridContainer` + adicionar campo na API
- Sparkline usa ApexCharts (carregado via CDN no dashboard)
