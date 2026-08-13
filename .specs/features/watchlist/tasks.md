# Módulo Watchlist & Componente Watchlist UI — Tarefas de Implementação

## Visão Geral

Lista de tarefas atômicas organizadas em camadas (Módulo Backend vs Componente Frontend) para verificação e manutenção da especificação do Watchlist.

---

## Fase 1: Módulo Backend (`modulo-watchlist`)

- [x] **T1: Validar Schema `WatchlistConfig` e Controllers Backend**
  - **Requisito**: `WATCHLIST-BACKEND-01`, `WATCHLIST-BACKEND-02`, `WATCHLIST-BACKEND-03`, `WATCHLIST-BACKEND-04`
  - **Onde**: `src/models/WatchlistConfig.js`, `src/modules/watchlist/controllers/`
  - **Critério**: Garantir exportação do model Mongoose e que as funções `getWatchlist`, `getWatchlistConfig` e `updateWatchlistConfig` estejam encapsuladas e validadas com Zod.
  - **Commit**: `feat(watchlist): define watchlist backend module and config schema`

- [x] **T2: Garantir Proteção de Rotas e RBAC no Backend**
  - **Requisito**: `WATCHLIST-BACKEND-02`, `WATCHLIST-BACKEND-03`, `WATCHLIST-BACKEND-04`
  - **Onde**: `src/routes/opportunityRoutes.js`
  - **Critério**: Rotas `/watchlist/config` protegidas com `authorize("admin")` e `/watchlist` protegida por autenticação `protect`.
  - **Commit**: `feat(watchlist): enforce RBAC and route protection for watchlist endpoints`

---

## Fase 2: Componente Frontend (`componente-watchlist-ui`)

- [x] **T3: Refatorar e Encapsular o Componente Frontend UI**
  - **Requisito**: `WATCHLIST-FRONTEND-01`, `WATCHLIST-FRONTEND-02`
  - **Onde**: `public/modules/watchlist/index.js`, `public/modules/watchlist/js/ui/render-table.js`
  - **Critério**: Componente exportando interface clara de renderização e controle de visibilidade da seção `#watchlistSection`.
  - **Commit**: `feat(watchlist-ui): encapsulate frontend watchlist component logic`

- [x] **T4: Fortalecer Tratamento Defensivo no Modal de Configuração**
  - **Requisito**: `WATCHLIST-FRONTEND-03`, `WATCHLIST-FRONTEND-04` (detalhes na sub-spec [sub-specs/config-modal-guards/tasks.md](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/.specs/features/modulo-watchlist/sub-specs/config-modal-guards/tasks.md))
  - **Onde**: `public/modules/watchlist/js/ui/config-modal.js`
  - **Critério**: Garantir que manipulação de inputs e botões verifique elementos nulos antes do acesso às propriedades.
  - **Commit**: `fix(watchlist-ui): add defensive null checks for config-modal elements`

---

## Fase 3: Suíte de Testes e Validação

- [x] **T5: Criar/Atualizar Testes Unitários de UI Defensiva**
  - **Requisito**: `WATCHLIST-FRONTEND-04`
  - **Onde**: `tests/config-modal.test.js` ou equivalente
  - **Critério**: Executar `npm test` garantindo 100% de passagem sem erros de console.
  - **Commit**: `test(watchlist): add automated unit test for defensive UI modal logic`
