# Auditoria e Rastreabilidade
> Controle de criação e integração de dados.

## Visão Geral
Integridade dos dados: quem criou cada oportunidade originalmente e rastreamento de dados vindos de importações externas (VTME).

## Backend

### Implementação
Implementado nos controladores de Criação e Importação.

### Fluxo
1. Durante `createOpportunity`, captura `req.user.id` e grava em `created_by`.
2. Durante importações via Excel, se `responsavel_vtme` estiver presente na planilha, persiste na oportunidade.
3. `created_by` nunca é alterado, mesmo após transferências de responsabilidade.

## Frontend

### Arquivos
- Exibido nos detalhes da oportunidade no Kanban.

### UX
- Transparência sobre a origem do lead para o vendedor.

## Manutenção
Definições de campos em `src/models/Opportunity.js`.
