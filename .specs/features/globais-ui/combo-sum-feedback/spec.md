# Componente de Feedback de Soma de Combo (combo-sum-feedback) — Specification

## Problem Statement

O componente de feedback visual de soma de combo (`#comboSumFeedback`) foi removido do sistema devido a problemas de precisão de ponto flutuante e formatação intermediária da máscara de moeda. O feedback exibia mensagens de sucesso/erro sobre a soma dos itens do combo em relação ao valor total da oferta, mas a lógica de validação já garante a trava visual/lógica do botão Salvar.

## Goals

- Documentar o componente como especificação para implementação futura (sem ação no sistema atual).
- Manter o comportamento de habilitação/desabilitação do botão Salvar baseado na soma dos itens.
- Reservar o feedback visual para quando a validação de precisão for estabilizada.

## Out of Scope

| Funcionalidade | Motivo |
| -------------- | ------ |
| Implementação imediata do feedback visual | Problemas de precisão de ponto flutuante e formatação intermediária da máscara |
| Alteração na lógica de validação do botão Salvar | A trava atual já funciona corretamente |

## User Stories

### P1: Componente de Feedback Visual de Soma

**User Story:** Como administrador, quero ver um feedback visual indicando se a soma dos itens do combo confere com o valor total da oferta, para ter clareza sobre a integridade financeira antes de salvar.

**Acceptance Criteria:**

1. **COMBO-FB-01:** WHEN a soma dos itens do combo confere com o valor total THEN o componente SHALL exibir mensagem de sucesso com ícone de check e o valor da soma formatado.
2. **COMBO-FB-02:** WHEN a soma dos itens do combo diverge do valor total THEN o componente SHALL exibir mensagem de alerta com ícone de aviso, mostrando a soma, o preço total e a diferença.
3. **COMBO-FB-03:** WHEN o campo valor do item está em estado intermediário da máscara (ex: `"1,234,56"`) THEN o componente SHALL processar o valor corretamente.
4. **COMBO-FB-04:** WHEN o campo valor do item está vazio ou inválido THEN o componente SHALL tratar como zero sem quebrar a validação.
5. **COMBO-FB-05:** WHEN há imprecisão de ponto flutuante na soma THEN o componente SHALL arredondar valores para 2 casas decimais antes da comparação.

## Requirement Traceability

| ID | História | AC | Implementado Em | Status |
| -- | -------- | -- | --------------- | ------ |
| COMBO-FB-01 | Feedback de sucesso | Mensagem com ícone check | N/A | Pending |
| COMBO-FB-02 | Feedback de divergência | Mensagem com ícone aviso | N/A | Pending |
| COMBO-FB-03 | Estado intermediário da máscara | Tratamento de múltiplas vírgulas | N/A | Pending |
| COMBO-FB-04 | Valores vazios/inválidos | Tratamento como zero | N/A | Pending |
| COMBO-FB-05 | Floating-point drift | Arredondamento de 2 casas | N/A | Pending |

## Success Criteria

- [ ] Especificação documentada para implementação futura
- [ ] Comportamento de validação do botão Salvar preservado
- [ ] Feedback visual reservado para quando a precisão for estabilizada
