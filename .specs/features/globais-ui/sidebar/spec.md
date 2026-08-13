# Sidebar — Specification

## Problem Statement

O CRM Funil de Vendas não possuía um componente de navegação centralizado. Cada página tinha seus próprios links e a estrutura de navegação era duplicada e inconsistente. Não havia controle de visibilidade por papel (admin vê tudo, vendedor vê só pipeline), nem experiência colapsável em desktop, nem adaptação mobile. A sidebar resolve isso como um módulo único, carregado dinamicamente em 10 páginas, com role-based visibility e estado persistente.

## Goals

- Componente de navegação único, carregado via fetch + injeção de HTML
- Role-based visibility: 5 papéis (vendedor, supervisor, coordenador, admin, suporte) com itens diferentes
- Estado collapsed/expanded per- Submenu expansível (Dashboard → Funil de Vendas + Relatório Pós SMB + Contratos DocuSign)
- Highlight automático do link ativo baseado na URL
- Modo mobile: sidebar oculta por padrão, versão fixa estreita quando collapsed
- Logout no footer da sidebar

## Out of Scope

| Funcionalidade | Motivo |
| -------------- | ------ |
| Header superior ou navbar top | É outro componente |
| Breadcrumbs | Não faz parte da sidebar |
| Notificações ou badges | Sem requisito |
| Drag-and-drop reorder de itens | Sem requisito |
| Sidebar com icones SVG customizados | Usa Phosphor Icons (CDN) |

---

## User Stories

### P1: Navegação Principal

**User Story:** Como usuário do CRM, quero navegar entre as páginas principais através de uma sidebar consistente para acessar Dashboard, Pipeline, Contratos e demais funcionalidades.

**Acceptance Criteria:**

1. SIDEBAR-FE-01: WHEN qualquer página com sidebar carrega THEN `#sidebar-container` SHALL conter o HTML de `sidebar.html` injetado via fetch
2. SIDEBAR-FE-02: WHEN o fetch falha THEN `#sidebar-container` SHALL exibir `<div class="error-sidebar">Falha ao carregar menu</div>`
3. SIDEBAR-FE-03: WHEN a página carrega THEN o link correspondente à URL atual SHALL receber classe `.active`
4. SIDEBAR-FE-04: WHEN um submenu contém o link ativo THEN o submenu SHALL estar expandido (classe `.open`)

### P1: Role-Based Visibility

**User Story:** Como admin/suporte, quero ver todos os itens de navegação. Como vendedor, quero ver apenas itens pertinentes ao meu papel.

**Acceptance Criteria:**

5. SIDEBAR-BE-01: WHEN `cargo === "vendedor"` THEN itens visíveis SHALL ser: navGroupIndicadores (navDashboardItem), navGroupVendas (navPipeline, navContracts)
6. SIDEBAR-BE-02: WHEN `cargo === "supervisor"` THEN itens visíveis SHALL ser: navGroupIndicadores (navDashboardItem, navReportItem), navGroupVendas (navPipeline, navContracts), navGroupAdminPessoas (navTeam)
7. SIDEBAR-BE-03: WHEN `cargo === "coordenador"` THEN itens visíveis SHALL ser: navGroupIndicadores (navDashboardItem, navReportItem), navGroupVendas (navPipeline, navContracts), navGroupAdminPessoas (navTeam)
8. SIDEBAR-BE-04: WHEN `cargo === "admin"` THEN todos os nav-ids gerenciados SHALL estar visíveis, incluindo `navAclItem` ("Controle de Acessos", visível apenas para admin) — todos os 5 grupos expostos
9. SIDEBAR-BE-05: WHEN `cargo === "suporte"` THEN itens visíveis SHALL ser: navGroupIndicadores, navGroupVendas, navGroupAdminPessoas (navTeam), navGroupGestaoComercial (navGoals, navCampaigns), navGroupConfigTecnicas (navImportProfiles, navTabelaPrecos, navGestorToken) — mesmo escopo do admin exceto navAclItem e navSystemConfig
10. SIDEBAR-FE-05: WHEN `updateSidebar()` executa THEN elementos não permitidos SHALL ter `display: none`

