# Transferência de Oportunidades
> Garantia de continuidade do atendimento de leads.

## Visão Geral
Acionada durante saída de vendedor. Garante que nenhum lead fique órfão no funil, transferindo responsabilidade e atualizando hierarquia (equipe, supervisor, coordenador).

## Backend

### Endpoint
Integrado ao `DELETE /api/users/:id?transferToUserId=...`

### Fluxo
1. Localiza todas as oportunidades onde `responsavel_id` é o ID do usuário saindo.
2. Localiza perfil do `recipient` (destinatário).
3. Atualiza massivamente: `responsavel_id`, `equipe_id`, `supervisor_id`, `coordenador_id`.
4. Mantém `created_by` inalterado para auditoria.

## Frontend

### Arquivos
- `confirmDeleteWithTransfer()` em `admin-users.js`.

### UX
- `App.request` com Query Parameter para evitar bloqueios de body em chamadas DELETE.

## Manutenção
Operação atômica (`updateMany`). Novas segmentações por equipe/região → revisar mapeamento de IDs no controlador.
