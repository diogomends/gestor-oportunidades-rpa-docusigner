# Topnav & Drawer Sidebar — Sub-Specification

## Problem Statement

A sidebar do CRM Funil de Vendas atua como menu principal de navegação. Com a evolução do layout, há a necessidade de integrar uma Topnav (barra superior de navegação) com comportamento de Drawer (menu gaveta lateral/overlay) para otimizar o espaço de tela e melhorar a experiência de navegação mobile e desktop sem quebrar o suporte à sidebar legada ou as páginas já existentes.

## Goals

- Estruturar a Topnav e o Drawer de forma integrada à Sidebar global.
- Garantir visibilidade baseada em papéis (role-based visibility) reutilizando `core/ui/sidebar.js`.
- Oferecer interações de abertura/fechamento do Drawer (botão hamburger, backdrop/overlay e tecla ESC).
- Garantir transições CSS suaves e responsividade completa (mobile e desktop).
- Validar todo o comportamento através de testes E2E Playwright (`navbar.spec.js`).
- Preservar integralmente o backend, HTMLs de páginas legadas, IDs `nav-*`, `#sidebar-container`, `App.getUser()` e `user-info.js`.

## Out of Scope

| Funcionalidade | Motivo |
| -------------- | ------ |
| Alterações no Backend (`src/`) | Requisito 100% frontend UI |
| Modificação no HTML das 10 páginas | Layout injetado dinamicamente via `#sidebar-container` |
| Alterações em `user-info.js` ou `App.getUser()` | Componentes de autenticação e sessão legados protegidos |
| Redesenho de IDs legados `nav-*` | Compatibilidade com regras de visibilidade |

---

## User Stories & Acceptance Criteria

### P1: Estrutura HTML & Estilos CSS (Topnav + Drawer)

**User Story:** Como usuário, quero visualizar uma Topnav limpa no topo da tela com um botão de gatilho para abrir o Drawer em telas menores ou expandidas.

**Acceptance Criteria:**
1. NAV-01: WHEN o componente carrega THEN `#sidebar-container` SHALL conter a estrutura HTML da Topnav e do Drawer integrada ao `sidebar.html`.
2. NAV-02: WHEN o Drawer estiver ativo ou colapsado THEN os estilos CSS em `sidebar.css` SHALL aplicar transições suaves (`transition: transform 0.3s ease`), backdrop com transparência e z-index apropriado.

### P1: Visibilidade & Controle de Acesso

**User Story:** Como administrador ou vendedor, quero que o Drawer/Topnav reflita apenas os itens aos quais tenho permissão.

**Acceptance Criteria:**
3. NAV-03: WHEN `updateSidebar()` executa em `core/ui/sidebar.js` THEN os itens de navegação dentro do Drawer/Topnav SHALL respeitar estritamente o mapa de visibilidade por papel (cargo).

### P1: Comportamento do Drawer (Toggle & Fechamento)

**User Story:** Como usuário, quero abrir o Drawer pelo botão hamburger, fechá-lo clicando no backdrop ou pressionando ESC.

**Acceptance Criteria:**
4. NAV-04: WHEN o botão hamburger `.menu-toggle` no Topnav é clicado THEN o Drawer SHALL alternar a classe `.drawer-open`.
5. NAV-05: WHEN o Drawer estiver aberto AND o usuário clicar no backdrop `.drawer-backdrop` THEN o Drawer SHALL ser fechado (remover `.drawer-open`).
6. NAV-06: WHEN o Drawer estiver aberto AND a tecla `ESC` for pressionada THEN o Drawer SHALL ser fechado.
7. NAV-07: WHEN o estado do Drawer muda THEN o atributo `aria-expanded` do botão gatilho SHALL ser atualizado (`true`/`false`).

### P1: Testes E2E (Playwright)

**User Story:** Como desenvolvedor, quero garantir que as interações da Topnav e Drawer não quebrem no CI/CD.

**Acceptance Criteria:**
8. NAV-08: WHEN a suíte E2E roda em `tests/e2e/navbar.spec.js` THEN todos os testes de toggle, visibilidade e fechamento do Drawer SHALL passar com 100% de sucesso.

---

## Edge Cases

| # | Caso | Comportamento Esperado |
| - | ---- | ---------------------- |
| 1 | Clique rápido duplo no hamburger | Prevenir múltiplos toggles desalinhados via CSS pointer-events ou debounce |
| 2 | Redimensionamento da janela com Drawer aberto | Fechar Drawer automaticamente se transicionar para viewport desktop grande |
| 3 | Tecla ESC pressionada com Drawer fechado | Nenhuma ação executada, listener não causa erros |
| 4 | Ausência de `.drawer-backdrop` no DOM | Guard clause evita exceções JS |

---

## Requirement Traceability

| ID | História | AC | Módulo / Arquivo Afetado | Status |
| -- | -------- | -- | ----------------------- | ------ |
| NAV-01 | Estrutura HTML | Topnav e Drawer no HTML | `public/modules/sidebar/sidebar.html` | Pending |
| NAV-02 | Estilização CSS | Estilos e animações | `public/modules/sidebar/sidebar.css` | Pending |
| NAV-03 | Visibilidade | Role-based visibility | `public/js/core/ui/sidebar.js` | Pending |
| NAV-04 | Drawer Toggle | Gatilho hamburger | `public/modules/sidebar/toggle-drawer.js` | Pending |
| NAV-05 | Drawer Backdrop | Fechamento por clique fora | `public/modules/sidebar/toggle-drawer.js` | Pending |
| NAV-06 | Tecla ESC | Fechamento por keyboard | `public/modules/sidebar/toggle-drawer.js` | Pending |
| NAV-07 | Acessibilidade | Atributos ARIA | `public/modules/sidebar/toggle-drawer.js` | Pending |
| NAV-08 | Testes E2E | Validação automatizada | `tests/e2e/navbar.spec.js` | Pending |

---

## Success Criteria

- [ ] Topnav e Drawer funcionam integrados ao componente global de sidebar.
- [ ] Regras de perfil (admin, supervisor, vendedor, etc.) funcionam perfeitamente.
- [ ] Fechamento por backdrop e ESC opera sem erros no console.
- [ ] Suíte Playwright `tests/e2e/navbar.spec.js` executada com sucesso.
- [ ] Zero regressão nos componentes e contratos legados.
