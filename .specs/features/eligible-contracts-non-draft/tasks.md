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
| REQ-FIX-B1 | T04 | ✅ `eligibleContractsRegression.test.js` | ✅ Mongo Query Status Blocklist | Complete |
| REQ-FIX-B2 | T05 | ✅ `eligibleContractsRegression.test.js` | ✅ `getNextJob` Lock & Original Status Revert | Complete |
| REQ-FIX-M1 | T06 | ✅ `robotScheduler.test.js` | ✅ Spec/Code Synchronization | Complete |
| REQ-FIX-M2 | T07 | ✅ `check-pending-jobs.js` | ✅ CLI Import from Helper | Complete |
| REQ-FIX-M3 | T08 | ✅ `eligibleContractsRegression.test.js` | ✅ `Object.freeze` Filter Immutability | Complete |
| REQ-FIX-MIN | T09 | ✅ `eligibleContractsRegression.test.js` | ✅ Memory vs Mongo Status Assertion | Complete |

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

---

## Fase 4 — Correções de Bloqueadores e Hardening de Arquitetura

### T04: Correção do Filtro Mongo com Blocklist e Proteção de Null/Ausente (B1)
- **Req**: REQ-FIX-B1
- **Status**: [x] Done
- **Esforço**: 0.5h | Paralelável: Sim
- **Depende de**: Nenhuma

**Contexto**:
O filtro `{ status: { $ne: "rascunho" } }` captura status terminais/processados (`enviado`, `assinado`, `cancelado`, `em_processamento_robot`) e documentos com `status: null` ou ausente, gerando reenvios indevidos e loops de reprocessamento.

**O quê**:
1. Atualizar `GERADO_ELIGIBLE_FILTER` em `backend/src/modules/robot-docusign/utils/contractEligibility.js` para utilizar `$nin: ["rascunho", "enviado", "assinado", "cancelado", "em_processamento_robot"]` e assegurar que o campo `status` exista (`$exists: true, $ne: null, $ne: ""`).
2. Atualizar testes de regressão em `tests/backend/regression/eligibleContractsRegression.test.js`.

**Onde**:
- `backend/src/modules/robot-docusign/utils/contractEligibility.js`
- `tests/backend/regression/eligibleContractsRegression.test.js`

**Feito quando**:
- [x] `GERADO_ELIGIBLE_FILTER.status` exclui rascunhos, processados, cancelados e o próprio lock de processamento.
- [x] Documentos sem campo `status` ou nulos são estritamente excluídos.
- [x] Testes unitários validam a exclusão de todos os status da blocklist.

---

### T05: Inclusão de Status no Schema e Preservação do Status Original no Revert (B2)
- **Req**: REQ-FIX-B2
- **Status**: [x] Done
- **Esforço**: 0.5h | Paralelável: Não
- **Depende de**: T04

**Contexto**:
`em_processamento_robot` não está no enum de `Contract.js`, violando o schema Mongoose. Além disso, `robotInstanceController.js` re-lê o contrato após o lock, fazendo com que `contract.status` seja `em_processamento_robot` e o revert sempre force `gerado` (rebaixando contratos que tinham outro status original).

**O quê**:
1. Em `backend/src/models/Contract.js`, incluir `"em_processamento_robot"` no enum do campo `status`.
2. Em `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`:
   - Armazenar `originalStatus = contract?.status` pré-lock obtido do retorno atômico de `Contract.findOneAndUpdate`.
   - No fallback/revert de contrato inelegível (sem PDF ou e-mail), usar `originalStatus` capturado e garantir que não seja `em_processamento_robot` antes de aplicar o fallback para `"gerado"`.
3. Validar se há necessidade de sincronização no schema irmão em `gestor-oportunidades/src/modules/contract/models/Contract.js`.

