# Componente Logout — Tasks Breakdown

## Phase 1: Component Specification & Module Implementation

### Task 1.1: Criar o Módulo ES6 do Componente Logout
- **Goal**: Criar `public/modules/logout/logout-button.js` exportando a classe `LogoutButton` autônoma com suporte a gerenciamento de estado (loading/disabled) e invocação de `clearSession`.
- **Files**: `public/modules/logout/logout-button.js`
- **Verification**: Módulo exporta `LogoutButton`, importa `clearSession` de `session.js`, desabilita botão no clique e encerra a sessão.
- **Commit**: `feat(logout): create standalone LogoutButton ES6 module`

---

## Phase 2: Refatoração da Sidebar (Alinhado ao PR #95)

### Task 2.1: Integrar LogoutButton na Sidebar
- **Goal**: Atualizar `public/modules/sidebar/setup-events.js` substituindo o listener inline por `LogoutButton.init(logoutBtn)`.
- **Files**: `public/modules/sidebar/setup-events.js`
- **Verification**: O botão de logout na sidebar delega a ação para `LogoutButton.init`, mantendo o comportamento de logout corrigido no PR #95.
- **Commit**: `refactor(sidebar): integrate LogoutButton component in sidebar setupEvents`

---

## Phase 3: Testes Unitários Nativos (node --test)

### Task 3.1: Criar Suíte de Testes na Pasta `tests/`
- **Goal**: Criar `tests/logout.test.js` para testar unitariamente `clearSession` e o comportamento do componente `LogoutButton`.
- **Files**: `tests/logout.test.js`
- **Verification**: Executar `node --test tests/logout.test.js` e obter 100% de aprovação.
- **Commit**: `test(logout): add unit tests for clearSession and LogoutButton in tests/logout.test.js`

---

## Phase 4: Automação com Makefile

### Task 4.1: Adicionar Alvo `test-logout` no Makefile
- **Goal**: Adicionar comando `test-logout` e atualizar a ajuda no `Makefile`.
- **Files**: `Makefile`
- **Verification**: Executar `make test-logout` no terminal/powershell e verificar se a suíte de testes em `tests/` é executada.
- **Commit**: `chore(makefile): add test-logout target to run unit tests`
