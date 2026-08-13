# Plano de Tarefas: Módulo de Controle de Acessos (ACL & RBAC UI)

**Feature:** `modulo-controle-acesso-acl-rbac`  
**Data:** 2026-07-21  

---

## Fases de Implementação

### Fase 1: Conexão Mongoose `crm_acl`, Modelo e Configurações
- [x] **Task 1**: Atualizar `src/config/database.js` incluindo o helper `getAclDb()` apontando para `useDb('crm_acl')`.
  - *Verification*: Teste de conexão verificando retorno da instância do database `crm_acl`.
- [x] **Task 2**: Criar `src/modules/acl/config/modulesPermissions.js` e `src/modules/acl/models/RolePermission.js`.
  - *Verification*: Teste unitário confirmando salvamento e consulta na coleção `role_permissions`.
- [x] **Task 3**: Criar `src/modules/acl/services/aclService.js` com rotina de seed inicial com as permissões vigentes (Admin = tudo, Suporte = anexos view, etc) e rotinas de leitura/atualização.
  - *Verification*: Testes unitários em `src/modules/acl/tests/aclService.test.js`.

### Fase 2: Controllers, Rotas da API e Middlewares Backend
- [x] **Task 4**: Criar `src/modules/acl/controllers/aclController.js`, `routes/aclRoutes.js` e registrar rotas no `app.js` sob `/api/acl`.
  - *Verification*: Testes de integração em `src/modules/acl/tests/aclController.test.js` para `GET /api/acl/matrix` e `PUT /api/acl/roles/:role/permissions`.
- [x] **Task 5**: Criar `src/modules/acl/middlewares/authorizePermission.js` validando requisições contra `role_permissions` e gravando `AuditLog` em HTTP 403.
  - *Verification*: Executar testes unitários e de integração do middleware.

### Fase 3: Interface Frontend e Integração com a Sidebar
- [x] **Task 6**: Criar a página HTML `public/modules/acl/controle-acessos.html` e estilização seguindo o padrão Vanilla CSS / Bootstrap do CRM.
  - *Verification*: Abertura direta do arquivo no navegador confirmando estrutura da tabela e modal de confirmação.
- [x] **Task 7**: Criar a lógica JS `public/modules/acl/controle-acessos.js` para buscar a matriz, renderizar checkboxes (admin desabilitado e marcado), gerenciar clique/modal de confirmação e disparo do `PUT`.
  - *Verification*: Teste manual do fluxo de marcação/desmarcação e acionamento da API ao confirmar no modal.
- [x] **Task 8**: Atualizar `public/modules/sidebar/sidebar.html` e `public/js/core/ui/sidebar.js` incluindo o link `#navAclItem` ("Controle de Acessos"), condicionado a `cargo === 'admin'`.
  - *Verification*: Verificar visibilidade do menu acessando como `admin` vs `vendedor`.

### Fase 4: Implantação da Permissão 'Criar Contrato' (`contracts:create`) e Tooltips Informativos
- [x] **Task 9**: Atualizar `src/modules/acl/config/modulesPermissions.js` e `src/modules/acl/services/aclService.js` adicionando a permissão `contracts:create` ("Criar Contrato") com descrição e atribuindo por padrão aos cargos `coordenador`, `supervisor` e `vendedor`.
  - *Verification*: Executar testes unitários do aclService confirmando presença da permissão padrão nos cargos.
- [x] **Task 10**: Atualizar `src/modules/contract/routes.js` aplicando a verificação da permissão `contracts:create` nos endpoints `POST /api/contracts` e `POST /api/contracts/generate-pdf-html`.
  - *Verification*: Teste das rotas confirmando resposta HTTP 403 para cargos sem a permissão `contracts:create`.
- [x] **Task 11**: Atualizar `public/modules/acl/controle-acessos.js` e `public/modules/acl/controle-acessos.html` para incluir `contracts:create` na lista de módulos padrão e adicionar tooltips Bootstrap em hover (`data-bs-toggle="tooltip" title="..."`) com a descrição de cada item na matriz.
  - *Verification*: Inspeção visual e teste de hover nos rótulos de ações na tela `/modules/acl/controle-acessos.html`.
- [x] **Task 12**: Atualizar/criar testes automatizados para a nova permissão `contracts:create` em `src/modules/acl/tests/aclService.test.js` e `src/modules/acl/tests/aclController.test.js`.
  - *Verification*: Execução de testes do módulo ACL.
- [x] **Task 13**: Manter `#navAclItem` ("Controle de Acessos") visível na sidebar apenas para o cargo `admin` em `public/js/core/ui/sidebar.js` (`visibilityRules.admin`) e usar ícone Phosphor `ph-shield-check` em `public/modules/sidebar/sidebar.html`.
  - *Verification*: Inspeção visual da sidebar confirmando a exibição do item `#navAclItem` como `admin` e a ocultação para os demais cargos.

### Fase 5: Unificação de Permissões Contratos (API/Robot), Ícones nas Ações e Distanciamento Mínimo na UI
- [x] **Task 14**: Ajustar descrições e ícones no módulo 'Contratos' (`contracts:docusign`, `contracts:docusign_resend`, etc.) em `src/modules/acl/config/modulesPermissions.js` e `controle-acessos.js`, garantindo que as permissões de Contratos autorizem o fluxo de execução tanto via API quanto via Robot (conforme a chave Modo de Operação configurada em `robot-docusigner.html` / `SystemConfig`).
  - *Verification*: `GET /api/acl/matrix` retorna o módulo "Contratos" com rótulos e descrições claras para API e Robot.
- [x] **Task 15**: Atualizar `public/modules/acl/controle-acessos.js` incluindo a propriedade `icon` em cada ação de `DEFAULT_MODULES`.
  - *Verification*: Matriz padrão do frontend carrega os ícones nativos do Bootstrap Icons para cada ação.
- [x] **Task 16**: Atualizar a renderização da tabela (`renderTable`) em `controle-acessos.js` e a estilização CSS em `controle-acessos.html` para:
  1. Renderizar os ícones visuais ao lado do rótulo de cada ação na 2ª coluna da tabela.
  2. Implementar distanciamento mínimo destacado entre os módulos (linhas separadoras mais espaçadas com fundo escuro sutil `rgba(15, 23, 42, 0.5)` e padding vertical).
  - *Verification*: Inspeção visual em `public/modules/acl/controle-acessos.html` confirmando alinhamento, exibição dos ícones e espaçamento nítido entre módulos.





