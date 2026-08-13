# Kanban Team Filter — Specification

## Problem Statement

Supervisores não conseguiam filtrar oportunidades por equipe no Kanban (Pipeline de Vendas). O seletor `#filterTeam` estava oculto para supervisores, e o backend ignorava o parâmetro `teamId` para esse cargo. Supervisores com múltiplas equipes não tinham como isolar a visualização de uma equipe específica nem obter uma visão consolidada.

## Goals

- Permitir que supervisores filtrem o Kanban por qualquer equipe que supervisionam.
- Garantir ACL rígida no backend: supervisores nunca acessam dados de equipes que não supervisionam.
- Visão consolidada ("Todas as Equipes") como padrão quando nenhum filtro é aplicado.
- Ocultar o filtro dinamicamente quando o supervisor não lidera nenhuma equipe (fallback para próprias oportunidades).
- Preservar permissões existentes de Admin, Coordenador e Suporte sem regressão.

## Out of Scope

| Funcionalidade | Motivo |
| -------------- | ------ |
| Criar novas equipes ou atribuir supervisores | Gestão de equipes é UI administrativa separada |
| Filtro por vendedor no Kanban | Escopo limitado ao filtro de equipe |
| Gráficos ou métricas fora do Kanban | Apenas o filtro de equipe é abordado |
| Persistência do estado do filtro entre sessões | Sem requisito |

---

## Assumptions & Open Questions

| Decisão | Escolha | Rationale | Confirmado? |
| ------- | ------- | --------- | ----------- |
| Team.supervisor_id existe no schema | `Team.find({ supervisor_id: req.user._id })` | Sem migração necessária | y |
| Admin/Coordenador/Suporte já têm filtro | Manter lógica existente, adicionar branch supervisor | Evita regressão | y |
| Supervisor sem equipes → fallback vendedor | `query.responsavel_id = req.user._id` | Pipeline não fica vazio | y |
| Cargo detectado via `App.getUser().cargo` | `currentUser.cargo === "supervisor"` | Padrão existente no frontend | y |
| GET /teams já existe | Filtrar client-side por `supervisor_id._id` | Reusa rota existente | y |
| Erro no GET /teams é não-fatal | try/catch com console.error | Não quebra a página | y |

**Open questions:** Nenhuma — todas resolvidas durante a implementação.

---

## User Stories

### P1: Supervisor Filtra Kanban por Equipe

**User Story:** Como supervisor que gerencia múltiplas equipes, quero filtrar o Kanban por uma equipe específica para focar no fluxo de negócios daquela equipe.

**Why P1:** Funcionalidade central da feature.

**Acceptance Criteria:**

1. KANBAN-FE-01: WHEN supervisor com ao menos uma equipe carrega o Kanban THEN sistema SHALL exibir dropdown `#filterTeam` com "Todas as Equipes" + equipes do supervisor
2. KANBAN-BE-01: WHEN supervisor seleciona equipe THEN sistema SHALL enviar GET `/opportunities?teamId=<id>` e retornar apenas oportunidades daquela equipe
3. KANBAN-BE-02: WHEN supervisor requisita `teamId` não autorizado THEN sistema SHALL retornar HTTP 403 "Acesso negado: Você não é supervisor desta equipe."
4. KANBAN-FE-02: WHEN supervisor troca equipe no dropdown THEN sistema SHALL recarregar o Kanban sem refresh de página

### P1: Visão Consolidada (Todas as Equipes)

**User Story:** Como supervisor, quero ver visão consolidada de todas as minhas equipes quando "Todas as Equipes" está selecionado.

**Acceptance Criteria:**

1. KANBAN-BE-03: WHEN supervisor sem `teamId` carrega o Kanban THEN sistema SHALL consultar `equipe_id: { $in: supervisedTeamIds }`
2. KANBAN-FE-03: WHEN Kanban inicializa para supervisor THEN dropdown SHALL default para "Todas as Equipes"

### P1: Filtro Oculto para Supervisor sem Equipes

**User Story:** Como supervisor sem equipes, quero o filtro oculto e apenas minhas próprias oportunidades visíveis.

**Acceptance Criteria:**

1. KANBAN-BE-04: WHEN supervisor com zero equipes carrega Kanban sem `teamId` THEN sistema SHALL fallback para `responsavel_id: _id`
2. KANBAN-FE-04: WHEN supervisor tem zero equipes THEN sistema SHALL manter `#filterTeam` oculto (`display: none`)

### P1: Regressão Zero para Cargos Existentes

**User Story:** Como admin/coordenador/suporte, quero que permissões existentes permaneçam inalteradas.

**Acceptance Criteria:**

1. KANBAN-BE-05: WHEN admin/suporte requisita qualquer `teamId` THEN retorna oportunidades sem validação de ownership
2. KANBAN-BE-06: WHEN coordenador requisita `teamId` não autorizado THEN HTTP 403 "Acesso negado: Você não é coordenador desta equipe."
3. KANBAN-BE-07: WHEN coordenador sem `teamId` THEN visão consolidada das equipes que coordena
4. KANBAN-BE-08: WHEN supervisor requisita `sellerId` fora de suas equipes THEN HTTP 403
5. KANBAN-BE-09: WHEN admin/suporte requisita `supervisorId` THEN oportunidades daquele supervisor
6. KANBAN-BE-10: WHEN coordenador requisita `supervisorId` fora de seu escopo THEN HTTP 403

