# Tasks de Implementação: Busca de Contratos Elegíveis (Todos exceto 'rascunho')

## Execution Protocol

- **Runner**: `node --env-file=.env.dev --test` (nativo do Node.js)
- **Framework**: `node:assert` + `node:test` (mock.method, mock.restoreAll)
- **Branch**: `feat/eligible-contracts-non-draft`
- **Commits**: Atômicos por task, seguindo `.agents/rules/commit.md`
- **Idioma**: pt-BR em documentação e mensagens; EN em código e variáveis
- **JSDoc**: Obrigatório em todas as funções/exports criados ou alterados

---

## Gate Check Commands

```bash
npm test                                                              # Executa toda a suíte de testes (backend + robot)
node --env-file=.env.dev --test tests/backend/utils/contractEligibility.test.js  # Testes unitários do helper
node --env-file=.env.dev --test tests/backend/**/*.test.js            # Testes do backend
```

---

## Test Coverage Matrix

| Req ID | Task | Testes Unitários / Regressão | Testes de Integração | Status |
|---|---|---|---|---|
| REQ-ELIG-02 | T01 | ✅ `eligibleContractsRegression.test.js` | ✅ Scheduler Fallback | Complete |
| REQ-ELIG-03 | T01 | ✅ `eligibleContractsRegression.test.js` | ✅ Aliases compatibility | Complete |
| REQ-ELIG-04 | T02 | ✅ `eligibleContractsRegression.test.js` | ✅ `getNextJob` lock flow | Complete |
| REQ-ELIG-02 | T03 | ✅ `tools/check-pending-jobs.js` | ✅ MongoDB diagnostic | Complete |

---

## Fase 1 — Helper de Elegibilidade e Aliases (TLC Standard)

### T01: Atualização de GERADO_ELIGIBLE_FILTER e Exportação de Aliases

- **Req**: REQ-ELIG-02, REQ-ELIG-03
- **Status**: [x] Done
- **Esforço**: 0.5h | Paralelável: Sim
- **Depende de**: Nenhuma

**Contexto**:
O helper `backend/src/modules/robot-docusign/utils/contractEligibility.js` centraliza o filtro MongoDB de contratos elegíveis para envio. O filtro atual restringe `status: "gerado"`. Ele foi ampliado para `status: { $ne: "rascunho" }`, preservando a checagem de `documents.originalUrl` e os 4 campos de e-mail.

**O quê**:
1. Atualizar o objeto `GERADO_ELIGIBLE_FILTER` com `status: { $ne: "rascunho" }`.
2. Exportar `CONTRACT_ELIGIBLE_FILTER` e `ELIGIBLE_CONTRACTS_FILTER` como referências ao mesmo objeto (DRY / PonyTail).
3. Criar suíte de testes de regressão em `tests/backend/regression/eligibleContractsRegression.test.js`.

**Onde**:
- `backend/src/modules/robot-docusign/utils/contractEligibility.js`
- `tests/backend/regression/eligibleContractsRegression.test.js`

**Feito quando**:
- [x] `GERADO_ELIGIBLE_FILTER.status` é `{ $ne: "rascunho" }`.
- [x] Aliases `CONTRACT_ELIGIBLE_FILTER` e `ELIGIBLE_CONTRACTS_FILTER` exportados.
- [x] Testes de regressão cobrem cenários com status `gerado`, `pendente`, `rascunho`, `cancelado` e validações de PDF/e-mail.

---

## Fase 2 — Integração com Controllers e Schedulers

### T02: Alinhamento do getNextJob e robotScheduler

- **Req**: REQ-ELIG-04
- **Status**: [x] Done
- **Esforço**: 0.5h | Paralelável: Não
- **Depende de**: T01

**Contexto**:
`robotInstanceController.js` (`getNextJob`) e `robotScheduler.js` (`processPendingJobs`) consom `GERADO_ELIGIBLE_FILTER` para capturar e travar contratos para processamento.

**O quê**:
1. Validar que `getNextJob` trava atomicamente qualquer contrato elegível não-rascunho com `status: "em_processamento_robot"`.
2. Em caso de falha por falta de PDF ou e-mail, garantir que o contrato seja revertido de `em_processamento_robot` para o seu status de origem ou não trave a fila.
3. No `robotScheduler.js`, certificar que o fallback Mongoose utilize o filtro atualizado.

**Onde**:
- `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
- `backend/src/modules/robot-docusign/seletorApiRobot/robotScheduler.js`

**Feito quando**:
- [x] `getNextJob` trava e retorna contratos elegíveis não-rascunho.
- [x] Contratos `rascunho` são estritamente ignorados.
- [x] Inelegíveis sem PDF/e-mail são tratados sem deadlocks.

---

## Fase 3 — Diagnóstico e Documentação

### T03: Atualização do Diagnóstico check-pending-jobs e Registro de Decisão

- **Req**: REQ-ELIG-02
- **Status**: [x] Done
- **Esforço**: 0.5h | Paralelável: Sim
- **Depende de**: T01

**Contexto**:
A ferramenta de CLI `tools/check-pending-jobs.js` exibe o status de contratos no MongoDB aguardando envio.

**O quê**:
1. Atualizar `tools/check-pending-jobs.js` para consultar e rotular contratos não-rascunho (`status: { $ne: "rascunho" }`).
2. Registrar a decisão arquitetural AD-050 em `.specs/STATE.md`.
3. Preencher o relatório de validação em `.specs/features/eligible-contracts-non-draft/validation.md`.

**Onde**:
- `tools/check-pending-jobs.js`
- `.specs/STATE.md`
- `.specs/features/eligible-contracts-non-draft/validation.md`

**Feito quando**:
- [x] `node tools/check-pending-jobs.js` lista contratos não-rascunho e rotula conformidade.
- [x] AD-050 registrada e documentada em `STATE.md`.
- [x] Validação concluída com 100% dos testes passando.

