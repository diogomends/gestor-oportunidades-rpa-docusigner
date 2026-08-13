# Topnav & Drawer Sidebar — Tasks & Execution Plan

## Summary & Execution Flow

```
Fase 1: W1 (T1) -> Commit Spec
Fase 2: W1 OK -> W2, W3, W4 em PARALELO (Task tool - 3 sub-agentes simultaneos)
        W2: T2 -> T3 (HTML + CSS)
        W3: T4 (Visibility em core/ui/sidebar.js)
        W4: T5 -> T6 -> T7 (Drawer logic em toggle-drawer.js)
Fase 3: W2, W3, W4 OK -> W5: T8 (Playwright E2E navbar.spec.js)
        W5 OK -> Verifier (Automático) -> validation.md
```

---

## Tasks Inventory

### Fase 1: Especificação & Planejamento (W1)

- [x] **T1 (Spec & Design Documentation)**
  - **Worker**: W1 Spec
  - **Arquivos**: `.specs/features/componentes-globais-ui/sidebar/sub-specs/topnav-drawer/{spec.md, design.md, tasks.md}`
  - **Descrição**: Criar especificação funcional, modelo de design e plano de tarefas do Topnav & Drawer com rastreabilidade de IDs NAV-01..NAV-08.
  - **Gate**: Validação sintática e de estrutura em `.specs/`.
  - **Commit**: `docs(specs): create spec, design and tasks for topnav-drawer sidebar`

---

### Fase 2: Implementação Paralela (W2, W3, W4)

#### Worker W2: HTML & CSS (Sequencial T2 -> T3)

- [ ] **T2 (HTML Structure)**
  - **Worker**: W2 HTML+CSS
  - **Requisito**: `NAV-01`
  - **Arquivos**: `public/modules/sidebar/sidebar.html`
  - **Descrição**: Adicionar a estrutura do Topnav e contêiner do Drawer com elementos acessíveis e backdrop.
  - **Gate**: Inspeção de marcação HTML e preservação de seletores legados.
  - **Commit**: `feat(ui): add topnav and drawer html markup to sidebar`

- [ ] **T3 (CSS Styling & Responsiveness)**
  - **Worker**: W2 HTML+CSS
  - **Requisito**: `NAV-02`
  - **Arquivos**: `public/modules/sidebar/sidebar.css`
  - **Descrição**: Implementar estilos CSS para Topnav, Drawer overlay, transições e comportamento responsivo mobile/desktop.
  - **Gate**: Validação CSS sem erros de sintaxe.
  - **Commit**: `style(ui): add topnav and drawer responsive styles and transitions`

#### Worker W3: Visibilidade por Perfil (T4)

- [ ] **T4 (Role-Based Visibility Integration)**
  - **Worker**: W3 Visibility
  - **Requisito**: `NAV-03`
  - **Arquivos**: `public/js/core/ui/sidebar.js`
  - **Descrição**: Garantir que os elementos do Topnav/Drawer respeitem rigorosamente o mapa de visibilidade `visibilityRules` por cargo.
  - **Gate**: `npm test`
  - **Commit**: `feat(sidebar): integrate topnav drawer elements into role-based visibility`

#### Worker W4: Lógica do Drawer (Sequencial T5 -> T6 -> T7)

- [ ] **T5 (Toggle & Backdrop Interactivity)**
  - **Worker**: W4 Drawer
  - **Requisito**: `NAV-04`, `NAV-05`
  - **Arquivos**: `public/modules/sidebar/toggle-drawer.js`, `public/modules/sidebar/index.js`
  - **Descrição**: Implementar módulo `toggle-drawer.js` lidando com os eventos de clique no botão hamburger e clique no backdrop.
  - **Gate**: `npm test`
  - **Commit**: `feat(sidebar): implement drawer toggle and backdrop click handlers`

