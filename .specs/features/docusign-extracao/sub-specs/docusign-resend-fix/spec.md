# Spec: Reenvio de E-mail de Assinatura via DocuSign (updateRecipients + Modal UI + Event Delegation)

## Summary

Correção da funcionalidade de reenvio de e-mail de assinatura DocuSign acionada pelo botão `.btn-resend-docusign` no painel de contratos.

Na implementação inicial da correção, a chamada `envelopesApi.updateRecipients(accountId, envelopeId, { resendEnvelope: 'true' })` passava apenas a flag `resendEnvelope`, resultando em um corpo de requisição HTTP vazio (`undefined`) na SDK `docusign-esign`, o que fazia a API v2.1 da DocuSign ignorar o reenvio.

A solução atualizada:
1. Busca primeiramente a lista de destinatários do envelope via `envelopesApi.listRecipients(accountId, envelopeId)` e repassa o objeto `recipients` na chamada `envelopesApi.updateRecipients(accountId, envelopeId, { recipients, resendEnvelope: 'true' })`.
2. Substitui o alerta nativo por um modal customizado de confirmação/negativa (`#resendDocuSignModal`) no frontend com exibição dos dados do destinatário e feedback visual em tempo real.
3. Adiciona **Delegação Global de Eventos** (`document.addEventListener("click", ...)`), re-vinculação pós-renderização (`renderContracts()`) e exibição inline `display: flex` para garantir que o clique no botão abra o modal independentemente de filtros, buscas ou re-renderizações da SPA.
4. Expande a exibição do botão de reenvio para contemplar todos os status pendentes de assinatura (`"sent"`, `"enviado"`, `"delivered"`, `"created"`, `"gerado"`).

## Requirements

### REQ-001: Reenvio Efetivo de Notificação no DocuSign
- **Description**: O método `docusignService.resendEnvelope` deve primeiramente obter os destinatários ativos do envelope via `listRecipients` e repassá-los para `updateRecipients` junto com a flag `resendEnvelope: 'true'`, para que a API DocuSign receba os dados dos destinatários no corpo HTTP e envie as notificações por e-mail.
- **Traceability**: `src/modules/docusign/services/docusignService.js`

### REQ-002: Logs de Diagnóstico e Rastreabilidade
- **Description**: O serviço e o controlador do módulo DocuSign devem registrar em log o início da operação, a busca de destinatários, os IDs envolvidos (`contractId`, `envelopeId`, `accountId`), o sucesso do reenvio e eventuais erros retornados pela API DocuSign.
- **Traceability**: `src/modules/docusign/controllers/docusignController.js` e `src/modules/docusign/services/docusignService.js`

### REQ-003: Modal Customizado de Confirmação e Feedback Visual (Frontend)
- **Description**: A interface do painel de contratos deve exibir um modal de confirmação (`#resendDocuSignModal`) exibindo nome e e-mail do signatário antes de disparar o reenvio, oferecendo opções de confirmar ou cancelar, além de indicadores de progresso, sucesso e tratamento de erro inline.
- **Traceability**: `public/modules/contratos/contratos.html`, `public/modules/contratos/dashboard/modals.js`, `public/modules/contratos/dashboard/render/render-contracts.js`, `public/modules/contratos/dashboard/events/setup-dynamic-button-events.js` e `public/modules/contratos/dashboard/events/setup-event-listeners.js`

### REQ-004: Event Delegation e Re-vinculação Dinâmica no Frontend
- **Description**: O clique no botão `.btn-resend-docusign` deve ser gerenciado por Delegação Global de Eventos em `document.addEventListener("click", ...)` e reinvocado em `renderContracts()`, garantindo o funcionamento do clique mesmo após buscas ou filtros re-renderizarem o DOM.
- **Traceability**: `public/modules/contratos/dashboard/events/setup-dynamic-button-events.js` e `public/modules/contratos/dashboard/render/render-contracts.js`

### REQ-005: Expansão de Status Elegíveis para Reenvio
- **Description**: O botão de reenvio `.btn-resend-docusign` deve ser exibido em todos os status de contrato pendentes de assinatura: `["sent", "enviado", "delivered", "created", "gerado"]`.
- **Traceability**: `public/modules/contratos/dashboard/render/render-contracts.js`

### REQ-006: Garantia Visual de Exibição do Modal
- **Description**: A função `openResendDocuSignModal` em `modals.js` deve explicitamente definir `modal.style.display = "flex"` ao abrir e `modal.style.display = "none"` ao fechar, garantindo visibilidade imediata sem dependência exclusiva de especificidade de seletores CSS externos.
- **Traceability**: `public/modules/contratos/dashboard/modals.js`

## Acceptance Criteria

- **AC-001**: Ao acionar `POST /api/docusign/resend/:contractId`, o backend executa `envelopesApi.listRecipients` e invoca `envelopesApi.updateRecipients` com `{ recipients, resendEnvelope: 'true' }`.
- **AC-002**: O console do servidor exibe logs estruturados com `[DocuSign Controller]` e `[DocuSign Service]`.
- **AC-003**: Se o envelope estiver em estado final (`completed`, `declined`, `voided`), o controlador bloqueia o reenvio e retorna HTTP 400 com mensagem amigável em pt-BR.
- **AC-004**: Ao clicar no botão "Reenviar" (`.btn-resend-docusign`), a interface exibe o modal `#resendDocuSignModal` com o nome e e-mail do signatário principal.
- **AC-005**: Ao confirmar o envio no modal, o botão exibe um indicador de progresso (spinner) e atualiza a mensagem de status para sucesso ou erro sem fechar abruptamente a tela.
- **AC-006**: Mesmo após filtrar contratos pela barra de pesquisa ou aplicar filtros por status, o clique no botão "Reenviar" (`.btn-resend-docusign`) abre o modal `#resendDocuSignModal` via delegação global de eventos.
- **AC-007**: Contratos com status `created` ou `gerado` exibem o botão de reenvio quando o usuário logado possui a permissão adequada.
- **AC-008**: Ao ser ativado, o modal `#resendDocuSignModal` recebe a classe `.active` e `display: flex` inline, sobrepondo os elementos da SPA com backdrop escuro e desfocado.

## Architecture & Decisions

- **AD-013**: Reenvio de notificação DocuSign via `listRecipients` + `updateRecipients` com objeto `recipients`, parâmetro `resendEnvelope: 'true'`, Event Delegation no frontend e Modal UI. Registrado em `.specs/STATE.md`.
