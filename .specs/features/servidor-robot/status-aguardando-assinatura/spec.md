# Sincronização e Exibição de Status "Aguardando Assinatura de [Nome]" Specification

## Problem Statement
Quando um envelope é disparado no DocuSign e aguarda a assinatura de destinatários específicos (ex: "Aguardando ZE CEDENTE", "Aguardando 2 outros") ou é anulado ("Anulado"), o sistema classifica o contrato genericamente como `enviado` ou `cancelado` sem expor o detalhe nominal. O operador do CRM Funil não consegue identificar diretamente no card qual signatário está pendente nem filtrar contratos por esse estado.

Esta melhoria extrai o status textual exato e o nome do signatário pendente no robô Playwright, armazena no banco de dados (`crm_contracts`), transmite via SSE e renderiza no badge do card do CRM (`AGUARDANDO [NOME]`, `ANULADO`).

## Goals
- [ ] Capturar no robô o texto exato de status e o signatário pendente ("Aguardando ZE CEDENTE", "Aguardando 2 outros", "Anulado").
- [ ] Persistir no schema `Contract` os campos `pendingSigner`, `docusignStatusDetail` e `rawDocusignStatus`.
- [ ] Emitir eventos em tempo real via SSE (`job:progress`) durante a sincronização de status.
- [ ] Exibir no badge do card do contrato no CRM o rótulo formatado `AGUARDANDO [NOME]` ou `ANULADO` com truncamento (> 25 caracteres) e tooltip.
- [ ] Suportar filtro de contratos aguardando assinatura no dashboard.

## Out of Scope
Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| --- | --- |
| Alteração nas rotas de envio/trigger | O fluxo de submissão e preenchimento de envelopes do robô já está consolidado e funcional. |
| Criação de testes unitários isolados | Diretriz do projeto estipula exclusivamente testes de regressão de fluxos ponta a ponta. |
| Notificação por e-mail ou push externo para signatários | O envio de e-mails de cobrança é gerenciado pela própria plataforma DocuSign. |

---

## Assumptions & Open Questions
Every ambiguity is resolved or recorded here - nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Formato do badge no CRM | Exibir `AGUARDANDO [NOME]` diretamente no badge | Escolha do usuário (Opção A) para visualização imediata | Sim |
| Mensagens sem nome específico ("Aguardando terceiros" / "Aguardando 2 outros") | Registrar o texto presente no DocuSign | Decisão do usuário para preservar a informação original | Sim |
| Status de anulação | Rótulo "Anulado" preservado | DocuSign pt-BR utiliza termo "Anulado" e usuário solicitou manter histórico | Sim |
| Truncamento de nomes longos | Truncar acima de 25 caracteres com reticências e tooltip | Evitar quebra de layout mantendo o nome legível no hover | Sim |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Captura e Exibição de Status de Assinatura Nominal ⭐ MVP

**User Story**: Como operador do CRM, quero visualizar no card do contrato qual signatário está pendente de assinar (ex: `AGUARDANDO ZE CEDENTE` ou `ANULADO`) para saber exatamente em qual etapa do fluxo de assinatura o cliente se encontra.

**Why P1**: Entrega ponta a ponta a visibilidade do signatário pendente no CRM Funil.

**Acceptance Criteria**:

1. WHEN o robô extrair a tabela de acordos no DocuSign THEN the robô SHALL capturar o `rawStatus` e extrair o `pendingSigner` ou texto original da interface.
2. WHEN a varredura atualizar o contrato no banco THEN the sistema SHALL persistir `pendingSigner`, `docusignStatusDetail` e `rawDocusignStatus` no modelo Contract.
3. WHEN o status de um contrato for atualizado THEN the sistema SHALL emitir evento SSE `job:progress` contendo `pendingSigner` e `docusignStatusDetail`.
4. WHEN o card do contrato for renderizado no CRM THEN the interface SHALL exibir no badge o rótulo `AGUARDANDO [NOME]` ou `ANULADO`.
5. IF o nome do signatário for superior a 25 caracteres THEN the interface SHALL truncar com reticências e exibir tooltip com o nome completo.
6. WHEN o usuário selecionar o filtro de contratos pendentes de assinatura THEN the dashboard SHALL filtrar os contratos correspondentes.
7. The sistema SHALL preservar os testes de regressão existentes sem criar testes unitários isolados.

**Independent Test**: Executar a varredura de status em um contrato com envelope ativo e verificar a renderização do badge no card do CRM Funil.

---

## Edge Cases

- IF o DocuSign exibir apenas "Aguardando terceiros" ou "Aguardando 2 outros" THEN the sistema SHALL registrar esse texto no `docusignStatusDetail`.
- IF o envelope for anulado no DocuSign THEN the sistema SHALL definir o status como "cancelado" com detalhe visual "Anulado" e manter os dados de histórico.
- IF a extração do DocuSign não contiver texto de status THEN the sistema SHALL manter o status prévio sem sobrescrever indevidamente.

---

## Requirement Traceability
Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| STATUS-01 | P1: Captura e Exibição de Status de Assinatura Nominal | Tasks | Pending |
| STATUS-02 | P1: Captura e Exibição de Status de Assinatura Nominal | Tasks | Pending |
| STATUS-03 | P1: Captura e Exibição de Status de Assinatura Nominal | Tasks | Pending |
| STATUS-04 | P1: Captura e Exibição de Status de Assinatura Nominal | Tasks | Pending |
| STATUS-05 | P1: Captura e Exibição de Status de Assinatura Nominal | Tasks | Pending |
| STATUS-06 | P1: Captura e Exibição de Status de Assinatura Nominal | Tasks | Pending |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria
How we know the feature is successful:
- [ ] O badge do card do contrato no CRM Funil exibe `AGUARDANDO [NOME]` ou `ANULADO` corretamente.
- [ ] Nomes com mais de 25 caracteres são truncados sem quebrar o layout do card.
- [ ] A sincronização persiste `pendingSigner` e `docusignStatusDetail` no banco de dados.
- [ ] Todos os testes de regressão passam sem quebrar comportamentos legados.
