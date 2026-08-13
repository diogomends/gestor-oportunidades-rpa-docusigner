# Especificação: Correção e Automação do FilterBar do Dashboard

> Resolução do bug de dados zerados ao aplicar filtros e adição de reatividade automática por evento `change`.

## Visão Geral

Ao utilizar o painel de filtros `#filterBar` no dashboard, as oportunidades e KPIs retornavam zeradas devido a três fatores:
1. Parsing de datas em UTC truncando a janela de busca no fuso BRT (UTC-3).
2. O select de equipes (`#filterTeam`) não era populado com as equipes cadastradas no sistema.
3. Consultas por supervisor/coordenador filtravam apenas por `equipe_id`, ignorando registros vinculados diretamente via `supervisor_id` ou `coordenador_id`.

Adicionalmente, os filtros dependiam exclusivamente do clique no botão "Filtrar". Esta especificação cobre a correção dessas três causas raízes e a automação do disparo de filtragem via eventos `change`/`input`.

---

## Requisitos Funcionais

### [REQ-001] Parse de Data Local no Backend (AD-011)
- **Descrição**: O backend (`get-opportunities.js` e `aggregations.js`) deve realizar o parse de strings de data `YYYY-MM-DD` extraindo ano, mês (0-indexado) e dia para construir `new Date(year, month - 1, day, 0, 0, 0, 0)` para `startDate` e `new Date(year, month - 1, day, 23, 59, 59, 999)` para `endDate`.
- **Critérios de Aceite**:
  - `startDate` "2026-08-09" deve gerar início no fuso local exatamente às 00:00:00.000.
  - `endDate` "2026-08-09" deve gerar término no fuso local exatamente às 23:59:59.999.
  - Filtrar por uma data específica deve retornar todas as oportunidades criadas naquele dia, sem zerar os valores por diferença de fuso horário.

### [REQ-002] População do Dropdown de Equipes no Frontend
- **Descrição**: A função `populateFilters()` no módulo `populate-filters.js` deve realizar requisição a `GET /api/teams` e preencher as opções do elemento `<select id="filterTeam">`.
- **Critérios de Aceite**:
  - A primeira opção `<option value="">Todas</option>` deve ser mantida.
  - As demais opções devem ser populadas com o `_id` da equipe no atributo `value` e o `nome` no conteúdo textual.

### [REQ-003] Filtro Composto por Hierarquia (`$or`)
- **Descrição**: Ao filtrar por `supervisorId` ou `coordinatorId`, as queries MongoDB em `get-opportunities.js` e `aggregations.js` devem incluir condição `$or` abrangendo tanto os registros associados por `equipe_id` quanto os vinculados diretamente pelos campos `supervisor_id` e `coordenador_id`.
- **Critérios de Aceite**:
  - Filtrar por `supervisorId` retorna oportunidades que possuem `supervisor_id == supervisorId` OU que pertencem a uma equipe supervisionada por ele (`equipe_id IN teamIds`).
  - Filtrar por `coordinatorId` retorna oportunidades que possuem `coordenador_id == coordinatorId` OU que pertencem a uma equipe coordenada por ele.

### [REQ-004] Filtragem Reativa Automática (Evento `change`)
- **Descrição**: O formulário `#filterBar` deve escutar eventos `change` em todos os seus seletores e `input`/`change` nos campos de data, disparando `loadRecentOpportunities()` com debounce leve.
- **Critérios de Aceite**:
  - Alterar a seleção de qualquer campo (Vendedor, Equipe, Status, Probabilidade, Data) atualiza a tabela e KPIs automaticamente.
  - O botão "Filtrar" continua funcional como gatilho manual.

---

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/modules/opportunities/controllers/get-opportunities.js` | Implementação do parse de data local (AD-011) e consulta `$or` por supervisor/coordenador |
| `src/modules/kpis/shared/aggregations.js` | Implementação do parse de data local (AD-011) e consulta `$or` na construção de `buildFilterQuery` |
| `public/js/features/dashboard/logic/populate-filters.js` | Chamada a `GET /api/teams` e população do elemento `#filterTeam` |
| `public/js/features/dashboard/ui/toggle-filters.js` ou `public/js/pages/dashboard.js` | Registro de event listeners `change`/`input` nos controles do `filterBar` |

---

## Restrições & Preservação
- **NENHUMA** rota de API legada deve ser alterada ou descontinuada.
- O layout CSS e seletores do `#filterBar` em `dashboard.html` devem ser 100% preservados.
- As validações de segurança ACL (verificação de cargo do usuário logado) devem ser estritamente mantidas.