### P1: Collapsed Mode (Hamburger)

**User Story:** Como usuário em desktop, quero colapsar a sidebar para ganhar espaço horizontal no Kanban e outras telas.

**Acceptance Criteria:**

11. SIDEBAR-FE-06: WHEN botão `.menu-toggle` é clicado THEN `.dashboard-layout` SHALL alternar classe `.collapsed`
12. SIDEBAR-FE-07: WHEN sidebar está collapsed THEN textos e ícone do logo SHALL estar ocultos, apenas ícones dos nav-links visíveis
13. SIDEBAR-FE-08: WHEN sidebar está collapsed THEN submenu SHALL aparecer como floating dropdown à direita (posição absoluta, `left: 100%`)
14. SIDEBAR-FE-09: WHEN sidebar alterna estado THEN `localStorage.setItem("sidebarCollapsed")` SHALL persistir o novo estado
15. SIDEBAR-FE-10: WHEN página carrega THEN `restoreSidebarState()` SHALL ler `localStorage` e restaurar a classe `.collapsed`

### P1: Submenu Expansível

**User Story:** Como usuário, quero expandir/colapsar submenus (ex: Dashboard) para organizar a navegação.

**Acceptance Criteria:**

16. SIDEBAR-FE-11: WHEN link com `data-toggle="submenu"` é clicado THEN submenu alvo SHALL alternar classe `.open`
17. SIDEBAR-FE-12: WHEN submenu está `.open` THEN `max-height` SHALL ser `500px` (animado via CSS transition)
18. SIDEBAR-FE-13: WHEN submenu está `.open` THEN ícone `.submenu-arrow` SHALL rotacionar 180°

### P1: Perfil do Usuário e Logout

**User Story:** Como usuário, quero ver meu nome e cargo no footer da sidebar e fazer logout com um clique.

**Acceptance Criteria:**

19. SIDEBAR-FE-14: WHEN sidebar carrega THEN `#userName`, `#userRole`, `#userInitial` SHALL ser preenchidos com dados do `App.getUser()`
20. SIDEBAR-FE-15: WHEN botão `#sidebarLogoutBtn` é clicado THEN `clearSession()` SHALL ser chamado

### P2: Responsivo Mobile

**User Story:** Como usuário mobile, quero que a sidebar não ocupe espaço precioso, aparecendo apenas como uma faixa fixa quando colapsada.

**Acceptance Criteria:**

21. SIDEBAR-CSS-01: WHEN viewport ≤ 768px THEN `.sidebar` SHALL ter `display: none` por padrão
22. SIDEBAR-CSS-02: WHEN viewport ≤ 768px AND `.collapsed` THEN `.sidebar` SHALL ser `position: fixed` com `width: 32px`

---

## Edge Cases

| # | Caso | Comportamento Esperado |
| - | ---- | ---------------------- |
| 1 | `#sidebar-container` não existe no DOM | `loadSidebar()` retorna sem erro (early return) |
| 2 | Fetch de `sidebar.html` falha (rede 404/500) | `sidebar.html` não carrega, div com erro é exibida |
| 3 | `App.getUser()` retorna `null` | `updateSidebar()` retorna sem alterar nada (`if (!user) return`) |
| 4 | `user.cargo` não está em visibilityRules | Fallback seguro: `vendedor` scope (dashboard + pipeline) |
| 5 | Múltiplos links com mesmo `href` no `highlightActiveLink` | `forEach` marca todos que correspondem |
| 6 | URL sem path (só `/`) | Fallback para `dashboard.html` |
| 7 | Logout sem `window.App.clearSession` | Botão não tem efeito (guard `if (window.App && window.App.clearSession)`) — **corrigido em AD-027**: `clearSession` importado diretamente |
| 8 | localStorage corrompido ou indisponível | `localStorage.getItem("sidebarCollapsed")` retorna `null`, estado padrão expandido |
| 9 | Navegação a partir de subpastas (como `/modules/contratos/`) | Links de navegação e scripts devem usar caminhos absolutos (`/`) para evitar erros de SyntaxError no console por falha de resolução |

