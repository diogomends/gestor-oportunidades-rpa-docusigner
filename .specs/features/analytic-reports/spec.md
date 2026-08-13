# Relatórios Analíticos
> Insights de performance em tempo real.

## Visão Geral
Consolida dados de oportunidades, metas e importações para visão gerencial do funil de vendas.

## Backend

### Endpoints
- `GET /api/opportunities/stats`: Estatísticas globais.
- `GET /api/goals/stats`: Estatísticas de desempenho.

### Fluxo
1. Controlador utiliza agregações MongoDB (`$aggregate`) para contar oportunidades por status.
2. Filtra por data e responsável baseado no nível de acesso do usuário.

## Frontend

### Arquivos
- `dashboard.html`.

### UX
- Ranking de vendedores por volume de vendas.
- Funil de conversão visual.
- Gráficos de rosca e barras.

## Filtros de Data (relatorio-pos-smb)

### buildDateFilter (`src/modules/relatorio-pos-smb/utils/date-filters.js`)

Função utilitária que constrói queries MongoDB com filtro de data-aware timezone (BRT).

**Regras (AD-011)**:
- Parse manual de strings `YYYY-MM-DD`: `new Date(year, month - 1, day, 0, 0, 0, 0)` para startDate e `new Date(year, month - 1, day, 23, 59, 59, 999)` para endDate.
- Se apenas `queryStartDate` ou `queryEndDate` for fornecido, a data é espelhada como início e fim do intervalo.
- `parseDateString` extrai YYYY-MM-DD de strings ISO completas e ignora strings inválidas (`"undefined"`, `"null"`), caindo no fallback padrão.

### Requisitos

| ID | Requisito | Status |
|----|-----------|--------|
| DF-REQ-01 | Parse de data sem conversão UTC (usa componentes locais) | ✅ v5.11.2 |
| DF-REQ-02 | Suporte a data única (apenas startDate ou apenas endDate) | ✅ v5.11.3 |
| DF-REQ-03 | Tratamento de strings ISO completas via `parseDateString` | ✅ v5.11.3 |
| DF-REQ-04 | Ignorar strings inválidas (`"undefined"`, `"null"`) sem erro | ✅ v5.11.3 |

### Testes
- Script manual: `src/scripts/test-date-filters.js` (DF-01 a DF-09) — executa via `make test-date-filters`

## Manutenção
Novos indicadores via rotas de estatísticas no roteador global de oportunidades.
