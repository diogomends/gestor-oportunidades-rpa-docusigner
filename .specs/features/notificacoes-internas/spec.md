# Notificações Internas — Specification

## Problem Statement

O CRM possui um serviço de email (`mailService.js`) que atualmente não é utilizado por nenhuma funcionalidade. Não há um sistema de notificações internas que alerte vendedores, supervisores e administradores sobre eventos relevantes como mudança de estágio de oportunidade, metas próximas do vencimento ou contratos prestes a expirar. Isso reduz a capacidade de resposta da equipe e exige que os operadores monitorem manualmente cada registro.

## Goals

- [ ] Vendedores recebem notificação por email quando uma oportunidade sua muda de estágio
- [ ] Supervisores/coordenadores são notificados quando uma meta da equipe está próxima do vencimento
- [ ] Usuários podem configurar quais tipos de notificação desejam receber (opt-in)
- [ ] Histórico de notificações enviadas fica registrado para auditoria

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Notificações push (SMS/WhatsApp) | Exige integração com provedores terceiros |
| Notificações in-app (real-time) | Exige WebSocket ou SSE |
| Templates de email customizáveis | Templates fixos no código, sem UI de edição |

---

## User Stories

### P1: Notificação de Mudança de Estágio

**User Story**: Como vendedor, quero receber um email quando uma oportunidade minha mudar de estágio para que eu possa agir rapidamente.

**Why P1**: Evento mais frequente e de maior impacto no funil.

**Acceptance Criteria**:

1. WHEN uma oportunidade tem seu `stage` alterado THEN o sistema SHALL enviar um email para o `email` do vendedor (campo `assignedTo` da opportunity)
2. WHEN o email é enviado THEN o sistema SHALL conter: nome da empresa, novo estágio, link para a oportunidade no CRM
3. WHEN a oportunidade não possui `assignedTo` THEN o sistema SHALL não enviar notificação

---

### P2: Alerta de Meta Próxima do Vencimento

**User Story**: Como supervisor, quero ser avisado quando uma meta da minha equipe estiver próxima do prazo final.

**Why P2**: Permite ação corretiva antes do vencimento.

**Acceptance Criteria**:

1. WHEN faltam 7 dias ou menos para o `deadline` de uma goal THEN o sistema SHALL enviar email aos supervisores da equipe
2. WHEN a goal já está concluída (atingiu a meta) THEN o sistema SHALL não enviar alerta

---

### P3: Configuração de Notificações

**User Story**: Como usuário, quero escolher quais notificações receber para não ser sobrecarregado.

**Why P3**: Melhoria de experiência, evita spam.

**Acceptance Criteria**:

1. WHEN o usuário acessa `GET /api/internal/notifications/config` THEN o sistema SHALL retornar as preferências atuais dele
2. WHEN o usuário envia `PUT /api/internal/notifications/config` com os tipos desejados THEN o sistema SHALL salvar e retornar 200
3. WHEN um tipo de notificação está desabilitado na config do usuário THEN o sistema SHALL não enviar aquele tipo mesmo que o evento ocorra

---

## Edge Cases

- WHEN o SMTP está desconfigurado THEN o sistema SHALL logar aviso e não lançar erro
- WHEN o email do destinatário é inválido THEN o sistema SHALL logar erro e continuar
- WHEN o mesmo evento ocorre múltiplas vezes THEN o sistema SHALL enviar notificação a cada ocorrência (sem dedup)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| NOTIF-INT-01 | P1: Mudança de Estágio | Design | Pending |
| NOTIF-INT-02 | P2: Alerta de Meta | Design | Pending |
| NOTIF-INT-03 | P3: Configuração | Design | Pending |

**Coverage:** 3 total, 0 verified, 3 pending.

---

## Success Criteria

- [ ] Vendedor recebe email em < 30s após mudança de estágio da oportunidade
- [ ] Supervisor recebe alerta semanal de metas próximas do vencimento
- [ ] Usuário consegue desabilitar notificações que não deseja
