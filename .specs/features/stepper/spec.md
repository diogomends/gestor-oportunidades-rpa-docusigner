# Componente Stepper — Specification

## Problem Statement

O CRM possui duas implementações distintas de stepper:
- **Contratos**: 6 steps com classes `.stepper-step`, `.stepper-circle`, `.stepper-label`, `.stepper-connector` em `contratos.css`
- **Import Profiles**: 3 steps com classes `.step`, `.step-label`, `.stepper::before` em `import-profiles.css`

Ambas têm problemas de responsividade (overflow em telas menores, sem adaptação para 15" com sidebar aberta) e não há um componente reutilizável para novas páginas do CRM.

## Goals

1. Criar um módulo JavaScript autossuficiente que injeta CSS dinamicamente e renderiza o stepper como componente reutilizável
2. Unificar a nomenclatura e o comportamento visual dos dois steppers existentes
3. Suporte responsivo para todas as viewports (320px a 2560px)
4. Labels sempre visíveis (nunca esconder título/subtítulo)
5. Migrar Contratos e Import Profiles para usar o novo módulo

## Out of Scope

- Alteração da lógica de navegação (updateStepper, click handlers) — o componente fornece a UI, a navegação continua no módulo consumidor
- Animações complexas ou transições entre steps
- Suporte a steps dinâmicos (número variável além do configurado na inicialização)

---

## Arquitetura

```
public/modules/stepper/
├── stepper.js      # ES module: classe Stepper + injeção de CSS
├── stepper.css     # Estilos do componente (injetados via JS)
└── stepper.html    # Template HTML (ou inline no JS)
```

### API do Módulo

```js
import { Stepper } from '/modules/stepper/stepper.js';

const stepper = new Stepper({
  container: '#stepper-container',
  steps: [
    { title: 'Dados do Cliente', subtitle: 'Identificação e contatos' },
    { title: 'Negociação', subtitle: 'Planos e ofertas' },
  ],
  activeStep: 0,
  completedSteps: [],
  onStepClick: (index) => { /* navegação */ }
});

stepper.setActiveStep(index);
stepper.setCompletedSteps(indices);
stepper.getState(); // { activeStep, completedSteps, totalSteps }
stepper.destroy();
```

### Injeção de CSS

O módulo injeta o CSS uma única vez via:

```js
const style = document.createElement('style');
style.id = 'stepper-styles';
style.textContent = stepperCSS;
document.head.appendChild(style);
```

Se o estilo já existir (`#stepper-styles`), não injeta novamente.

---

## User Stories & Acceptance Criteria

### P1: Módulo JavaScript Autossuficiente

**ACs:**

1. **STEPPER-01**: `new Stepper({ container, steps })` renderiza o stepper dentro do container com a estrutura HTML padronizada (`.stepper > .stepper-step > .stepper-circle + .stepper-label > .stepper-title + .stepper-subtitle`, com `.stepper-connector` entre steps).
2. **STEPPER-02**: O CSS é injetado no `<head>` apenas uma vez, mesmo com múltiplas instâncias.
3. **STEPPER-03**: `stepper.destroy()` remove a instância do DOM; se for a última, também remove o CSS injetado.
4. **STEPPER-04**: O módulo não depende de bibliotecas externas — apenas DOM API nativa.

### P1: Responsividade e Labels Sempre Visíveis

**ACs:**

5. **STEPPER-05**: O stepper ocupa 100% da largura do container sem estourar em qualquer viewport ≥ 320px, com sidebar aberta (250px) ou fechada (60px).
6. **STEPPER-06**: `.stepper-title` e `.stepper-subtitle` nunca são ocultados via `display: none` em nenhum breakpoint.
7. **STEPPER-07**: Em viewports < 768px:
   - `.stepper-circle`: 28px
   - `.stepper-title`: 0,75rem
   - `.stepper-subtitle`: 0,65rem
   - `.stepper-step` padding: 0,3rem 0,4rem
   - `.stepper-connector`: min-width 12px, max-width 32px
8. **STEPPER-08**: O stepper usa `overflow-x: auto` com `scrollbar-width: thin` para viewports extremas (≤480px).

### P1: Estados Visuais

**ACs:**

9. **STEPPER-09**: Cada step possui três estados visuais:
    - `default`: círculo com borda cinza, texto secundário
    - `active`: círculo preenchido com cor primária, sombra `0 0 0 4px rgba(99, 102, 241, 0.2)`, título em texto primário
    - `completed`: círculo preenchido com cor de sucesso, ícone de check (`ph-check`), conector direito em verde
10. **STEPPER-10**: Transições CSS de 0,2s para hover, active e completed.

### P1: Migração — Contratos

**ACs:**

11. **STEPPER-11**: `contratos.html` carrega o stepper via `<script type="module">` importando `Stepper` de `/modules/stepper/stepper.js` e o stepper estático no HTML é substituído pelo componente renderizado.
12. **STEPPER-12**: A navegação por clique nos steps funciona via `onStepClick`.
13. **STEPPER-13**: `updateStepper()` em `navigation.js` passa a chamar `stepper.setActiveStep()` e `stepper.setCompletedSteps()` em vez de manipular classes manualmente.

### P2: Migração — Import Profiles

**ACs:**

14. **STEPPER-14**: `import-profiles.html` substitui o stepper inline pelo componente `Stepper` com 3 steps.
15. **STEPPER-15**: Visual consistente com o stepper de contratos.

### P2: API

**ACs:**

16. **STEPPER-16**: `stepper.getState()` retorna `{ activeStep, completedSteps, totalSteps }`.
17. **STEPPER-17**: `onStepClick` callback é disparado ao clicar em um step.

---

## Design Tokens (Variáveis CSS)

```css
:root {
  --stepper-circle-size: 36px;
  --stepper-circle-font: 0.85rem;
  --stepper-circle-border: 2px;
  --stepper-connector-min: 16px;
  --stepper-connector-max: 48px;
  --stepper-step-padding: 0.4rem 0.6rem;
  --stepper-step-gap: 0.5rem;
  --stepper-title-size: 0.85rem;
  --stepper-subtitle-size: 0.7rem;
  --stepper-color-active: var(--primary-color);
  --stepper-color-completed: var(--success-color);
  --stepper-color-default: var(--border-color);
  --stepper-color-text: var(--text-secondary);
  --stepper-color-text-active: var(--text-primary);
  --stepper-transition: 0.2s;
}
```

---

## Requirement Traceability

| ID | História | AC | Prioridade |
| -- | -------- | --- | ---------- |
| STEPPER-01 | Módulo JS | Renderização | P1 |
| STEPPER-02 | Módulo JS | CSS injetado uma vez | P1 |
| STEPPER-03 | Módulo JS | destroy() | P1 |
| STEPPER-04 | Módulo JS | Sem dependências | P1 |
| STEPPER-05 | Responsividade | Sem overflow | P1 |
| STEPPER-06 | Responsividade | Labels sempre visíveis | P1 |
| STEPPER-07 | Responsividade | <768px fontes reduzidas | P1 |
| STEPPER-08 | Responsividade | overflow-x: auto | P1 |
| STEPPER-09 | Estados | 3 estados visuais | P1 |
| STEPPER-10 | Estados | Transições | P1 |
| STEPPER-11 | Migração Contratos | Stepper via módulo | P1 |
| STEPPER-12 | Migração Contratos | Click navigation | P1 |
| STEPPER-13 | Migração Contratos | updateStepper adaptado | P1 |
| STEPPER-14 | Migração Import Profiles | Stepper de 3 steps | P2 |
| STEPPER-15 | Migração Import Profiles | Visual consistente | P2 |
| STEPPER-16 | API | getState() | P2 |
| STEPPER-17 | API | onStepClick callback | P2 |

---

## Edge Cases

- **Zero steps**: `new Stepper({ steps: [] })` → não renderiza nada, sem erro.
- **Um step**: renderiza um círculo sem conectores.
- **activeStep fora do range**: `setActiveStep(-1)` ou `setActiveStep(99)` → ignora.
- **Container inexistente**: lança erro descritivo.
- **Múltiplas instâncias na mesma página**: CSS compartilhado.
- **Destroy durante animação**: remove elementos imediatamente.
