# Desativação do Fallback de Navegador no Servidor Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

---

**Spec**: `.specs/features/servidor-robot/desativacao-fallback-servidor-browser/spec.md`
**Status**: Ready for Approval

---

## Test Coverage Matrix

> Generated from codebase and project guidelines (`AGENTS.md`, `.agents/rules/global.md`). Regressão exclusiva com runner nativo Node.js.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Scheduler Status Sync | integration | Regressão de skip quando frota query offline | `tests/backend/services/*.test.js` | `npm run test:backend` |
| Scheduler Robot Jobs | integration | Regressão de fila sem fallback de envio inline | `tests/backend/services/*.test.js` | `npm run test:backend` |
| Test-Login Admin Endpoint | integration | Regressão da rota manual de verificação de login | `tests/backend/controllers/*.test.js` | `npm run test:backend` |
| Regressão Geral | integration | Integridade de todos os fluxos e rotas | `tests/**/*.test.js` | `npm test` |

---

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após alterações em schedulers/services | `npm run test:backend` |
| Full | Após conclusão de todas as tasks | `npm test` |

---

## Execution Plan

### Phase 1: Status Sync Scheduler Fleet-Only Enforcement
```
T1
```

### Phase 2: Robot Scheduler Fleet-Only Enforcement
```
T1 → T2
```

### Phase 3: Regression & Integrity Verification
```
T2 → T3
```

---

## Tasks

### Phase 1: Status Sync Scheduler Fleet-Only Enforcement

- [x] **T1**: Desativar fallback de navegador no `statusSyncValidator` e `contractStatusSyncService`
  - **Goal**: Ajustar a validação e fluxo de sincronização para que, quando não houver robô de consulta ativo (`role: query` ou `all` com heartbeat recente), o scheduler apenas registre no log que a frota está offline e encerre a rodada de sincronização, sem invocar `browserrobot.executeWithBrowser` no servidor e sem enfileirar jobs órfãos.
  - **Files**:
    - `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncValidator.js`
    - `backend/src/modules/robot-docusign/seletorApiRobot/contractStatusSyncService.js`
  - **Tests**: `npm run test:backend`
  - **Gate**: Passagem nos testes de integração do backend garantindo skip limpo sem chamadas de browser no servidor.

---

### Phase 2: Robot Scheduler Fleet-Only Enforcement

- [x] **T2**: Desativar fallback de envio inline no `robotScheduler`
  - **Goal**: Modificar `processPendingJobs` para que, na ausência de robôs ativos de envio (`role: update` ou `all`), o agendador apenas registre no log que a frota de envio está offline e retorne status de espera (`skipped` / `fleet_offline`), sem tentar instanciar o navegador no servidor para processar contratos inline.
  - **Files**:
    - `backend/src/modules/robot-docusign/seletorApiRobot/robotScheduler.js`
  - **Tests**: `npm run test:backend`
  - **Gate**: Passagem nos testes de integração do scheduler de jobs.

---

### Phase 3: Regression & Integrity Verification

- [x] **T3**: Validação de regressão geral e integridade dos endpoints manuais
  - **Goal**: Executar a suíte de testes de regressão completa do backend e do robô, validando que as rotas manuais (como `POST /test-login`) permanecem plenamente funcionais e que nenhum contrato de API ou rota pública/privada foi impactado.
  - **Files**:
    - `tests/backend/**/*.test.js`
  - **Tests**: `npm test`
  - **Gate**: 100% dos testes de regressão executados com sucesso.
