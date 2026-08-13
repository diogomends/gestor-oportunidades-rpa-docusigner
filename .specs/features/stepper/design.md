# Componente Stepper — Design

## Arquitetura do Módulo

```
public/modules/stepper/
├── stepper.js      # ES module: classe Stepper
└── stepper.css     # Estilos (injetados via JS)
```

### Estrutura do `stepper.js`

```
┌─────────────────────────────────────────┐
│               Stepper class             │
├─────────────────────────────────────────┤
│ - container: HTMLElement                │
│ - options: { steps[], activeStep, ... } │
│ - _steps: object[]                      │
│ - _activeStep: number                   │
│ - _completedSteps: Set<number>          │
│ - onStepClick: fn | null               │
├─────────────────────────────────────────┤
│ + constructor(options)                  │
│ + render()                              │
│ + setActiveStep(index): void            │
│ + setCompletedSteps(indices[]): void    │
│ + getState(): { activeStep, ... }       │
│ + destroy(): void                       │
│ - _injectCSS(): void                    │
│ - _buildHTML(): string                  │
│ - _handleClick(e): void                 │
└─────────────────────────────────────────┘
```

### HTML Gerado

```html
<div class="stepper" id="stepper">
  <div class="stepper-step" data-step="1">
    <div class="stepper-circle">1</div>
    <div class="stepper-label">
      <span class="stepper-title">Dados do Cliente</span>
      <span class="stepper-subtitle">Identificação</span>
    </div>
  </div>
  <div class="stepper-connector"></div>
  <div class="stepper-step active" data-step="2">
    ...
  </div>
  ...
</div>
```

## Responsividade (3 breakpoints)

| Viewport | circle | title | subtitle | connector |
|----------|--------|-------|----------|-----------|
| ≥1025px | 36px | 0.85rem | 0.7rem | 16-48px |
| 768-1024px | 32px | 0.8rem | 0.65rem | 12-40px |
| <768px | 28px | 0.75rem | 0.65rem | 12-32px |

## Injeção de CSS

- `_injectCSS()` cria `<style id="stepper-styles">` no `<head>`
- Se `#stepper-styles` já existir, não injeta novamente
- `destroy()` remove o estilo apenas se for a última instância ativa

## Plano de Migração — Contratos

**Antes:**
- HTML estático do stepper em `contratos.html:29-77`
- `navigation.js:updateStepper()` manipula DOM diretamente
- `contratos.js:547-556` ouvinte de click no `#stepper`
- CSS do stepper em `contratos.css:24-115` + media query

**Depois:**
- `contratos.html` substitui HTML estático por `<div id="stepper-container"></div>`
- `contratos.js` importa `Stepper` e instancia no `init()`
- `navigation.js:updateStepper()` chama `window.stepper.setActiveStep/completedSteps`
- Click handler usa `onStepClick` do componente
- CSS do stepper removido de `contratos.css`

## Plano de Migração — Import Profiles (P2)

- Substituir `.stepper > .step` inline por `<div id="stepper-container-import"></div>`
- Importar `Stepper` com 3 steps
- Manter lógica de indicador ativo via `stepper.setActiveStep()`