- [ ] **T6 (Keyboard ESC Close & State Guard)**
  - **Worker**: W4 Drawer
  - **Requisito**: `NAV-06`
  - **Arquivos**: `public/modules/sidebar/toggle-drawer.js`
  - **Descrição**: Adicionar suporte ao fechamento do Drawer via tecla `ESC` com verificação de estado aberto.
  - **Gate**: `npm test`
  - **Commit**: `feat(sidebar): add ESC key listener to close drawer`

- [ ] **T7 (Accessibility ARIA Attributes)**
  - **Worker**: W4 Drawer
  - **Requisito**: `NAV-07`
  - **Arquivos**: `public/modules/sidebar/toggle-drawer.js`
  - **Descrição**: Sincronizar o estado do Drawer com os atributos `aria-expanded` e `aria-hidden`.
  - **Gate**: `npm test`
  - **Commit**: `feat(sidebar): synchronize ARIA attributes for drawer accessibility`

---

### Fase 3: Testes E2E & Validação (W5 & Verifier)

- [ ] **T8 (E2E Integration Test Suite)**
  - **Worker**: W5 E2E
  - **Requisito**: `NAV-08`
  - **Arquivos**: `tests/e2e/navbar.spec.js`
  - **Descrição**: Criar e executar a suíte Playwright E2E para testar a renderização do Topnav, toggle do Drawer, visibilidade por papel, backdrop click e tecla ESC.
  - **Gate**: Stack dev online (`make up-dev` ou servidor ativo na porta 3000) + `make test-e2e-headless` (ou `npx playwright test tests/e2e/navbar.spec.js`). *Se a stack não estiver disponível, W5 reporta blocker.*
  - **Commit**: `test(e2e): add end-to-end tests for topnav and drawer sidebar`

- [ ] **Verifier (Automated Verification)**
  - **Disparo**: Automático pós-T8
  - **Relatório**: `.specs/features/componentes-globais-ui/sidebar/sub-specs/topnav-drawer/validation.md`
  - **Descrição**: Verificação independente de cobertura de ACs, auditoria de diffs e checagem de integridade contra os requisitos `NAV-01` a `NAV-08`.

---

## Test Coverage Matrix

| Requirement ID | Description | Primary Test File / Method | Gate Executed |
| -------------- | ----------- | -------------------------- | ------------- |
| `NAV-01` | HTML Markup | Visual & E2E DOM check | HTML Inspection |
| `NAV-02` | CSS Styling | Visual & E2E Layout check | CSS Inspection |
| `NAV-03` | Visibility | Unit / E2E role checks | `npm test` |
| `NAV-04` | Toggle Hamburger | `tests/e2e/navbar.spec.js` | Playwright E2E |
| `NAV-05` | Backdrop Click | `tests/e2e/navbar.spec.js` | Playwright E2E |
| `NAV-06` | ESC Key Close | `tests/e2e/navbar.spec.js` | Playwright E2E |
| `NAV-07` | ARIA Accessibility | `tests/e2e/navbar.spec.js` | Playwright E2E |
| `NAV-08` | Full Flow E2E | `tests/e2e/navbar.spec.js` | Playwright E2E |

---

## Protected Component Safeguard

Workers **JAMAIS** devem modificar:
1. Backend (`src/**`)
2. HTML das 10 páginas da aplicação (`public/*.html`)
3. Elementos com IDs legados `nav-*` (`navGroupIndicadores`, `navGroupVendas`, `navGroupGestaoComercial`, `navGroupAdminPessoas`, `navGroupConfigTecnicas`, `navPipeline`, `navContracts`, etc.)
4. Contêiner principal `#sidebar-container`
5. `App.getUser()` e `public/js/core/ui/user-info.js`

---

## Retorno Obrigatório dos Workers (Compact Summary)

Ao concluir sua fase/tarefas, cada sub-agente Worker deve responder no seguinte formato estrito:

```markdown
Fase [N] complete:
- Tasks done: [T? + hash de commit se aplicável]
- Tests: [N passed, 0 failed]
- Commands de commit gerados: [lista de comandos git/gh por commit.md]
- Deviations/blockers: [none | descrição]
```
