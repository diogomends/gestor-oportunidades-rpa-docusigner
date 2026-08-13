# Kanban de Oportunidades
> Visualização dinâmica e interativa do funil de vendas.

## Visão Geral
Vendedor gerencia fluxo de trabalho arrastando cartões entre colunas: Novo, Contato, Agendamento, Proposta e Fechado.

## Backend

### Endpoints
- `GET /api/opportunities`: Lista oportunidades filtradas por acesso (vendedores vêem suas leads, admins vêem todas).
- `PATCH /api/opportunities/:id`: Atualiza status ou dados.

### Fluxo
1. Controlador `getOpportunities` aplica filtros de segurança (Role-Based).
2. Controlador `updateStatus` valida se transição de fase é permitida.

## Frontend

### Arquivos
- `sales-kanban.html`.
- `public/js/kanban-logic.js`.

### UX
- Drag & Drop com persistência imediata no banco.
- Cartões coloridos por criticidade (Data de Próximo Contato).
- Barra de busca e filtros rápidos por Origem e Valor.

## Manutenção
Novas colunas no Kanban devem ser adicionadas primeiro no Schema do Mongoose (`Opportunity.js`) no campo `status` (enum).
