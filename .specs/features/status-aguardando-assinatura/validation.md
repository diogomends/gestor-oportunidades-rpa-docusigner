# Sincronização e Exibição de Status "Aguardando Assinatura de [Nome]" — Validation

**Feature**: status-aguardando-assinatura (AD-075)
**Data**: 2026-10-09
**Ambiente**: Windows (win32) · `node --env-file=.env.dev --test` (runner nativo)

---

## Cobertura Executada (regressão direcionada)

| Suíte | Resultado | Escopo validado |
| --- | --- | --- |
| `tests/robot/browser/docusign.test.js` | ✔ passa | Fachada do robô: `normalizeEnvelopeStatus`, `extractPendingSigner`, paridade pt-BR/en, preservação de rótulos ("Anulado"), barreiras de export `docusign.js` |
| `tests/backend/services/statusSyncScheduler.test.js` | ✔ passa | Varredura de status: matching, anti-fantasma (rascunho → skip), fluxo de persistência |
| `tests/backend/controllers/updateJobStatus-logs.test.js` | ✔ 3/3 | Handler `PATCH /instance/job/:jobId/status`: boot integral do app, logs, reconciliação via polling |
| `tests/backend/models/Contract.test.js` | ✔ passa | Schema `Contract` íntegro após novos campos |

> Conforme `.agents/rules/global.md`, não foram escritos testes unitários novos nesta feature — apenas regressão. A suíte completa (`npm test`) deve ser executada como gate imediatamente antes do commit.

---

## Code Review (pré-correções) — Findings

| ID | Severidade | Descrição | Status |
| --- | --- | --- | --- |
| F1 | Média | Duplicação parser robô↔backend com drift: "Waiting for X" → `unknown` no robô vs `sent` no backend | ✅ Corrigido (termo `waiting` adicionado à regra 2 de `STATUS_RULES` + `stripPendingSignerNoise` em ambas as cópias) |
| F2 | Baixa | Braço morto `!statusDetail` nas condições de override (`voided`/`completed`) | ✅ Corrigido (condições simplificadas + comentário explicando por que o override existe) |
| F3 | Baixa | `reconcileAgreementsBatch` reimplementava matcher de `contractEnvelopeMatcher.js` | ✅ Corrigido (controller importa `matchContractWithEnvelope` e normalizações canônicas) |
| F5 | Observação | Regex capturava ruído ("assinatura de", contadores) em `pendingSigner` | ✅ Corrigido (`stripPendingSignerNoise` limpa prefixos/sufixos e rótulos genéricos → null) |
| F6 | Observação | Zod passthrough sem validação de tipo dos novos campos | ⏸️ Aceito (protegido por `X-Robot-Key`; Mongoose faz cast para String; hardening opcional futuro) |
| F4 | Cross-repo | Verificar aceitação dos campos no `gestor-oportunidades` | ⏳ Com T5 (executar junto à task de frontend) |
| F7 | Higiene | `.rtk/filters.toml` restaurado e `.vscode/settings.json` revertidos fora do escopo | ✅ Corrigido (`git restore`/`git checkout`) |

---

## Correções Aplicadas pós-Review

1. **Paridade de parser (F1)**: `robot/src/browser/statusParser.js` — regra 2 de `STATUS_RULES` inclui `"waiting"`; helper `stripPendingSignerNoise` removendo ruído de rótulos ("outros", "terceiros", "assinatura de", contadores). Espelhado em `backend/src/modules/robot-docusign/browserrobot/agreementsService.js`.
2. **Braço morto (F2)**: condições de override simplificadas (`clean.includes("voided")` / `clean.includes("completed")`) com comentário de intenção.
3. **Delegação ao matcher (F3)**: `updateJobStatus.js` importa `matchContractWithEnvelope`, `normalizeString` e `mapEnvelopeStatusToContractStatus` de `contractEnvelopeMatcher.js`; lógica inline duplicada removida (alinhamento com AD-072/SRP).
4. **Barrel do robô**: `robot/src/browser/docusign.js` re-exporta `extractPendingSigner` (named exports + facade) para consumo por `job-runner`/testes.
5. **Testes de regressão**: `tests/robot/browser/docusign.test.js` atualizado para exercitar os novos exports e comportamentos.

---

## Rastreabilidade STATUS-01…STATUS-06

| Requisito | Veredito | Evidência |
| --- | --- | --- |
| STATUS-01 (extração robô) | ✅ | `statusParser.js` (testado via docusign.test.js) |
| STATUS-02 (schemas + persistência) | ✅ | `Contract.js`/`DocusignEnvelope.js` + upsert em `contractStatusSyncService` |
| STATUS-03 (SSE `job:progress`) | ✅ | Varredura (campos diretos) + modo pull (`result.envelopes` em `emitProgress`) |
| STATUS-04 (badges frontend) | ⏳ | T5 — arquivo em `gestor-oportunidades` (cross-repo) |
| STATUS-05 (filtros) | ⏳ | T5 — idem |
| STATUS-06 (regressão verde) | ✅/⏳ | Suítes direcionadas ✔ · `npm test` completo pendente (gate de commit) |

---

## Pendências

- [ ] T5: renderização de badges/filtros no frontend do CRM Funil (cross-repo) + validação F4.
- [ ] Gate final: `npm test` (suíte completa) antes do commit.
- [ ] Commit da feature seguindo `.agents/rules/commit.md` (sempre `--no-verify`).
