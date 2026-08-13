# Especificação: Módulo de Controle de Acessos (ACL & RBAC UI)

**Feature:** `modulo-controle-acesso-acl-rbac`  
**Data:** 2026-07-21  
**Status:** APPROVED / READY FOR IMPLEMENTATION  

---

## 1. Visão Geral

O sistema contará com um **Módulo de Controle de Acessos (ACL/RBAC)** desacoplado, com banco de dados próprio para reutilização futura por outros sistemas, além de uma interface web no frontend (`public/modules/acl/controle-acessos.html`) para gerenciamento dinamico de permissões por cargo.

### Diretrizes de Negócio e Design
1. **Banco de Dados Próprio**: Coleção `role_permissions` em banco isolado (`crm_acl`), prevendo desacoplamento e integração com futuros microsserviços.
2. **Tabela Matriz por Cargo**:
   - 1ª coluna: Funcionalidades/Ações agrupadas por Módulo (ex: Contratos, Oportunidades, Equipes, Relatórios).
   - DEMAIS colunas: Cargos do sistema (`admin`, `suporte`, `coordenador`, `supervisor`, `vendedor`).
3. **Regras por Cargo**:
   - `admin`: Todos os checkboxes fixos em `true` (desabilitados), garantindo acesso total incondicional.
   - Demais cargos: Pré-carregados com as regras atuais do sistema (ex: Vendedor acessa suas oportunidades/contratos, Suporte visualiza anexos) e demais novas funcionalidades desmarcadas por default (`false`).
4. **Modal de Confirmação**: Qualquer alteração em um checkbox abre um modal Bootstrap de confirmação ("Deseja [conceder/revogar] a permissão X para o cargo Y?"). Após a confirmação, o salvamento na API é imediato (`PUT /api/acl/roles/:role/permissions`).
5. **Reflexo Imediato**: Atualização em tempo real das permissões de usuários logados a cada requisição backend via cache dinâmico.
6. **Sidebar Integration**: Link "Controle de Acessos" com ícone de escudo (`ph-shield-check`), visível apenas para usuários com cargo `admin`.

---

## 2. Requisitos Funcionais

### P1: Banco de Dados e API do Servidor
* **[ACL-001] Banco de Dados `crm_acl`**: Criação da conexão e modelo Mongoose para a coleção `role_permissions` no database `crm_acl`.
  * Schema: `{ role: String (unique), permissions: [String], updatedAt: Date }`
* **[ACL-002] Endpoints de Gerenciamento ACL**:
  * `GET /api/acl/matrix`: Retorna a matriz completa de permissões ativas por cargo e a árvore de módulos/funcionalidades. (Restrito a `admin`).
  * `PUT /api/acl/roles/:role/permissions`: Atualiza o array de permissões de um determinado cargo. (Restrito a `admin`).
  * `GET /api/me/permissions`: Retorna permissões do usuário logado baseado no seu cargo. (Autenticado).
* **[ACL-003] Middleware `authorizePermission` Dinâmico**: Valida se a permissão necessária para o recurso/ação está presente na coleção `role_permissions` para o cargo do usuário logado.

### P2: Interface de Usuário no Frontend
* **[ACL-004] Tela `controle-acessos.html` & `controle-acessos.js`**:
  * Localização: `public/modules/acl/controle-acessos.html`.
  * Tabela responsiva com cabeçalhos de Módulo, Ação e Colunas de Cargo.
  * Checkboxes com estado refletindo a matriz remota.
  * Coluna Admin sempre marcada e desabilitada.
* **[ACL-005] Modal de Confirmação Bootstrap**:
  * Exibido ao clicar em qualquer checkbox ativo/inativo.
  * Exibe o nome amigável do cargo e da ação.
  * Ao clicar em "Confirmar", faz a requisição `PUT` e exibe notificação Toast/Alert de sucesso. Ao "Cancelar", reverte o estado do checkbox no DOM sem chamar a API.
