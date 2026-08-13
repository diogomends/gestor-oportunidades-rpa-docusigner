# Dashboard de Contratos DocuSign — Tasks

Lista de tarefas atômicas para a implementação da feature.

## Phase 1: Backend & Security

### Task 1: API Endpoints para Arquivos de Contratos
- **Description**: Criar rotas e métodos no controller `contractController.js` para download (`/download`), visualização (`/view`) e exclusão de anexos de contrato por ID de contrato, tipo de arquivo e índice.
- **API Paths**:
  - `GET /api/contracts/:id/files/:fileType/:fileIndex/view`
  - `GET /api/contracts/:id/files/:fileType/:fileIndex/download`
  - `DELETE /api/contracts/:id/files/:fileType/:fileIndex`
- **Validation**:
  - Validar se o contrato e o arquivo no índice existem.
  - Para visualização (`/view`), apenas cargos `admin` e `suporte` são permitidos. Vendedor/Supervisor/Coordenador recebem HTTP 403.
  - Para download (`/download`), apenas cargo `admin` é permitido. Suporte/Vendedor/etc recebem HTTP 403.
  - Para deleção (`DELETE`), apenas cargo `admin` é permitido. Remove do disco físico via `storageService` e atualiza o MongoDB via `$pull` ou atualização de array.
- **Verification**: Executar testes unitários e requisições HTTP simuladas.
- **Commit Message**: `feat(contracts): add secure file download view and delete endpoints`

### Task 2: Testes unitários para Endpoints de Arquivos
- **Description**: Escrever testes unitários em `tests/contract-files-acl.test.js` ou integrar em `src/modules/contract/services/contractService.test.js` para testar os comportamentos de ACL e deleção física de arquivos.
- **Verification**: Rodar `npm test` e verificar se os testes unitários passam.
- **Commit Message**: `test(contracts): add unit tests for files ACL and deletion`

## Phase 2: Sidebar Integration

### Task 3: Atualização da Sidebar e Menu
- **Description**: Modificar `public/modules/sidebar/sidebar.html` para incluir o item `#navContractsDashboardItem` apontando para `/modules/contratos/dashboard-contratos-docusigner.html`. Atualizar `public/js/core/ui/sidebar.js` para gerenciar a exibição do novo link baseado na role do usuário (disponível para todos os cargos relevantes).
- **Verification**: Recarregar a sidebar e garantir que o item de menu aparece em "Dashboard -> Contratos DocuSign".
- **Commit Message**: `feat(sidebar): integrate contracts dashboard link to sidebar menu`

## Phase 3: Frontend Interface

### Task 4: Criar Página do Dashboard de Contratos
- **Description**: Criar a interface visual da tabela de contratos em `public/modules/contratos/dashboard-contratos-docusigner.html` com o arquivo JavaScript associado `public/modules/contratos/dashboard-contratos-docusigner.js` e estilo em CSS.
- **Features**:
  - Carregar todos os contratos da API.
  - Exibir tabela com Razão Social, CNPJ, Status, Criado Por, Data de Criação, Negociações.
  - Exibir seção de arquivos anexos por contrato (gerados, assinado, cliente) com botões dinâmicos (Ver, Baixar, Deletar) baseados na role do usuário logado.
  - Vendedor: apenas lê dados, botões de ação desabilitados/ocultos.
  - Suporte: botão "Visualizar" habilitado, "Baixar" e "Deletar" desabilitados/ocultos.
  - Admin: todos os botões habilitados (com modal de confirmação ao clicar em "Deletar").
- **Verification**: Visualização da página no navegador, alterando sessões com diferentes cargos e confirmando comportamento.
- **Commit Message**: `feat(frontend): implement contracts dashboard table and ACL visual rules`

### Task 5: Refatorar Card do Dashboard para Novo Layout com Header Branco e Tags

- **Description**: Reescrever `renderContracts()` e `renderAttachmentItem()` em `dashboard-contratos-docusigner.js` e atualizar `dashboard-contratos-docusigner.css` para implementar o layout refatorado conforme CONTR-DASH-13 e CONTR-DASH-14:
  - Card com container branco `.card-header` com nome do cliente em caixa alta/negrito na linha superior e 3 action buttons (Vincular Oportunidade, Copiar Link Docs, Reenviar)
  - Badges de metadados (CNPJ, Telefone, Status, ID hash) na linha inferior `.card-header-bottom`
  - Descrição do serviço `.card-plan` como texto independente entre o header e os documentos
  - Container `.docs-container` com inner shadow e tags `.doc-tag.present` (verde) / `.doc-tag.pending` (vermelho)
- **CSS classes novas**: `.card-header`, `.card-header-top`, `.card-header-bottom`, `.header-action-btn`, `.badge-tag`, `.card-plan`, `.card-documents`, `.docs-title`, `.docs-container`, `.doc-tag`, `.doc-tag.present`, `.doc-tag.pending`
- **Alteração no JS**: Reescrever template HTML em `renderContracts()` para usar a nova estrutura; atualizar `renderAttachmentItem()` para gerar tags verdes/vermelhas com ações controladas por ACL
- **Verification**: Visualizar Step 6 do stepper em `contratos.html`, confirmar que cards renderizam com header branco, badges, plano descritivo e tags de documento com inner shadow. Testar com diferentes cargos.
- **Commit Message**: `refactor(frontend): redesign dashboard contract cards with white header container and metadata badges`
