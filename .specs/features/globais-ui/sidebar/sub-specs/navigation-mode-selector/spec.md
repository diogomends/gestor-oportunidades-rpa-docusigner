# Seletor de Modo de Navegação (Navbar vs Sidebar) & Ajuste de Hambúrguer — Specification

## Problem Statement

Atualmente, o CRM possui o componente Topnav com Drawer de navegação, porém o botão hambúrguer precisa ficar posicionado rigorosamente à esquerda. Além disso, quando o menu é aberto, o comportamento de transição exibia a sidebar vertical legada contendo um segundo hambúrguer repetido. Por fim, a equipe de administração precisa de um controle centralizado na tela `exibir-ocultar.html` para selecionar dinamicamente se a aplicação deve operar em **Modo Navbar** (cabeçalho superior fixo com gaveta) ou em **Modo Sidebar** (menu lateral fixo tradicional).

## Goals

- Posicionar o botão hambúrguer no canto esquerdo da barra Topnav.
- Ajustar a renderização da gaveta (Drawer) para que, ao clicar no hambúrguer, o menu abra de forma limpa, sem exibir o segundo hambúrguer duplicado no interior do Drawer.
- Incluir uma nova opção de configuração em `public/modules/config-sistema/exibir-ocultar/exibir-ocultar.html` permitindo a seleção entre "Navbar (Barra Superior + Gaveta)" e "Sidebar (Menu Lateral Fixo)".
- Estender a API `/api/system-config/ui-visibility` no backend para salvar e retornar o parâmetro `navigation_mode` ("navbar" ou "sidebar").
- Garantir que o modo escolhido seja aplicado globalmente em todas as telas com suporte a cache local (`localStorage`) para evitar intermitência visual no carregamento da página.

## Out of Scope

| Funcionalidade | Motivo |
| -------------- | ------ |
| Alteração na lógica de login ou papéis de usuário | Escopo estrito de layout e configuração de UI |
| Modificação no layout das 10 páginas HTML principais | O modo de navegação é alternado via classes CSS globais no `#sidebar-container` / `.dashboard-layout` |
| Criação de novos endpoints de API | Extensão do endpoint existente `GET/PUT /api/system-config/ui-visibility` |

---

## User Stories & Acceptance Criteria

### P1: Ajuste de Posicionamento e Interação do Hambúrguer

**User Story:** Como usuário, quero ver o botão hambúrguer alinhado à esquerda na barra Topnav e, ao clicar nele, visualizar o menu gaveta de forma limpa e sem elementos duplicados.

**Acceptance Criteria:**
1. NAV-MODE-01: WHEN a barra Topnav é renderizada THEN o botão `.menu-toggle` SHALL ser posicionado à esquerda do logotipo e título `CRM Funil`.
2. NAV-MODE-02: WHEN a gaveta (Drawer) estiver aberta THEN o botão hambúrguer no interior da sidebar antiga SHALL ficar oculto (`display: none`), evitando botões duplicados.

### P1: Configuração no Módulo Exibir / Ocultar

**User Story:** Como administrador, quero acessar a página de configuração `exibir-ocultar.html` e selecionar o modo de navegação do sistema (Navbar ou Sidebar).

**Acceptance Criteria:**
3. NAV-MODE-03: WHEN a página `exibir-ocultar.html` carrega THEN um controle de seleção (radio/toggle) para "Modo de Navegação Principal" SHALL ser exibido com as opções "Navbar" e "Sidebar".
4. NAV-MODE-04: WHEN o administrador altera o modo de navegação THEN o formulário SHALL salvar automaticamente a preferência enviando `navigation_mode` para o endpoint `PUT /api/system-config/ui-visibility`.

### P1: Persistência Backend & Aplicação Global de Layout

**User Story:** Como usuário do sistema, quero que o CRM respeite o modo de navegação definido pelo administrador em todas as telas da aplicação.

**Acceptance Criteria:**
5. NAV-MODE-05: WHEN o backend recebe `PUT /api/system-config/ui-visibility` THEN o campo `navigation_mode` SHALL ser validado com Zod (`z.enum(["navbar", "sidebar"])`) e persistido no modelo `SystemConfig`.
6. NAV-MODE-06: WHEN qualquer página da aplicação é carregada e `navigation_mode === "sidebar"` THEN a Topnav SHALL ser oculta e o layout `.dashboard-layout` SHALL ser configurado no modo fixo tradicional com coluna lateral de 250px.
7. NAV-MODE-07: WHEN qualquer página é carregada e `navigation_mode === "navbar"` THEN a Topnav SHALL ser exibida e a Sidebar SHALL operar exclusivamente como gaveta overlay.

---

## Edge Cases

| # | Caso | Comportamento Esperado |
| - | ---- | ---------------------- |
| 1 | Sem conexão com a API ao carregar o modo de navegação | Usar fallback do `localStorage` ou padrão `"navbar"` |
| 2 | Administrador altera para "Sidebar" e depois para "Navbar" | A classe CSS do container alterna dinamicamente sem recarregar a página |
| 3 | Usuário não autenticado ou sem permissão de admin acessa `exibir-ocultar.html` | Redirecionar para `dashboard.html` conforme regra legada de ACL |

---

## Requirement Traceability

| ID | História | AC | Módulo / Arquivo Afetado | Status |
| -- | -------- | -- | ----------------------- | ------ |
| NAV-MODE-01 | Hambúrguer à esquerda | Hambúrguer na esquerda do Topnav | `public/modules/sidebar/sidebar.html`, `sidebar.css` | Done |
| NAV-MODE-02 | Drawer limpo | Oculta hambúrguer duplicado | `public/modules/sidebar/sidebar.css` | Done |
| NAV-MODE-03 | Painel de Configuração | UI de seleção em `exibir-ocultar.html` | `public/modules/config-sistema/exibir-ocultar/exibir-ocultar.html` | Done |
| NAV-MODE-04 | Auto-Save de Configuração | Event listener & salvamento | `public/modules/config-sistema/exibir-ocultar/exibir-ocultar.js` | Done |
| NAV-MODE-05 | Backend Persistence | Validação Zod & Mongoose | `src/modules/config-sistema/controllers/systemConfigController.js` | Done |
| NAV-MODE-06 | Aplicador de Layout Sidebar | Modo lateral 250px | `public/modules/sidebar/index.js`, `sidebar.css` | Done |
| NAV-MODE-07 | Aplicador de Layout Navbar | Modo topbar com gaveta | `public/modules/sidebar/index.js`, `sidebar.css` | Done |

---

## Success Criteria

- [x] Hambúrguer posicionado à esquerda na barra Topnav.
- [x] Drawer abre de maneira limpa e sem hambúrgueres duplicados.
- [x] Painel `exibir-ocultar.html` exibe seletor funcional entre Navbar e Sidebar.
- [x] Configuração `navigation_mode` persiste no banco MongoDB via `/api/system-config/ui-visibility`.
- [x] Layout alterna corretamente em tempo real e se mantém consistente em todas as telas.
