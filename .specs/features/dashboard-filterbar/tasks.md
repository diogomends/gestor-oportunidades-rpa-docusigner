# Tarefas: Correção e Automação do FilterBar do Dashboard

> Plano detalhado de tarefas atômicas para execução da especificação.

---

## Tarefa 1: Parse de Data Local (AD-011) nos Módulos `opportunities` e `kpis`
- **Objetivo**: Corrigir a conversão de `startDate` e `endDate` nos controllers backend para evitar discrepância de fuso horário UTC (AD-011).
- **Arquivos a alterar**:
  - `src/modules/opportunities/controllers/get-opportunities.js`
  - `src/modules/kpis/shared/aggregations.js`
- **Descrição**:
  - Extrair ano, mês e dia da string `YYYY-MM-DD` manualmente.
  - Instanciar `startDate` usando `new Date(year, month - 1, day, 0, 0, 0, 0)`.
  - Instanciar `endDate` usando `new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999)`.
- **Critério de Verificação**:
  - Ao requisitar `/api/opportunities?startDate=2026-08-09&endDate=2026-08-09`, a query MongoDB realiza busca entre `00:00:00.000` e `23:59:59.999` no fuso local, retornando registros sem zerar.

---

## Tarefa 2: Ajuste de Filtros Hierárquicos por Supervisor e Coordenador (`$or`)
- **Objetivo**: Garantir que a filtragem por supervisor ou coordenador busque oportunidades tanto por `equipe_id` quanto por vinculo direto no documento (`supervisor_id`, `coordenador_id`).
- **Arquivos a alterar**:
  - `src/modules/opportunities/controllers/get-opportunities.js`
  - `src/modules/kpis/shared/aggregations.js`
- **Descrição**:
  - No bloco `supervisorId`: criar condição `$or: [{ supervisor_id: supervisorId }, { equipe_id: { $in: teamIds } }]`.
  - No bloco `coordinatorId`: criar condição `$or: [{ coordenador_id: coordinatorId }, { equipe_id: { $in: teamIds } }]`.
- **Critério de Verificação**:
  - Oportunidades vinculadas diretamente ao ID do supervisor/coordenador aparecem no resultado do filtro mesmo se `equipe_id` for nulo.

---

## Tarefa 3: População do Dropdown `#filterTeam` no Frontend
- **Objetivo**: Fazer a requisição a `/api/teams` e preencher as opções da tag `<select id="filterTeam">`.
- **Arquivos a alterar**:
  - `public/js/features/dashboard/logic/populate-filters.js`
- **Descrição**:
  - Adicionar a chamada `request("/teams")` no `Promise.all` de `populateFilters()`.
  - Selecionar o elemento `filterTeam` no DOM e preencher as `<option>` mantendo a opção inicial "Todas".
- **Critério de Verificação**:
  - Ao carregar a página do Dashboard, o dropdown "Equipe" exibe as equipes cadastradas no banco de dados.

---

## Tarefa 4: Escutadores Reativos Automáticos (Eventos `change` e `input`)
- **Objetivo**: Disparar a filtragem do dashboard automaticamente quando o usuário alterar qualquer valor no `filterBar`.
- **Arquivos a alterar**:
  - `public/js/pages/dashboard.js` ou `public/js/features/dashboard/ui/toggle-filters.js`
- **Descrição**:
  - Adicionar event listeners `change` nos seletores (`filterTeam`, `filterSeller`, `filterSupervisor`, `filterCoordinator`, `filterStatus`, `filterProbability`).
  - Adicionar event listeners `change`/`input` com debounce leve (ex.: 300ms) nos campos de data (`filterStartDate`, `filterEndDate`).
  - Chamar `loadRecentOpportunities()` ao disparar os eventos.
- **Critério de Verificação**:
  - Alterar qualquer campo do `filterBar` recalcula instantaneamente a tabela e os KPI Cards sem necessidade de clicar no botão "Filtrar".