---

## Edge Cases

| # | Caso | Comportamento Esperado |
| - | ---- | ---------------------- |
| 1 | Supervisor com `teamId` não autorizado | HTTP 403 "Acesso negado: Você não é supervisor desta equipe." |
| 2 | Supervisor sem equipes e sem `teamId` | Fallback seller scope (`responsavel_id = supervisor._id`) |
| 3 | Supervisor com `sellerId` de vendedor fora de suas equipes | HTTP 403 via `User.findOne({ _id: sellerId, equipe_id: { $in: supervisedTeamIds } })` |
| 4 | Coordenador passa `supervisorId` fora de seu escopo | `Team.find` com ambos filtros; se vazio, retorna vazio (sem 403) |
| 5 | Coordenador com `teamId` não autorizado | HTTP 403 "Acesso negado: Você não é coordenador desta equipe." |
| 6 | GET /teams falha (rede) | try/catch, filtro oculto, página não quebra |
| 7 | `loadFilterOptions` executa múltiplas vezes | `innerHTML` resetado antes de popular; sem duplicatas |
| 8 | Supervisor sem equipes mas cargo = supervisor | Filtro não exibido; backend fallback seller scope |
| 9 | Admin/coordenador/suporte sem equipes no sistema | Filtro exibido com apenas "Todas as Equipes" |
| 10 | Type mismatch `supervisor_id._id` (ObjectId vs string) | `===` falha → trata como sem equipes (fallback seguro) |

---

## Requirement Traceability

| ID | História | AC | Implementado Em | Status |
| -- | -------- | -- | --------------- | ------ |
| KANBAN-FE-01 | Filtro por Equipe | Dropdown com equipes do supervisor | `public/js/sales-kanban.js` L20–37 | Verified |
| KANBAN-BE-01 | Filtro por Equipe | GET /opportunities?teamId retorna filtrado | `get-opportunities.js` L40–46 | Verified |
| KANBAN-BE-02 | Filtro por Equipe | HTTP 403 para teamId não autorizado | `get-opportunities.js` L41–45 | Verified |
| KANBAN-FE-02 | Filtro por Equipe | Change event recarrega Kanban | `public/js/sales-kanban.js` L39 | Verified |
| KANBAN-BE-03 | Visão Consolidada | `equipe_id: { $in: supervisedTeamIds }` | `get-opportunities.js` L47–48 | Verified |
| KANBAN-FE-03 | Visão Consolidada | Dropdown default "Todas as Equipes" | `public/js/sales-kanban.js` L17 | Verified |
| KANBAN-BE-04 | Filtro Oculto | Fallback `responsavel_id: _id` | `get-opportunities.js` L49–51 | Verified |
| KANBAN-FE-04 | Filtro Oculto | `#filterTeam` oculto para supervisor sem equipes | `public/js/sales-kanban.js` L30,40 | Verified |
| KANBAN-BE-05 | Regressão Zero | Admin/suporte sem validação de ownership | `get-opportunities.js` L71–87 | Verified |
| KANBAN-BE-06 | Regressão Zero | Coordenador teamId não autorizado → 403 | `get-opportunities.js` L75–83 | Verified |
| KANBAN-BE-07 | Regressão Zero | Coordenador visão consolidada | `get-opportunities.js` L52–56 | Verified |
| KANBAN-BE-08 | Regressão Zero | Supervisor sellerId ACL check | `get-opportunities.js` L91–100 | Verified |
| KANBAN-BE-09 | Regressão Zero | Admin/suporte supervisorId filter | `get-opportunities.js` L113–121 | Verified |
| KANBAN-BE-10 | Regressão Zero | Coordenador supervisorId scoped | `get-opportunities.js` L113–120 | Verified |
| KANBAN-EC-01 | Edge Cases | EC #1–10 conforme definido | Vários (ver arquivos) | Verified |

**Cobertura:** 15 requisitos, 15 mapeados, 0 sem mapeamento ✔️

---

## Success Criteria

- [ ] Supervisores com equipes veem e usam o filtro de equipe no Kanban
- [ ] Supervisores que selecionam equipe específica veem apenas oportunidades daquela equipe; teamId não autorizado retorna 403
- [ ] "Todas as Equipes" mostra oportunidades consolidadas de todas as equipes supervisionadas
- [ ] Supervisor sem equipes: filtro oculto, apenas próprias oportunidades
- [ ] Admin/Coordenador/Suporte: zero regressão
- [ ] Nenhum `ReferenceError: loadOpportunities is not defined` ou erros similares
- [ ] Zero vazamentos de ACL: supervisor nunca acessa oportunidades de equipes que não supervisiona
- [ ] 4 testes unitários de ACL do supervisor passam (`npm test`)
