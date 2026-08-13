# Gestão de Usuários e Inativação
> Administração centralizada de perfis e controle de acesso.

## Visão Geral
Gerenciamento completo de colaboradores com inativação de usuários (soft delete), preservando dados históricos enquanto remove o acesso do sistema. Suporte a inativação por motivo (desligamento, férias, suspensão) com bloqueio de acesso e reativação.

## Backend

### Model
- **User** (`src/models/User.js`):
  - `ativo`: Boolean, default `true`
  - `motivo_inativacao`: String, enum `["desligamento", "ferias", "suspenso", null]`, default `null`
  - `cpf`: String, required, unique, trim
  - `nome_vtme`: String, optional (default `null`), trim

### Endpoints
- `GET /api/users`: Lista todos os usuários.
- `POST /api/users`: Cria novo usuário.
- `PUT /api/users/:id`: Edita usuário. Propaga `nome_vtme` para `itens[].vendedor` em oportunidades existentes.
- `DELETE /api/users/:id`: Inativa usuário (via `ativo: false`) e exige `transferToUserId` via query param e `motivo` via body.
- `PATCH /api/users/:id/reactivate`: Reativa usuário (via `ativo: true`, `motivo_inativacao: null`).

### Fluxo de Inativação
1. Verifica se o usuário a ser deletado não é o próprio administrador logado.
2. Recebe `transferToUserId` (destino das oportunidades) e `motivo` (desligamento/ferias/suspenso).
3. Migra todas as `Opportunities` do usuário antigo para o novo (incluindo hierarquia).
4. Seta `user.ativo = false` e `user.motivo_inativacao = motivo`.
5. Retorna mensagem com nome do destinatário.

### Fluxo de Reativação
1. Verifica se o usuário existe e está inativo.
2. Seta `user.ativo = true` e `user.motivo_inativacao = null`.
3. Retorna sucesso.

### Bloqueio de Acesso
- **Login** (`src/controllers/auth/loginController.js`): Se `user.ativo === false`, retorna HTTP 403 com mensagem motivada ("Usuário desligado", "Usuário em férias", "Usuário suspenso").
- **Auth Middleware** (`src/middlewares/authMiddleware.js`): Se `req.user.ativo === false`, retorna HTTP 403 com "Acesso negado: usuário inativo." (tanto para Bearer token quanto query token).

### Propagação de nome_vtme
Ao alterar `nome_vtme` de um usuário, a mudança é propagada para `itens[].vendedor` em oportunidades existentes:
- **Login** retorna `nome_vtme` na sessão.
- **Frontend** (`public/js/core/auth.js`) salva `nome_vtme` no `setSession`.
- **Create Opportunity** (`src/modules/opportunities/controllers/create-opportunity.js`) auto-preenche `itens[].vendedor` com `req.user.nome_vtme` quando vazio.
- **Update User** (`src/controllers/userController.js`) propaga via `Opportunity.updateMany` com `arrayFilters` para atualizar `itens.$[elem].vendedor`.
- **Preservados**: `observacoes_gerais[].autor` e `AccessLog.userName` (registram o momento da ação).

## Frontend

### Arquivos
- `public/admin-users.html`: Tabela e Modal de Edição.
- `public/js/admin-users.js`: Scripts de interação.
- `transferModal`: Modal para inativação com radio buttons de motivo e seleção de destinatário.

### UX
- **Tabela**: Usuários inativos aparecem com opacidade reduzida e indicativo do motivo ("— Desligado", "— Férias", "— Suspenso"). Exibe colunas de CPF e Nome VTME.
- **Modal de Usuário**: Formulário organizado em 3 linhas:
  1. Linha 1: Nome Completo + CPF (`maxlength="14"`, largura ajustada)
  2. Linha 2: Nome no VTME + Email
  3. Linha 3: Senha + Cargo
- **Inativação**: Ícone de lixeira abre modal com:
  1. Radio buttons para motivo (Desligamento/Férias/Suspensão)
  2. Select de vendedores disponíveis em ordem alfabética
  3. Botão "Confirmar Inativação"
- **Reativação**: Usuários inativos exibem botão de seta circular ( verde) para reativar.
- Admin deve confirmar transferência antes de concluir inativação.

## Manutenção
- Lógica de transferência em `src/controllers/userController.js`.
- Ao adicionar campos obrigatórios em Oportunidades, atualizar a migração no `deleteUser`.
- Para novos motivos de inativação, adicionar ao enum do model e ao mapa `motivos` no frontend.

## Validação

| ID | Critério | Status |
|----|----------|--------|
| `USER-INAT-01` | Campo `motivo_inativacao` no model User com enum válido | PASS |
| `USER-INAT-02` | Login bloqueado para usuários inativos com mensagem motivada | PASS |
| `USER-INAT-03` | Auth middleware bloqueia acesso de usuários inativos | PASS |
| `USER-INAT-04` | DELETE salva motivo de inativação | PASS |
| `USER-INAT-05` | Endpoint de reativação (PATCH /reactivate) funciona | PASS |
| `USER-INAT-06` | Frontend exibe radio buttons de motivo no modal | PASS |
| `USER-INAT-07` | Tabela mostra inadores com indicador visual | PASS |
| `USER-INAT-08` | Botão de reativação para usuários inativos | PASS |
| `USER-FIELD-01` | Campo `cpf` no model User (obrigatório, único) e validação | PASS |
| `USER-FIELD-02` | Campo `nome_vtme` no model User (opcional) e UI modal/tabela | PASS |
| `USER-VTME-01` | Propagação de `nome_vtme` para `itens[].vendedor` ao editar usuário | PASS |

## Testes
- `tests/auth-middleware-orphan-user.test.js`: 8 testes (6 existentes + 2 novos para bloqueio de inativos).
