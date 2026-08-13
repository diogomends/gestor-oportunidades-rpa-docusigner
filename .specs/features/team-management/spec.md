# Gestão de Equipe e Organograma
> Visualização hierárquica e coordenação de times.

## Visão Geral
Organograma para visão macro da empresa, organizando usuários por cargos. Kanban de Equipe para gestão de metas por supervisor/coordenador.

## Backend

### Endpoints
- `GET /api/teams`: Lista equipes e supervisores.
- `GET /api/users`: Lista colaboradores por equipe.

### Fluxo
1. Controlador de equipes faz `populate` dos campos de supervisor e coordenador.
2. Agrupa vendedores pelo ID da equipe para renderização em cascata.

## Frontend

### Arquivos
- `public/team.html`: Estrutura do organograma.
- `public/js/team.js`: Lógica de renderização.
- `public/js/team_kanban.js`: Visão secundária em ranhuras.

### UX
- `getRoleColor` exposta em `window` para troca dinâmica entre Organograma e Kanban.
- Listagem de membros por ordem crescente de nome.

## Manutenção
Hierarquia rígida: Vendedor → Supervisor → Coordenador → Admin. Mudanças na subordinação devem ser refletidas em `User.js` e `Team.js`.