* **[ACL-006] Item da Sidebar (#navAclItem)**:
  * O item `#navAclItem` ("Controle de Acessos") fica visível na sidebar apenas para o cargo `admin`, oculto (`display: none`) para os demais cargos. Não-admin que acessar via URL ou API recebe HTTP 403.
* **[ACL-008] Permissão de Envio DocuSign (`contracts:docusign`)**:
  * Controla visibilidade do botão `#btn-send-docusign` no wizard de contratos e a rota `POST /api/docusign/send/:contractId`.
* **[ACL-009] Permissão de Reenvio DocuSign (`contracts:docusign_resend`)**:
  * Controla visibilidade do botão `.action-btn.btn-resend-docusign` no dashboard de contratos e a rota `POST /api/docusign/resend/:contractId`.
* **[ACL-010] Permissão de Exclusão de Contrato e Limpeza de Dados (`contracts:delete`)**:
  * Controla a visibilidade do botão `.btn-delete-card` (ícone `ph-trash` no topo do card `.card-top`) no Step 6 do fluxo de contratos (`contratos.html`).
  * Ao clicar, exibe o modal de segurança `#deleteCardConfirmModal` com aviso dos dados afetados e exige que o administrador digite exatamente o CNPJ do cliente para habilitar o botão "Excluir Definitivamente".
  * Dispara a rota `DELETE /api/contracts/:id` protegida por `authorizePermission("contracts:delete")`.
  * Purga do servidor: Remove o documento `Contract`, o documento `DocusignEnvelope` e todos os arquivos físicos associados (`documents`, `signedDocPath`, `clientDocs`), mantendo a `Opportunity` intacta.
  * Atualiza o frontend removendo o `.contract-card` do DOM com efeito fade/scale e recarrega silenciosamente a lista de contratos.
* **[ACL-011] Permissão de Criar Contrato (`contracts:create`) e Tooltips Informativos**:
  * **Chave & Descrição Backend**: Inclusão da ação `{ key: 'contracts:create', label: 'Criar Contrato', description: 'Permite cadastrar e emitir novos contratos no sistema' }` no módulo 'Contratos' em `src/modules/acl/config/modulesPermissions.js`.
  * **Permissão Padrão**: Atribuição inicial aos cargos `coordenador`, `supervisor` e `vendedor` (além de `admin`) em `src/modules/acl/services/aclService.js`.
  * **Proteção de API**: Proteção dos endpoints `POST /api/contracts` e `POST /api/contracts/generate-pdf-html` exigindo a permissão `contracts:create`.
  * **Tooltips na Interface (Frontend)**: Renderização de tooltips Bootstrap nativos no hover (`data-bs-toggle="tooltip"` / `title="..."`) para cada item da matriz de acessos em `controle-acessos.html` / `controle-acessos.js`.


## 3. Critérios de Aceite (GIVEN / WHEN / THEN)

### [AC-001.1] Exibição da Matriz por Admin
* **GIVEN** que um usuário com cargo `admin` acessa `/modules/acl/controle-acessos.html`,
* **WHEN** a página carrega,
* **THEN** o sistema busca a matriz via `GET /api/acl/matrix` e renderiza a tabela com os checkboxes marcados/desmarcados de acordo com a base de dados.

### [AC-002.1] Alteração com Confirmação em Modal
* **GIVEN** o administrador na tela de controle de acessos,
* **WHEN** clicar para marcar/desmarcar uma permissão do cargo `vendedor`,
* **THEN** o modal Bootstrap de confirmação é exibido. Ao confirmar, o sistema dispara `PUT /api/acl/roles/vendedor/permissions` e atualiza a matriz no banco.

### [AC-003.1] Bloqueio de Acesso para Não-Admins
* **GIVEN** um usuário com cargo `vendedor` ou `suporte`,
* **WHEN** tentar acessar `/modules/acl/controle-acessos.html` ou chamar a API `/api/acl/matrix`,
* **THEN** o menu não é exibido na sidebar e a API responde HTTP 403.

### [AC-010.1] Exclusão de Card e Purga de Dados por Admin
* **GIVEN** um usuário logado com a permissão `contracts:delete` (`admin`),
* **WHEN** clica no botão de lixeira no topo do card e digita o CNPJ correto no modal `#deleteCardConfirmModal`,
* **THEN** o sistema envia a requisição `DELETE /api/contracts/:id`, deleta o contrato, o envelope DocuSign e arquivos anexos em disco, preservando a oportunidade e removendo o card da tela.

---

## 4. Matriz de Cobertura de Testes

| Requisito | Descrição | Tipo de Teste | Status |
| :--- | :--- | :--- | :--- |
| `ACL-001` | Conexão ao DB `crm_acl` e Modelo `RolePermission` | Unitário | PASS ✅ |
| `ACL-002` | Endpoints `GET /api/acl/matrix` e `PUT /api/acl/roles/:role/permissions` | Integração | PASS ✅ |
| `ACL-003` | Middleware `authorizePermission` com fallback DB | Unitário & Integração | PASS ✅ |
| `ACL-004` | Renderização da Tabela no Frontend | E2E / Manual | PASS ✅ |
| `ACL-005` | Modal de Confirmação e chamada PUT | E2E / Manual | PASS ✅ |
| `ACL-006` | Visibilidade da Sidebar por cargo `admin` | Integração / UI | PASS ✅ |
| `ACL-007` | Seed inicial cria documentos só para cargos sem registro | Unitário / Integração | PASS ✅ |
| `ACL-010` | Exclusão de card e dados no servidor via `contracts:delete` com modal CNPJ | Integração & UI | PASS ✅ |
| `ACL-011` | Permissão `contracts:create`, Tooltips em hover e Fallback de Merge de Módulos | Unitário & UI | PASS ✅ |
