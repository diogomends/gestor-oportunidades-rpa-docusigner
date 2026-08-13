# Controle de Metas (Goals)
> Definição de objetivos de vendas por período.

## Visão Geral
Admin e supervisores definem metas financeiras e volumétricas para vendedores e equipes, com cálculo de atingimento no dashboard.

## Backend

### Endpoints
- `POST /api/goals`: Cria meta para usuário/equipe.
- `GET /api/goals/summary`: Retorna desempenho consolidado.

### Fluxo
1. Registra valor alvo, período (mês/ano) e tipo de meta.
2. Busca oportunidades convertidas (fase "Fechado") no mesmo período.
3. Calcula porcentagem de atingimento (Realizado / Previsto).

## Frontend

### Arquivos
- `admin-goals.html`.

### UX
- Gráficos de barra comparando meta vs realizado.
- Indicação visual (cores) para metas não atingidas.

## Manutenção
Ao inativar usuário, metas são mantidas para histórico e cálculo de fechamento mensal.
