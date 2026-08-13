# Autenticação e Segurança
> Gestão de sessões e acesso controlado por papéis (RBAC).

## Visão Geral
Camada de segurança baseada em tokens JWT. Acesso a cada rota validado pelo cargo (`admin`, `supervisor`, `coordenador`, `vendedor`, `suporte`).

## Backend

### Endpoints
- `POST /api/auth/login`: Autenticação inicial.
- `GET /api/auth/me`: Validação de token e retorno de perfil.

### Fluxo
1. Recebe e-mail/senha.
2. Busca usuário no MongoDB filtrando por e-mail.
3. Compara hashes de senha via `bcryptjs`.
4. Gera token JWT contendo ID e Cargo com expiração de 24h.
5. Retorna token e dados básicos de perfil.

## Frontend

### Arquivos
- `public/index.html` (Login)
- `public/js/app.js` (Gerenciador de requisições)

### UX
- Token armazenado no `localStorage`.
- Servidor retorna 401 → sessão limpa, redirecionamento ao login.
- Itens de menu na sidebar exibidos/ocultados dinamicamente via `App.updateSidebar()`.

## Manutenção
Ao adicionar novo cargo, atualizar `visibilityRules` em `public/js/app.js`.
