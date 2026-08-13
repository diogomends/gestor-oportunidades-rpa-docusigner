# Seletor de Modo de Navegação — Tasks & Execution Plan

## Summary & Execution Flow

```
Fase 1: Spec & Design Documentation -> .specs/ (Concluído)
Fase 2: Backend (T1) -> Suporte a navigation_mode no Zod / Mongoose
Fase 3: HTML & CSS (T2, T3) -> Ajuste do hambúrguer e classes .mode-navbar / .mode-sidebar
Fase 4: Frontend Logic (T4, T5) -> Integração no initSidebar() e painel exibir-ocultar.html
Fase 5: Verificação & E2E (T6) -> Validação automatizada
```

---

## Tasks Inventory

### Fase 2: Backend (T1)

- [x] **T1 (Backend Zod & Controller Update)**
  - **Worker**: Backend Specialist
  - **Requisito**: `NAV-MODE-05`
  - **Arquivos**: `src/modules/config-sistema/controllers/systemConfigController.js`
  - **Descrição**: Atualizar o schema Zod e valores padrão de `ui_visibility` no `systemConfigController.js` para aceitar e persistir `navigation_mode` ("navbar" ou "sidebar").
  - **Gate**: Sintaxe JS e validação do controller.
  - **Commit**: `feat(config-sistema): add navigation_mode to ui_visibility system config controller`

---

### Fase 3: HTML & CSS (T2, T3)

- [x] **T2 (Topnav & Drawer HTML Cleanup)**
  - **Worker**: Frontend UI Specialist
  - **Requisito**: `NAV-MODE-01`, `NAV-MODE-02`
  - **Arquivos**: `public/modules/sidebar/sidebar.html`
  - **Descrição**: Garantir o alinhamento à esquerda do botão `.menu-toggle` no Topnav e remover hambúrgueres internos duplicados na barra de topo da sidebar.
  - **Gate**: Inspeção da marcação HTML.
  - **Commit**: `feat(ui): align topnav hamburger to the left and clean up duplicate drawer button`

- [x] **T3 (Dual Mode Navigation CSS & Switch Panel Markup)**
  - **Worker**: Frontend UI Specialist
  - **Requisito**: `NAV-MODE-01`, `NAV-MODE-03`
  - **Arquivos**: `public/modules/sidebar/sidebar.css`, `public/modules/config-sistema/exibir-ocultar/exibir-ocultar.html`
  - **Descrição**: Adicionar estilos CSS para `.mode-navbar` e `.mode-sidebar` no `sidebar.css` e incluir o seletor de rádio em `exibir-ocultar.html`.
  - **Gate**: Inspeção CSS e validação visual de layout.
  - **Commit**: `style(ui): add mode-navbar and mode-sidebar CSS and add navigation mode selector to exibir-ocultar.html`

---

### Fase 4: Frontend Logic (T4, T5)

- [x] **T4 (Auto-Save in Exibir / Ocultar Panel)**
  - **Worker**: Frontend JS Specialist
  - **Requisito**: `NAV-MODE-04`
  - **Arquivos**: `public/modules/config-sistema/exibir-ocultar/exibir-ocultar.js`
  - **Descrição**: Carregar o valor atual de `navigation_mode` e registrar listener de alteração para enviar `PUT /api/system-config/ui-visibility` com auto-salvamento.
  - **Gate**: Auto-save funcional e exibição de feedback.
  - **Commit**: `feat(config-sistema): add auto-save for navigation mode in exibir-ocultar.js`

- [x] **T5 (Global Navigation Mode Applier & LocalStorage Cache)**
  - **Worker**: Frontend JS Specialist
  - **Requisito**: `NAV-MODE-06`, `NAV-MODE-07`
  - **Arquivos**: `public/modules/sidebar/index.js`
  - **Descrição**: No `initSidebar()`, ler o cache de `localStorage` e a API para aplicar a classe `.mode-navbar` ou `.mode-sidebar` no documento.
  - **Gate**: Troca em tempo real entre modos de navegação sem FOUC.
  - **Commit**: `feat(sidebar): apply navigation mode dynamically based on system config and local cache`

---

### Fase 5: Validação (T6)

- [x] **T6 (Verification & Integration Check)**
  - **Worker**: Verifier
  - **Arquivos**: `.specs/features/componentes-globais-ui/sidebar/sub-specs/navigation-mode-selector/validation.md`
  - **Descrição**: Testar alternância entre Navbar e Sidebar e checar persistência no banco e na interface.
  - **Commit**: `docs(specs): add validation report for navigation mode selector`

---

## Componentes Protegidos (Intocáveis)

1. Estruturas de autenticação, JWT e middleware de restrição de horário.
2. Contratos de API de oportunidades, contratos e watchlist.
3. IDs legados de itens da sidebar (`navGroupIndicadores`, `navGroupVendas`, `navGroupGestaoComercial`, `navGroupAdminPessoas`, `navGroupConfigTecnicas`, `navPipeline`, `navContracts`, etc.).
