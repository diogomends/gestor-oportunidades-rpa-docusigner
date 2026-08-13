# Reorganização de Agrupamentos da Sidebar — Tasks

## Phase 1: Estrutura HTML da Sidebar (`public/modules/sidebar/sidebar.html`)

- [x] **TASK-01: Reestruturar o HTML da sidebar nas 5 categorias expansíveis**
  - **Goal**: Modificar `sidebar.html` substituindo a lista desestruturada pelas 5 categorias (Indicadores & Relatórios, Vendas & Operação, Gestão Comercial, Administração de Pessoas, Configurações Técnicas).
  - **Verification**: Inspecionar o HTML de `sidebar.html` e garantir que todos os `nav-item` estão dentro de seus respectivos `nav-submenu` com `data-toggle="submenu"`.
  - **Impact Protector**: Preservar todos os IDs existentes (`navDashboardItem`, `navReportItem`, `navPipeline`, `navContracts`, `navTeam`, `adminLink`, `navAclItem`, `navGoals`, `navCampaigns`, `navTabelaPrecos`, `navImportProfiles`, `navSystemConfig`, `navGestorToken`) e o footer de perfil de usuário com `#sidebarLogoutBtn`.

## Phase 2: Lógica de Role Visibility e Agrupamento no JS (`public/js/core/ui/sidebar.js`)

- [x] **TASK-02: Atualizar regras de visibilidade (visibilityRules) e auto-ocultamento de grupos**
  - **Goal**: Atualizar o mapa de cargos em `sidebar.js` para considerar os novos IDs de grupos e subitens, garantindo que um grupo só fique visível se contiver pelo menos um subitem permitido.
  - **Verification**: Testar a execução da função com perfis `vendedor`, `supervisor`, `admin` para verificar se os grupos vazios são ocultados.

## Phase 3: Navegação, Destaque Ativo e Auto-Expansão (`public/modules/sidebar/index.js`)

- [x] **TASK-03: Ajustar destaque do link ativo e abertura exclusiva do grupo da URL atual**
  - **Goal**: Atualizar a lógica de `highlightActiveLink` em `public/modules/sidebar/index.js` para que feche todos os submenus e abra exclusivamente o grupo contendo a URL ativa.
  - **Verification**: Ao navegar por diferentes URLs (ex: `/sales-kanban.html`, `/admin-users.html`), confirmar que o submenu pai abre automaticamente e o link fica com a classe `.active`.

## Phase 4: Validação E2E e Manual

- [x] **TASK-04: Validar inicialização em runtime e integridade visual**
  - **Goal**: Validar carregamento do menu sem erros de console ou regressões nos botões e submenus.
  - **Verification**: Executar verificação visual/navegação e checar logs limpos.
