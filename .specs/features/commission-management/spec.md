# Gestão de Comissões
> Cálculo automatizado de remuneração por vendas.

## Visão Geral
Cálculo de comissões devidas a cada vendedor com base em oportunidades "Concluído" ou "Ganho", respeitando tabela de preços e bônus vigentes.

## Backend

### Endpoint
- `GET /api/commissions`: Resumo de comissões por período.

### Fluxo
1. Busca oportunidades concluídas no período.
2. Aplica regras de negócio de comissionamento via script.
3. Gera valor final bruto para exportação ou visualização.

## Manutenção
Regras de comissão variam com campanhas de vendas. Manter scripts de cálculo isolados no módulo `commissions`.
