# Especificação de Feature: Manual do Usuário

## 1. Visão Geral
O **Manual do Usuário** é um recurso centralizado de documentação do CRM Funil de Vendas, construído como uma página HTML standalone moderna e interativa (`public/manual-usuario.html`). Ele fornece um guia completo de todas as páginas e funcionalidades do sistema, adaptado dinamicamente com base nas permissões e funções (`role`/`cargo`) do usuário logado.

---

## 2. Requisitos & Critérios de Aceite

### `REQ-MANUAL-001` - Interface HTML Standalone de Documentação
- **Descrição**: Página HTML com design responsivo, elegante e moderno, integrada ao layout global do CRM (Sidebar e Header).
- **Critérios de Aceite**:
  - `AC-001.1`: A página deve estar acessível na URL `/manual-usuario.html`.
  - `AC-001.2`: O layout deve conter um painel de navegação lateral (menu de tópicos por módulo/página), uma área principal de leitura com tipografia legível, cards de funcionalidades, exemplos práticos e indicação visual de atalhos.
  - `AC-001.3`: A interface deve possuir estética moderna (variáveis CSS globais, suporte a modo escuro/claro nativo do sistema, Phosphor Icons).

### `REQ-MANUAL-002` - Módulo de Dados do Manual (Data Store Estático)
- **Descrição**: Módulo JS/JSON contendo todo o acervo estruturado de documentação do sistema CRM.
- **Critérios de Aceite**:
  - `AC-002.1`: O arquivo `public/modules/manual-usuario/manual-data.js` deve ser exportado em formato ESM com a lista detalhada de todos os módulos/páginas (Indicadores, Vendas, Gestão Comercial, Pessoas, Configurações Técnicas).
  - `AC-002.2`: Cada item de funcionalidade deve conter: ID único, título, descrição detalhada, passos de uso (passo a passo), telas/páginas associadas, ícone e lista de cargos permitidos (`rolesAllowed`).

### `REQ-MANUAL-003` - Filtragem por Função do Usuário (ACL / Roles)
- **Descrição**: Personalização da experiência do manual com base no cargo (`vendedor`, `supervisor`, `coordenador`, `suporte`, `admin`) do usuário logado.
- **Critérios de Aceite**:
  - `AC-003.1`: O manual deve detectar o cargo do usuário ativo via `getUser()`.
  - `AC-003.2`: Por padrão, o manual filtra e exibe apenas as funcionalidades acessíveis ao cargo do usuário logado, exibindo um badge indicativo do perfil em cada card de funcionalidade.
  - `AC-003.3`: Deve existir um seletor no topo ("Filtrar por Função") permitindo ao usuário (especialmente `admin`/`suporte`) visualizar a documentação sob a perspectiva de outros perfis ou visualizar o manual completo.

### `REQ-MANUAL-004` - Pesquisa em Tempo Real e Navegação
- **Descrição**: Sistema de busca rápida por palavra-chave e navegação fluida por categorias.
- **Critérios de Aceite**:
  - `AC-004.1`: Digitar no campo de busca deve filtrar instantaneamente o conteúdo visível por título, descrição, tags ou passos de uso.
  - `AC-004.2`: Selecionar uma categoria no menu lateral do manual deve rolar suavemente (*smooth scroll*) até a seção correspondente ou filtrar a visualização por categoria.
  - `AC-004.3`: Caso nenhuma funcionalidade corresponda ao termo buscado, deve ser exibida uma mensagem amigável de "Nenhum resultado encontrado".

### `REQ-MANUAL-005` - Integração na Navegação do CRM
- **Descrição**: Pontos de acesso ao manual integrados à Sidebar e ao Header do sistema.
- **Critérios de Aceite**:
  - `AC-005.1`: Adicionar um item "Manual do Usuário" na Sidebar do sistema (visível para todos os perfis).
  - `AC-005.2`: Adicionar um ícone/botão de ajuda (ícone `ph-question` com a label "Ajuda / Manual") no topo/header da Sidebar ou Navbar global.
  - `AC-005.3`: Garantir que os atalhos de navegação funcionem corretamente em todas as páginas existentes sem quebrar os seletores DOM legados.

### `REQ-MANUAL-006` - Documentação Específica: Perfis de Importação de Leads
- **Descrição**: Documentação estruturada em card duplo para o módulo `import-profiles` (`/import-profiles.html`).
- **Critérios de Aceite**:
  - `AC-006.1`: `perfis-importacao-gestao` documenta o modal em 3 passos de criação de perfil (upload de modelo .xlsx, mapeamento de colunas com auto-mapper e vinculação à equipe SMB/ULTRA).
  - `AC-006.2`: `perfis-importacao-execucao` documenta que a importação serve exclusivamente para atualizar informações de negócios já cadastrados no sistema através da busca por CPF ou CNPJ (apenas números). Se um cliente da planilha não for encontrado, a linha é sinalizada como erro no relatório final, enquanto as demais continuam sendo processadas sem criar novos negócios automaticamente.
  - `AC-006.3`: Apresentar caixas de dicas práticas destacando regras de formatação (planilhas .xlsx até 50MB, busca por CPF/CNPJ sem pontuação) e o funcionamento do relatório parcial de erros.

