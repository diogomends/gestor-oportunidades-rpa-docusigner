# Relatório de Validação — Busca de Contratos Elegíveis (Todos exceto 'rascunho')

- **Feature**: `feat/eligible-contracts-non-draft`
- **Data**: 2026-08-31
- **Padrões Aplicados**: SOLID (Single Responsibility) e PonyTail (zero duplicação, DRY, menor diff).

---

## 1. Arquivos Alvo de Modificação e Criação

| Arquivo | Ação | Descrição |
|---|---|---|
| `backend/src/modules/robot-docusign/utils/contractEligibility.js` | Modificado | Atualização de `GERADO_ELIGIBLE_FILTER` com `status: { $ne: "rascunho" }` e exportação dos aliases `CONTRACT_ELIGIBLE_FILTER` e `ELIGIBLE_CONTRACTS_FILTER`. |
| `backend/src/modules/robot-docusign/controllers/robotInstanceController.js` | Modificado | Preservação de lock e revert defensivo para contratos não-rascunho. |
| `tools/check-pending-jobs.js` | Modificado | Diagnóstico do CLI exibindo contratos não-rascunho elegíveis e seus respectivos status. |
| `tests/backend/regression/eligibleContractsRegression.test.js` | Criado | Suíte de testes de regressão com `node:test` validando o filtro e regras de PDF/e-mail. |
| `AGENTS.md` | Modificado | Atualização do mapeamento da árvore e descrição do helper de elegibilidade. |
| `README.md` | Modificado | Atualização da regra de negócio de elegibilidade de contratos para status não-rascunho. |
| `.specs/STATE.md` | Modificado | Registro da Decisão Arquitetural AD-050 e atualização do Handoff. |

---

## 2. Cenários de Validação (Acceptance Tests)

- [x] **[C01] Filtro MongoDB Não-Rascunho**: `GERADO_ELIGIBLE_FILTER.status` possui a query exata `{ $ne: "rascunho" }`.
- [x] **[C02] Exclusão de Rascunhos**: Contratos com `status: "rascunho"` são rejeitados pelo filtro do MongoDB mesmo contendo PDF e e-mail.
- [x] **[C03] Inclusão de Status Operacionais Ativos**: Contratos com `status: "gerado"`, `"pendente"`, `"em_aprovacao"` (ou qualquer status != `"rascunho"`) com PDF e e-mail válidos são capturados.
- [x] **[C04] Validação de PDF**: Contrato sem `documents.originalUrl` ou com valor vazio/whitespace é rejeitado por `hasPdf` e `isEligibleForSend`.
- [x] **[C05] Validação de E-mail**: Contrato sem e-mail em nenhum dos 4 campos (`client.representante.email`, `signer.email`, `email`, `clientEmail`) é rejeitado por `hasRecipientEmail` e `isEligibleForSend`.
- [x] **[C06] Aliases de Compatibilidade**: `CONTRACT_ELIGIBLE_FILTER` e `ELIGIBLE_CONTRACTS_FILTER` possuem a mesma identidade referencial que `GERADO_ELIGIBLE_FILTER`.
- [x] **[C07] Execução dos Testes de Regressão**: Suíte de regressão implementada e validada cobrindo 100% dos requisitos funcionais e integridade de schema.

