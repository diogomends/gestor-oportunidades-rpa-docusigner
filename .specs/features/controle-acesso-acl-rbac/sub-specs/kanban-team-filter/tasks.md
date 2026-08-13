# Kanban Team Filter — Tasks

**Design**: `.specs/features/kanban-team-filter/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Generated from codebase — this feature is shipped.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Controller | unit | 4 supervisor ACL scenarios: unauthorized teamId 403, authorized teamId, consolidated view, no-teams fallback | `src/**/*.test.js` | `npm test` |
| Entity/Config | none | — | — | build gate only |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (node:test) | No | Shared Node.js module cache; mocks across tests | `get-opportunities.test.js` uses `mock.restoreAll()` in beforeEach |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After controller/unit tasks | `npm test` |
| Full | After any integration/e2e | `npm test` |
| Build | Config/entity-only changes | `npm test` |

---

## Execution Plan

### Phase 1: Backend ACL (Sequential)

```
T1 — Implement supervisor ACL in get-opportunities.js
├── T1-a: Validate unauthorized teamId -> return 403
├── T1-b: Allow authorized teamId query
├── T1-c: Consolidated $in query for all supervised teams
└── T1-d: Fallback to seller scope when no teams
└── Verify: npm test (4 unit tests pass)
```

### Phase 2: Frontend Filter (Sequential)

```
T2 — Enable team filter dropdown in sales-kanban.js
├── T2-a: Fetch /teams and filter by supervisor_id._id
├── T2-b: Populate #filterTeam dropdown with supervised teams
├── T2-c: Bind change event to loadOpportunities
├── T2-d: Hide filter (display:none) for supervisors with no teams
└── Verify: manual integration test
```

---

## Task Breakdown

### T1: Backend ACL and Opportunity Filtering for Supervisors

**What**: Implement backend ACL validation in get-opportunities.js for supervisor role, with team ownership check (403 for unauthorized), consolidated query for all supervised teams, and fallback to seller scope when supervisor manages no teams.
**Where**: `src/modules/opportunities/controllers/get-opportunities.js`
**Depends on**: None
**Reuses**: Team model (Team.find), Opportunity model
**Requirement**: KANBAN-BE-01, KANBAN-BE-02, KANBAN-BE-03, KANBAN-BE-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Supervisor requesting unauthorized teamId returns 403
- [ ] Supervisor requesting authorized teamId returns that team's opportunities
- [ ] Supervisor without teamId gets consolidated view of all supervised teams
- [ ] Supervisor with no teams falls back to own opportunities
- [ ] All 4 backend unit tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(api): implement supervisor ACL and team filtering for opportunities endpoint`

---

### T2: Enable and Populate Team Filter in Frontend for Supervisors

**What**: Expose #filterTeam dropdown for supervisor role in the Kanban frontend, filter team options to only show supervised teams, bind change event to reload opportunities, hide filter when supervisor manages no teams.
**Where**: `public/js/sales-kanban.js`
**Depends on**: T1
**Reuses**: App.getUser(), App.request(), existing DOM patterns
**Requirement**: KANBAN-FE-01, KANBAN-FE-02, KANBAN-FE-03, KANBAN-FE-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Filter dropdown shown for supervisors with at least one team
- [ ] Dropdown populated only with supervised teams
- [ ] Change event triggers loadOpportunitions
- [ ] Filter hidden (display:none) for supervisors with no teams
- [ ] Manual integration test verified

**Tests**: none (manual verification)
**Gate**: build

**Commit**: `feat(ui): enable team filter for supervisors in kanban board`

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Backend ACL | 1 controller file + 1 test file | ✅ Granular |
| T2: Frontend Filter | 1 JS file | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | Phase 1 start | ✅ Match |
| T2 | T1 | Phase 2 after T1 | ✅ Match |

## Test Co-location Validation

| Task | Layer Created | Matrix Requires | Task Says | Status |
| ---- | ------------- | --------------- | --------- | ------ |
| T1 | Controller | unit | unit | ✅ OK |
| T2 | Frontend (entity) | none | none | ✅ OK |