**Onde**:
- `backend/src/models/Contract.js`
- `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
- `tests/backend/controllers/robotInstanceController.test.js`

**Feito quando**:
- [x] Enum do Mongoose aceita `em_processamento_robot`.
- [x] `originalStatus` é preservado e restaurado corretamente no caso de contrato inelegível.
- [x] Nenhum contrato tem seu status forçado indevidamente para `gerado` durante o destravamento.

---

### T06: Sincronização de Especificação e Scheduler (M1)
- **Req**: REQ-FIX-M1
- **Status**: [x] Done
- **Esforço**: 0.5h | Paralelável: Sim
- **Depende de**: Nenhuma

**Contexto**:
A documentação em `tasks.md:73` e `spec.md:REQ-ELIG-04` mencionava que `robotScheduler.js` consumia diretamente `GERADO_ELIGIBLE_FILTER`. Na implementação atual, o `robotScheduler.js` é estritamente orientado à fila `RobotJob` (e executa via `robotOrchestrator`), enquanto o polling direto de contratos é feito pelo `getNextJob` em `robotInstanceController.js`.

**O quê**:
1. Ajustar `spec.md` e `tasks.md` para documentar a fonte da verdade da arquitetura: `robotScheduler.js` processa a fila `RobotJob` e `robotInstanceController.js` consome contratos elegíveis com fallback atômico.
2. Garantir que, se houver qualquer chamada futura ou fallback Mongoose no scheduler, utilize `GERADO_ELIGIBLE_FILTER`.

**Onde**:
- `.specs/features/eligible-contracts-non-draft/spec.md`
- `.specs/features/eligible-contracts-non-draft/tasks.md`

**Feito quando**:
- [x] Especificação e código em total alinhamento sem drift arquitetural.

---

### T07: Importação Centralizada do Filtro no CLI check-pending-jobs (M2)
- **Req**: REQ-FIX-M2
- **Status**: [x] Done
- **Esforço**: 0.25h | Paralelável: Sim
- **Depende de**: T04

**Contexto**:
`tools/check-pending-jobs.js` duplica a constante `GERADO_ELIGIBLE_FILTER`, gerando risco de dessincronização em relação ao helper oficial.

**O quê**:
1. Importar `GERADO_ELIGIBLE_FILTER` diretamente de `../backend/src/modules/robot-docusign/utils/contractEligibility.js` no script CLI `tools/check-pending-jobs.js`.
2. Adicionar projeção nos `find().toArray()` de diagnóstico (`.project({ _id: 1, status: 1, documents: 1, client: 1, signer: 1, email: 1, clientEmail: 1 })`) e limite seguro para prevenir OOM em instâncias com muitos contratos.

**Onde**:
- `tools/check-pending-jobs.js`

**Feito quando**:
- [x] CLI importa o filtro oficial do helper ESM.
- [x] Consultas possuem projeção de campos otimizada.

---

### T08: Imutabilidade e Congelamento dos Filtros Exportados (M3)
- **Req**: REQ-FIX-M3
- **Status**: [x] Done
- **Esforço**: 0.25h | Paralelável: Sim
- **Depende de**: T04

**Contexto**:
Os exports `GERADO_ELIGIBLE_FILTER`, `CONTRACT_ELIGIBLE_FILTER` e `ELIGIBLE_CONTRACTS_FILTER` compartilham a mesma referência mutável em memória, suscetível a mutações acidentais por consumidores.

**O quê**:
1. Aplicar `Object.freeze` nos filtros exportados ou exportar clone imutável.
2. Atualizar testes para validar imutabilidade.

**Onde**:
- `backend/src/modules/robot-docusign/utils/contractEligibility.js`
- `tests/backend/regression/eligibleContractsRegression.test.js`

**Feito quando**:
- [x] Filtros exportados não podem ser alterados acidentalmente em runtime por outros módulos.

---

### T09: Esclarecimento Semântico nos Testes de Memória vs Mongo (Minor)
- **Req**: REQ-FIX-MIN
- **Status**: [x] Done
- **Esforço**: 0.25h | Paralelável: Sim
- **Depende de**: T04

**Contexto**:
O teste `isEligibleForSend` nomeava a asserção sugerindo que o helper validava `status`, mas o helper valida apenas integridade de payload (`hasPdf` e `hasRecipientEmail`), enquanto a restrição de status reside na query Mongo.

**O quê**:
1. Ajustar descrições e asserções nos testes unitários para deixar explícito que `isEligibleForSend` valida PDF + e-mail em memória e não valida `status`.
2. Atualizar documentação em `.specs/features/robot-docusigner/SPEC.md` alinhando com a decisão de não-rascunhos.

**Onde**:
- `tests/backend/regression/eligibleContractsRegression.test.js`
- `.specs/features/robot-docusigner/SPEC.md`

**Feito quando**:
- [x] Testes refletem com clareza a responsabilidade de cada camada.


