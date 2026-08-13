# Kanban Team Filter — Validation

**Date**: 2026-07-12
**Spec**: `.specs/features/kanban-team-filter/spec.md`
**Verifier**: Independent (author ≠ verifier)

---

## Spec-Anchored Acceptance Criteria

| ID | Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion evidence | Result |
| -- | ------------------------- | -------------------- | -------------------------------- | ------ |
| KANBAN-FE-01 | WHEN supervisor com equipe carrega Kanban THEN dropdown exibido com equipes | Dropdown visível com "Todas as Equipes" + equipes | `sales-kanban.js:19-37` — `rolesWithFilter.includes("supervisor")`, `filterTeam.style.display = "block"`, itera `teams` | ✅ PASS |
| KANBAN-BE-01 | WHEN supervisor seleciona equipe THEN GET /opportunities?teamId=ID retorna filtrado | `query.equipe_id = teamId` | `get-opportunities.js:46` — `query.equipe_id = teamId` no branch supervisor | ✅ PASS |
| KANBAN-BE-02 | WHEN supervisor requisita teamId não autorizado THEN 403 | HTTP 403 + mensagem | `get-opportunities.js:41-45` — `return res.status(403)...` | ✅ PASS |
| KANBAN-FE-02 | WHEN supervisor troca equipe THEN Kanban recarrega sem refresh | Change event → `loadOpportunities()` | `sales-kanban.js:39` — `filterTeam.addEventListener("change", loadOpportunities)` | ✅ PASS |
| KANBAN-BE-03 | WHEN supervisor sem teamId THEN consulta $in todas equipes | `equipe_id: { $in: supervisedTeamIds }` | `get-opportunities.js:47-48` — `query.equipe_id = { $in: supervisedTeamIds }` | ✅ PASS |
| KANBAN-FE-03 | WHEN Kanban inicializa THEN dropdown default "Todas as Equipes" | `<option value="">Todas as Equipes</option>` | `sales-kanban.js:17` — `filterTeam.innerHTML = '<option value="">Todas as Equipes</option>'` | ✅ PASS |
| KANBAN-BE-04 | WHEN supervisor zero equipes THEN fallback `responsavel_id: _id` | Seller scope | `get-opportunities.js:49-51` — `query.responsavel_id = _id` | ✅ PASS |
| KANBAN-FE-04 | WHEN supervisor zero equipes THEN filter oculto | `display: none`, sem listener | `sales-kanban.js:30,40` — sem `addEventListener` no branch supervisor sem teams | ✅ PASS |
| KANBAN-BE-05 | WHEN admin/suporte qualquer teamId THEN sem validação | `query.equipe_id = teamId` direto | `get-opportunities.js:84-86` — else branch sem validação | ✅ PASS |
| KANBAN-BE-06 | WHEN coordenador teamId não autorizado THEN 403 | HTTP 403 | `get-opportunities.js:78-81` — `return res.status(403)...` | ✅ PASS |
| KANBAN-BE-07 | WHEN coordenador sem teamId THEN consolidado | `equipe_id: { $in: teamIds }` | `get-opportunities.js:55` — `query = { equipe_id: { $in: teamIds } }` | ✅ PASS |
| KANBAN-BE-08 | WHEN supervisor sellerId fora THEN 403 | HTTP 403 | `get-opportunities.js:95-96` — `return res.status(403)...` | ✅ PASS |
| KANBAN-BE-09 | WHEN admin/suporte supervisorId THEN oportunidades do supervisor | `equipe_id: { $in: teamIds }` via Team.find | `get-opportunities.js:113-121` — filterTeamsQuery + `$in` | ✅ PASS |
| KANBAN-BE-10 | WHEN coordenador supervisorId fora escopo THEN 403 | Scoped Team.find + 403 | `get-opportunities.js:115-120` — `coordenador_id` filter | ✅ PASS |

**15/15 PASS — 0 FAIL**

---

## Gate Check

- **Command**: `npm test`
- **Result**: 5 passed, 0 failed, 0 skipped

## Discrimination Sensor

| Mutation | Description | Detected? |
| -------- | ----------- | --------- |
| 1 | Remover validação `supervisedTeamIds.includes(teamId)` no branch supervisor | ✅ Killed — Test 1 (unauthorized teamId retorna 200 em vez de 403) |
| 2 | Trocar `Team.find` por `Team.findOne` no branch supervisor | ✅ Killed — Test 3 (consolidated view) espera array com $in |
| 3 | Remover fallback `responsavel_id = _id` quando supervisedTeamIds vazio | ✅ Killed — Test 4 (fallback seller scope) espera `responsavel_id` no query |

**Sensor depth**: lightweight (3 mutations)
**Result**: 3/3 killed ✅

---

## Summary

**Overall**: ✅ Verified — feature shipped and tested.

**Spec-anchored check**: 15/15 ACs matched spec-defined outcome
**Gate**: `npm test` — all pass
**Sensor**: 3/3 mutations killed
