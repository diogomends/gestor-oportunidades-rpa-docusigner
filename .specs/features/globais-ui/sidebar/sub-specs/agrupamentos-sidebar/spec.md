# Reorganização de Agrupamentos da Sidebar — Specification

## Problem Statement

A sidebar do CRM apresentava uma lista mista de itens soltos de primeiro nível e submenus simples, tornando a navegação poluída e desorganizada à medida que novos módulos (como Acessos, Tokens, Contratos, Campanhas e Configurações) foram adicionados.

## Goal

Reestruturar a navegação da sidebar em 5 grupos expansíveis (dropdowns/accordions) bem definidos, com visibilidade baseada em papeis (ACL), destacando o link ativo e mantendo expandido apenas o grupo correspondente à página atual ao carregar.

## Estrutura de Agrupamentos Aprovada

1. **📊 Indicadores & Relatórios** (`#navGroupIndicadores`)
   - Dashboard (Funil de Vendas) (`/dashboard.html`) (`#navDashboardItem`)
   - Relatório Pós SMB (`/relatorio_pos_smb.html`) (`#navReportItem`)

2. **💼 Vendas & Operação** (`#navGroupVendas`)
   - Pipeline (Kanban) (`/sales-kanban.html`) (`#navPipeline`)
   - Contratos (`/modules/contratos/contratos.html`) (`#navContracts`)

3. **🎯 Gestão Comercial** (`#navGroupGestaoComercial`)
   - Metas (`/admin-goals.html`) (`#navGoals`)
   - Campanhas (`/admin-campaigns.html`) (`#navCampaigns`)

4. **👥 Administração de Pessoas** (`#navGroupAdminPessoas`)
   - Usuários (`/admin-users.html`) (`#adminLink`)
   - Minha Equipe (`/team.html`) (`#navTeam`)
   - Controle de Acessos (ACL) (`/modules/acl/controle-acessos.html`) (`#navAclItem`)

5. **⚙️ Configurações Técnicas** (`#navGroupConfigTecnicas`)
   - Tabela de Preços (`/modules/produtos-precos/produtos-precos.html`) (`#navTabelaPrecos`)
   - Perfis de Importação (`/import-profiles.html`) (`#navImportProfiles`)
   - Configuração do Sistema (`/modules/config-sistema/config-sistema.html`) (`#navSystemConfig`)
   - Gestor de Tokens (`/modules/gestor-token/gestor-token.html`) (`#navGestorToken`)

## User Stories & Acceptance Criteria

### P1: Estrutura HTML e Agrupamento Visual
- **AGRUP-FE-01**: WHEN a sidebar é renderizada THEN a nav-menu SHALL conter exatamente 5 categorias expansíveis com ícones Phosphor e setas indicadoras.
- **AGRUP-FE-02**: WHEN o usuário clica no cabeçalho de uma categoria THEN a visibilidade do seu submenu SHALL ser alternada (toggle `.open`).

### P1: Estado Inicial e Auto-Expansion
- **AGRUP-FE-03**: WHEN a página carrega THEN apenas o grupo que possui o link ativo (correspondente à URL) SHALL estar com a classe `.open`. Os demais grupos SHALL vir recolhidos.
- **AGRUP-FE-04**: WHEN o link ativo é marcado THEN ele e seus elementos pai relevantes SHALL receber o estado visual de ativo (`.active`).

### P1: Role-Based Visibility (ACL)
- **AGRUP-BE-01**: WHEN `updateSidebar()` roda THEN grupos inteiros cujos subitens não são acessíveis pelo perfil do usuário SHALL ter `display: none`.
- **AGRUP-BE-02**: WHEN um grupo possui ao menos 1 subitem permitido para o perfil atual THEN o cabeçalho do grupo SHALL permanecer visível e apenas os subitens não permitidos terão `display: none`.

---

## Requirement Traceability

| ID | Descrição | Status |
| -- | --------- | ------ |
| AGRUP-FE-01 | Reorganização das 5 categorias na estrutura HTML | Implemented |
| AGRUP-FE-02 | Comportamento de toggle accordion dos submenus | Implemented |
| AGRUP-FE-03 | Auto-expansão exclusiva do grupo da página atual | Implemented |
| AGRUP-FE-04 | Destaque do link ativo no submenu correto | Implemented |
| AGRUP-BE-01 | Ocultamento de grupos completamente vazios por perfil | Implemented |
| AGRUP-BE-02 | Manutenção de visibilidade condicional de subitens por cargo | Implemented |
