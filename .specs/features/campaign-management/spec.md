# Gestão de Campanhas e Comissões
> Regras de comissionamento dinâmicas.

## Visão Geral
Segmentação de vendas por campanhas sazonais, com diferentes taxas de comissão para vendedores.

## Backend

### Endpoints
- `GET /api/campaigns`: Listagem.
- `POST /api/campaigns`: Configurar nova campanha.

### Fluxo
1. Define datas de início e fim.
2. Atribui metas específicas para a campanha.
3. Calcula comissões baseando-se no valor total das oportunidades fechadas no período.

## Frontend

### Arquivos
- `navCampaigns` (Menu exclusivo de Admin).

### UX
- Tabelas detalhadas por consultor com resumo de vendas por campanha.

## Manutenção
Lógica de comissões em `src/modules/commissions`.
