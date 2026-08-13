# Componente de Modal Reutilizável (componente-modal) — Specification

## Problem Statement

Atualmente, os modais na aplicação possuem implementações heterogêneas no frontend, com manipuladores de eventos e estilos CSS redundantes em diferentes arquivos HTML e JS. 

Para elevar a qualidade de UI/UX, melhorar a acessibilidade e garantir o princípio SOLID no frontend, um componente de modal reutilizável e robusto foi padronizado e concentrado sob `public/components/modal/`.

## Goals

- Criar especificação de um componente de modal genérico, acessível e reutilizável no frontend.
- Implementar suporte nativo a eventos de teclado (`ESC`), clique no backdrop/overlay para fechar, gerenciamento de foco (`focus trap`) e atributos ARIA (`aria-modal="true"`, `role="dialog"`).
- Garantir o reset automático dos estados dos formulários contidos dentro do modal ao fechá-lo.
- Fornecer API JS simples (`open()`, `close()`) com injeção dinâmica de HTML para acoplamento em módulos e telas do projeto.

## Out of Scope

| Funcionalidade | Motivo |
| -------------- | ------ |
| Animações 3D ou bibliotecas pesadas de terceiros | O projeto prioriza Vanilla JS e CSS puro para máximo desempenho. |
| Redesenho completo de telas não relacionadas a modais | Apenas modais seguirão a especificação padronizada. |

---

## User Stories

### P1: Acessibilidade e Eventos Globais

**User Story:** Como usuário do sistema, quero poder interagir com modais de forma intuitiva, fechando-os pela tecla `ESC` ou clicando no fundo da tela (backdrop), garantindo uma navegação fluida e acessível.

**Acceptance Criteria:**

1. MODAL-UX-01: WHEN modal está aberto e usuário pressiona `ESC` THEN sistema SHALL fechar o modal imediatamente.
2. MODAL-UX-02: WHEN usuário clica na área do backdrop (fora da caixa de diálogo) THEN sistema SHALL fechar o modal.
3. MODAL-UX-03: WHEN modal abre THEN sistema SHALL definir foco no primeiro campo editável ou botão de fechar e impedir navegação por TAB para fora do modal (focus trap).
4. MODAL-UX-04: WHEN modal renderiza THEN sistema SHALL conter atributos ARIA apropriados (`role="dialog"`, `aria-modal="true"`).

### P1: Gerenciamento de Estado e Ciclo de Vida

**User Story:** Como desenvolvedor de UI, quero uma API clara em JavaScript para abrir, fechar, popular e resetar formulários dentro de modais de forma limpa e previsível.

**Acceptance Criteria:**

5. MODAL-API-01: WHEN método `close()` é executado ou modal é fechado THEN sistema SHALL resetar o formulário interno (`form.reset()`).
6. MODAL-API-02: WHEN método `open(data)` é executado THEN sistema SHALL carregar o HTML se necessário, exibir o modal e bloquear o scroll do `body`.

---

## Edge Cases

| # | Caso | Comportamento Esperado |
| - | ---- | ---------------------- |
| 1 | Múltiplos pressionamentos rápidos de `ESC` | Fecha apenas o modal ativo sem causar exceções no console. |
| 2 | Clique arrastado de dentro do modal para fora | Não fecha o modal caso o clique tenha iniciado no conteúdo do diálogo. |
| 3 | Modal sem formulário interno | Fecha normalmente sem lançar erro de chamada `reset()`. |

---

## Requirement Traceability

| ID | História | AC | Implementado Em | Status |
| -- | -------- | -- | --------------- | ------ |
| MODAL-UX-01 | Evento ESC | Tecla ESC fecha modal ativo | `modal-produtos-precos.js` | Verified |
| MODAL-UX-02 | Backdrop Click | Clique no overlay fecha modal | `modal-produtos-precos.js` | Verified |
| MODAL-UX-03 | Acessibilidade | Focus trap e acerto de foco | `modal-produtos-precos.js` | Verified |
| MODAL-UX-04 | Atributos ARIA | Atributos role="dialog" e aria-modal | `modal-produtos-precos.js` | Verified |
| MODAL-API-01 | Ciclo de Vida / Reset | Form reset no fechamento | `modal-produtos-precos.js` | Verified |
| MODAL-API-02 | Controle de Abertura | Exibição, lock scroll e DOM injection | `modal-produtos-precos.js` | Verified |

**Cobertura:** 6 requisitos, 6 mapeados, 0 sem mapeamento ✔️

---

## Success Criteria

- [x] Componente especificado e concentrado em `public/components/modal/`.
- [x] Atendimento completo a requisitos de acessibilidade (tecla ESC, ARIA, Focus Trap).
- [x] API limpa em Vanilla JS sem dependência de frameworks externos.
