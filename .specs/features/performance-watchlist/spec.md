# Monitoramento de Métricas (Watchlist)
> Dashboard de indicadores críticos em tempo real.

## Visão Geral
Watchlist fornece visão rápida da saúde do funil, sinalizando leads estagnados ou quedas bruscas no volume de novos oportunidades. KPI cards exibem métricas consolidadas (Receitas, Acessos, Conversão, etc.).

## Backend

### Fluxo (Watchlist Service)
- Varre coleção de oportunidades buscando registros sem interação há mais de X dias.
- Agrega métricas diárias de novos leads.
- Alimenta gráficos e KPIs do Dashboard.

## Frontend

### Arquivos
- `public/dashboard.html`: Widgets de métricas e KPI cards.
- `public/css/dashboard.css`: Estilos dos cards e grid.
- `public/js/features/dashboard/components/kpi-cards.js`: Componente de renderização dos 9 KPI cards.
- `src/modules/watchlist/services/calculate-seller-metrics.js`: Cálculo de métricas.

### Estrutura Visual
- `#watchlistSection` (`.glass-panel`): Tabela de Atenção com toggle expandir/recolher.
- `.kpi-grid` dentro de `.glass-panel`: 9 cards de métricas com fundo `rgba(255,255,255,0.03)`.

## Manutenção
Critérios de "alerta" (ex: tempo de estagnação) configuráveis via variáveis de ambiente ou objeto de configuração no banco.
