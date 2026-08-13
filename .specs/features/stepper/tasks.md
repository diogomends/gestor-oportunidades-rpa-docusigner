# Componente Stepper — Tasks

## Fase 1 — Módulo Stepper

### T-01: Criar stepper.css
- **Descrição**: Criar `public/modules/stepper/stepper.css` com todos os estilos do componente.
- **Arquivos**: `public/modules/stepper/stepper.css`
- **ACs**: STEPPER-05, STEPPER-06, STEPPER-07, STEPPER-08, STEPPER-09, STEPPER-10
- **Verificação**: CSS contém variáveis `--stepper-*`, 3 breakpoints responsivos, 3 estados visuais, overflow-x.

### T-02: Criar stepper.js — classe base
- **Descrição**: Criar `public/modules/stepper/stepper.js` com classe `Stepper`, injeção de CSS, `_buildHTML()`, `render()`, `destroy()`.
- **Arquivos**: `public/modules/stepper/stepper.js`
- **ACs**: STEPPER-01, STEPPER-02, STEPPER-03, STEPPER-04
- **Verificação**: Importar módulo, instanciar, verificar stepper renderizado no DOM.

### T-03: Implementar API pública do Stepper
- **Descrição**: Adicionar `setActiveStep()`, `setCompletedSteps()`, `getState()`, suporte a `onStepClick`.
- **Arquivos**: `public/modules/stepper/stepper.js`
- **ACs**: STEPPER-16, STEPPER-17
- **Depende de**: T-02
- **Verificação**: `setActiveStep(2)` atualiza visual, `getState()` retorna estado correto.

## Fase 2 — Migração Contratos

### T-04: Substituir stepper estático em contratos.html
- **Descrição**: Remover HTML do stepper (linhas 29-77) e substituir por `<div id="stepper-container"></div>`. Importar módulo Stepper e instanciar no init() de contratos.js.
- **Arquivos**: `public/modules/contratos/contratos.html`, `public/modules/contratos/contratos.js`
- **ACs**: STEPPER-11
- **Depende de**: T-03
- **Verificação**: Página carrega stepper com 6 steps via JS, visual idêntico ao anterior.

### T-05: Adaptar navigation.js para API do Stepper
- **Descrição**: `updateStepper()` em navigation.js passa a chamar `window.stepper.setActiveStep(i)` e `window.stepper.setCompletedSteps([...completedSteps])`. Remover manipulação direta de DOM (querySelector, classList, textContent no stepper).
- **Arquivos**: `public/modules/contratos/navigation.js`
- **ACs**: STEPPER-13
- **Depende de**: T-04
- **Verificação**: Navegar por todos os 6 steps e confirmar estados ativo/completo.

### T-06: Substituir click handler por onStepClick
- **Descrição**: Remover listener de click no `#stepper` em contratos.js (linhas 546-556). Passar `onStepClick` na instância do Stepper.
- **Arquivos**: `public/modules/contratos/contratos.js`
- **ACs**: STEPPER-12
- **Depende de**: T-04
- **Verificação**: Clicar em step navega para página correta.

### T-07: Remover CSS do stepper de contratos.css
- **Descrição**: Remover regras `.stepper`, `.stepper-step`, `.stepper-circle`, `.stepper-label`, `.stepper-title`, `.stepper-subtitle`, `.stepper-connector` e media query responsiva de contratos.css.
- **Arquivos**: `public/modules/contratos/contratos.css`
- **Depende de**: T-05
- **Verificação**: Stepper mantém aparência (estilos vêm do stepper.css agora).

## Fase 3 — Migração Import Profiles (P2)

### T-08: Substituir stepper em import-profiles.html
- **Descrição**: Substituir `.stepper > .step` inline (import-profiles.html:72-82) por `<div id="stepper-container-import"></div>`. Importar Stepper com 3 steps.
- **Arquivos**: `public/import-profiles.html`, `public/js/pages/import-profiles.js`
- **ACs**: STEPPER-14
- **Depende de**: T-03
- **Verificação**: Modal de import exibe stepper com 3 steps e visual consistente.

### T-09: Remover estilos de stepper de import-profiles.css
- **Descrição**: Remover regras `.stepper`, `.step`, `.step-label`, `.stepper::before` de import-profiles.css.
- **Arquivos**: `public/css/import-profiles.css`
- **ACs**: STEPPER-15
- **Depende de**: T-08
- **Verificação**: Stepper mantém aparência.

## Fase 4 — Verificação

### T-10: Testar stepper em contratos
- **Descrição**: Navegar pelos 6 steps, verificar estados active/completed, conector verde, navegação por clique.
- **ACs**: STEPPER-11, STEPPER-12, STEPPER-13
- **Depende de**: T-07

### T-11: Testar responsividade
- **Descrição**: Testar em 1366px com sidebar, 1920px, 768px tablet, <480px mobile. Confirmar sem overflow.
- **ACs**: STEPPER-05, STEPPER-06, STEPPER-07, STEPPER-08
- **Depende de**: T-07, T-09

### T-12: Regressão
- **Descrição**: Rodar `npm test` e confirmar 0 falhas.
- **Depende de**: T-10, T-11

## Dependências

```
T-01 ──┐
       ├── T-03 ──┐
T-02 ──┘         │
                 ├── T-04 ── T-05 ── T-06 ── T-07 ──┐
                 │                                    ├── T-10 ── T-12
T-08 ── T-09 ────────────────────────────────────────┘
                                      T-11 ──────────┘
```
