# Planto de Tarefas — Módulo Gestor de Tokens

## Tarefas do Backend

- [x] **TASK-001**: Criar constante de UFs e DDDs em `src/modules/gestor-token/config/ufsDdds.js`.
- [x] **TASK-002**: Criar model Mongoose `Token` em `src/modules/gestor-token/models/Token.js`.
- [x] **TASK-003**: Criar schemas Zod em `src/modules/gestor-token/schemas/gestorTokenSchemas.js`.
- [x] **TASK-004**: Implementar serviço `gestorTokenService.js` com CRUD e algoritmo `resolveToken()`.
- [x] **TASK-005**: Criar controller `gestorTokenController.js` com tratamento de exceções Zod e respostas HTTP.
- [x] **TASK-006**: Configurar rotas REST em `src/modules/gestor-token/routes.js` com middlewares `protect` e `authorizePermission("gestor-token:manage")`.
- [x] **TASK-007**: Atualizar `Contract.js` adicionando o subdocumento `tokenInfo` (`{ _id: false }`).
- [x] **TASK-008**: Atualizar `contractController.js` para resolver e gravar `tokenInfo` em `createContract` e `updateContract`.
- [x] **TASK-009**: Atualizar `gerador-pdf-html/controller.js` para enriquecer `seniorAccount` e `cnpjAccount` a partir de `contract.tokenInfo`.
- [x] **TASK-010**: Atualizar `systemConfigController.js` e `system-config/routes.js` adicionando suporte a `gestor-token`.
- [x] **TASK-011**: Atualizar `modulesPermissions.js` e `aclService.js` com a nova permissão `gestor-token:manage`.
- [x] **TASK-012**: Registrar o model `Token` em `server.js` e montar as rotas `/api/gestor-token` em `app.js`.
- [x] **TASK-013**: Criar suíte de testes unitários em `src/modules/gestor-token/services/gestorTokenService.test.js`.

## Tarefas do Frontend

- [x] **TASK-014**: Criar tela de gerenciamento em `public/modules/gestor-token/gestor-token.html`, `.css` e `.js`.
- [x] **TASK-015**: Criar sub-painel de configurações em `public/modules/config-sistema/gestor-token/gestor-token-config.html` e `.js`.
- [x] **TASK-016**: Adicionar o card "Gestor de Tokens" na grade de `public/modules/config-sistema/config-sistema.html`.
- [x] **TASK-017**: Atualizar `sidebar.html` e `sidebar.js` adicionando o item `navGestorToken`.
- [x] **TASK-018**: Adicionar a seção `#section-tbp-token` em `public/modules/contratos/contratos.html` e integrar gatilhos de auto-preenchimento em `contratos.js`.

## Validação e Verificação

- [x] **TASK-019**: Verificar integridade da compilação e ausência de regressões nos módulos legados.
- [x] **TASK-020**: Registrar decisão `AD-048` e finalizar resumo de handoff em `.specs/STATE.md`.

## Tarefas Corretivas

- [x] **TASK-021**: Ajustes corretivos de UX e dados do Gestor de Tokens.
  - [x] Corretivo 1: dropdown do `#modalUf` escuro — `select option` e `color-scheme: dark` em `public/modules/gestor-token/gestor-token.css` (REQ-005).
  - [x] Corretivo 2: fonte `1rem` nos containers de DDDs/Supervisores — regra `.checkbox-group-container label` no CSS e remoção do `font-size:0.85rem` inline em `gestor-token.js` (REQ-006).
  - [x] Corretivo 3: `name` → `nome` em `gestorTokenService.js` (7 populates), `gestorTokenController.js` (`select`/`sort`) e `gestor-token.js` (`sup.name`/`s.name`) (REQ-007).
  - **Critérios de verificação**: (1) ao abrir o `#modalUf`, o dropdown exibe fundo escuro; (2) labels de DDDs e Supervisores com fonte `1rem`; (3) tabela e checkboxes de supervisores exibem nomes reais (sem `undefined`); (4) nenhuma rota/endpoint do módulo alterada.

- [x] **TASK-022**: Substituição de `modalUf` por Multiselect Grade 3x9 (`#containerUfs` e `ufs: [String]`).
  - [x] Substituição do `<select id="modalUf">` por `<div class="checkbox-group-grid-ufs" id="containerUfs">` (3 linhas x 9 UFs, sem scroll) em `public/modules/gestor-token/gestor-token.html` e `.css`.
  - [x] Reorganização do layout do modal posicionando `#modalLogin` (Login de Acesso) ao lado de `#modalCnpjTbp` (CNPJ TBP).
  - [x] Atualização de `public/modules/gestor-token/gestor-token.js` para renderizar `containerUfs` e pré-selecionar os DDDs das UFs marcadas.
  - [x] Atualização do model Mongoose `Token.js`, schema Zod `gestorTokenSchemas.js` e serviço `gestorTokenService.js` para suportar `ufs: [String]`.
