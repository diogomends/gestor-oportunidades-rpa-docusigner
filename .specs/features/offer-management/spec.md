# Gestão de Ofertas e Produtos
> Catálogo de soluções disponíveis para venda.

## Visão Geral
Cadastro de produtos e serviços (Ofertas) vinculados às oportunidades. Valores de receita alimentam cálculo de metas e comissões.

## Backend

### Endpoints
- `GET /api/offers`: Catálogo de ofertas ativas.
- `POST /api/offers`: Cadastro de novo produto (Admin).

## Manutenção
Ofertas referenciadas por ID no modelo `Opportunity`. Nunca remover oferta com oportunidades vinculadas (integridade referencial).