---

## Requirement Traceability

| ID | História | AC | Implementado Em | Status |
| -- | -------- | -- | --------------- | ------ |
| SIDEBAR-FE-01 | Navegação | Injeção do HTML por fetch | `load-sidebar.js:10-13` | Verified |
| SIDEBAR-FE-02 | Navegação | Fallback de erro no fetch | `load-sidebar.js:15-17` | Verified |
| SIDEBAR-FE-03 | Navegação | Highlight do link ativo | `index.js:33-51` | Verified |
| SIDEBAR-FE-04 | Navegação | Submenu expandido quando ativo | `index.js:44-49` | Verified |
| SIDEBAR-BE-01 | Role Visibility | Vendedor: dashboard + contratos + pipeline | `core/ui/sidebar.js:11-12` | Verified |
| SIDEBAR-BE-02 | Role Visibility | Supervisor: + relatório + contratos + equipe | `core/ui/sidebar.js:13-18` | Verified |
| SIDEBAR-BE-03 | Role Visibility | Coordenador: mesmo que supervisor | `core/ui/sidebar.js:19-25` | Verified |
| SIDEBAR-BE-04 | Role Visibility | Admin: todos os itens, incluindo `navAclItem` | `core/ui/sidebar.js:29-44` | Verified |
| SIDEBAR-BE-05 | Role Visibility | Suporte: todos | `core/ui/sidebar.js:38-49` | Verified |
| SIDEBAR-FE-05 | Role Visibility | `display: none` para não permitidos | `core/ui/sidebar.js:71-83` | Verified |
| SIDEBAR-FE-06 | Collapsed | Toggle classe `.collapsed` | `toggle-sidebar.js:4-11` | Verified |
| SIDEBAR-FE-07 | Collapsed | Ícones apenas visíveis | `sidebar.css:152-156` | Verified |
| SIDEBAR-FE-08 | Collapsed | Floating submenu | `sidebar.css:202-219` | Verified |
| SIDEBAR-FE-09 | Collapsed | Persistência localStorage | `toggle-sidebar.js:11` | Verified |
| SIDEBAR-FE-10 | Collapsed | Restore na inicialização | `toggle-sidebar.js:14-23` | Verified |
| SIDEBAR-FE-11 | Submenu | Toggle submenu via data attributes | `toggle-submenu.js:6-15` | Verified |
| SIDEBAR-FE-12 | Submenu | Animação max-height | `sidebar.css:79-85` | Verified |
| SIDEBAR-FE-13 | Submenu | Rotação da seta | `sidebar.css:117-125` | Verified |
| SIDEBAR-FE-14 | Perfil | Preenchimento nome/cargo/inicial | `core/ui/user-info.js:6-16` | Verified |
| SIDEBAR-FE-15 | Perfil | Logout via clearSession | `setup-events.js:31-37` | Verified |
| SIDEBAR-CSS-01 | Mobile | Sidebar oculta ≤768px | `sidebar.css:248-255` | Verified |
| SIDEBAR-CSS-02 | Mobile | Versão fixa estreita | `sidebar.css:257-270` | Verified |

**Cobertura:** 22 requisitos, 22 mapeados, 0 sem mapeamento ✔️

---

## Success Criteria

- [ ] Sidebar carrega em todas as 10 páginas que consomem o módulo
- [ ] Cada papel vê apenas os itens de navegação pertinentes
- [ ] Toggle collapsed funciona e persiste entre sessões
- [ ] Submenu expande/colapsa com animação suave
- [ ] Link ativo é destacado automaticamente
- [ ] Nome e cargo do usuário aparecem no footer
- [ ] Logout funciona via botão na sidebar
- [ ] Mobile: sidebar não quebra layout, versão fixa funcional
- [ ] Nenhum `ReferenceError` ou exceção não tratada no fluxo de init
