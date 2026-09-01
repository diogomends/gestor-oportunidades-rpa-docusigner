# Especificação: Busca de Contratos Elegíveis (Todos exceto 'rascunho')

## Problem Statement

Atualmente, o filtro de elegibilidade do Robô DocuSigner restringe a busca de contratos exclusivamente àqueles com `status: "gerado"`. No fluxo de negócio do CRM Gestor de Oportunidades, existem contratos em múltiplos status operacionais ativos (cards) que estão aptos para envio e assinatura eletrônica, desde que possuam o documento PDF gerado e o e-mail do signatário preenchido.

Esta especificação define a ampliação dos critérios de busca no banco compartilhado e rotinas de orquestração para capturar todos os contratos cujo status seja diferente de `"rascunho"` (`status: { $ne: "rascunho" }`), mantendo as validações essenciais de integridade (presença de PDF anexado e e-mail de destinatário).

---

## Requisitos Funcionais

### [REQ-ELIG-02] Filtro MongoDB para Contratos Não-Rascunho
O helper centralizado `contractEligibility.js` DEVE fornecer uma query de filtro MongoDB que selecione documentos onde o campo `status` seja diferente de `"rascunho"`, `documents.originalUrl` exista e seja não-nulo e não-vazio, e contenha ao menos um e-mail válido entre os campos `client.representante.email`, `signer.email`, `email` ou `clientEmail`.

### [REQ-ELIG-03] Compatibilidade Referencial e Aliases
Para evitar breaking changes com imports existentes no servidor backend, agendador e controllers, o módulo DEVE manter exportada a constante `GERADO_ELIGIBLE_FILTER` com a nova regra e expor aliases explícitos `CONTRACT_ELIGIBLE_FILTER` e `ELIGIBLE_CONTRACTS_FILTER`.

### [REQ-ELIG-04] Preservação de Integridade em 3 Camadas
A validação de integridade DEVE ser mantida em todas as 3 camadas do sistema:
1. **Banco / Lock**: `getNextJob` em `robotInstanceController.js` e fallback do `robotScheduler.js` consultam o MongoDB com a query filtrada.
2. **Memória**: `isEligibleForSend` valida em memória a presença de PDF e e-mail após sanitização com `trim()`.
3. **Pré-Execução do Robô**: `job-runner.js` valida `pdfUrl` e `recipientEmail` antes de disparar o navegador Playwright.

---

## User Stories & Acceptance Criteria

### US-014: Busca de Contratos Elegíveis com Status Não-Rascunho

**User Story**: Como operador e sistema CRM, quero que o Robô DocuSigner busque e processe qualquer contrato/card que não esteja em `"rascunho"`, para que contratos em diferentes etapas do funil possam ser enviados automaticamente assim que tiverem PDF e e-mail preenchidos.

#### Acceptance Criteria (EARS Notation)
1. **[AC-01]** WHEN o robô busca o próximo job (`getNextJob`) ou o scheduler executa (`processPendingJobs`) THEN o sistema SHALL consultar contratos no MongoDB com a condição `{ status: { $ne: "rascunho" } }`.
2. **[AC-02]** WHEN um contrato possui `status: "rascunho"` THEN o sistema SHALL ignorar o contrato na busca automática.
3. **[AC-03]** WHEN um contrato possui status diferente de `"rascunho"` E possui `documents.originalUrl` preenchido E possui e-mail válido em `client.representante.email`, `signer.email`, `email` ou `clientEmail` THEN o sistema SHALL considerá-lo elegível para processamento.
4. **[AC-04]** WHEN um contrato possui status diferente de `"rascunho"` mas NÃO possui PDF anexado ou e-mail válido THEN o sistema SHALL ignorá-lo sem travar a fila e sem alterar indevidamente seu status original.
5. **[AC-05]** WHEN a ferramenta de diagnóstico `check-pending-jobs.js` for executada THEN ela SHALL contabilizar e exibir contratos não-rascunho elegíveis e incompletos.

---

## Rastreabilidade de Requisitos

| Requisito | User Story | Componentes Afetados | Teste de Cobertura | Status |
|---|---|---|---|---|
| REQ-ELIG-02 | US-014 | `contractEligibility.js`, `robotScheduler.js` | `eligibleContractsRegression.test.js` | Implemented |
| REQ-ELIG-03 | US-014 | `contractEligibility.js` | `eligibleContractsRegression.test.js` | Implemented |
| REQ-ELIG-04 | US-014 | `robotInstanceController.js`, `job-runner.js` | `eligibleContractsRegression.test.js` | Implemented |

