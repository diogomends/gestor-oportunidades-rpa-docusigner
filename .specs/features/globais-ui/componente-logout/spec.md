# Componente Logout — Specification

## Problem Statement

No PR #95 (`fix/acessos-usuarios`), a funcionalidade de logout da sidebar foi corrigida para importar `clearSession` diretamente de `public/js/core/session.js`, resolvendo o problema de acessos e dependência de `window.App` não inicializado. 

Contudo, a lógica do botão e a associação do evento de clique continuam inline dentro do módulo da Sidebar (`public/modules/sidebar/setup-events.js`). Não existe um componente ES6 autônomo e reutilizável que encapsule a UI, estados visuais (ex: desabilitar no clique, spinner de carregamento) e comportamento do botão de logout para ser reaproveitado em outras áreas do sistema (ex: Header superior, modal de perfil). Além disso, não há uma suíte de testes unitários dedicada acionável no `Makefile`.

## Goals

- Criar um componente ES6 autônomo, modular e reutilizável para o botão de logout em `public/modules/logout/`.
- Encapsular a UI, tratamento de eventos e estados visuais (loading/disabled) do botão.
- Permitir que o componente seja instanciado declarativamente em qualquer contêiner da aplicação através de API simples (ex: `LogoutButton.init(selector, options)`).
- Refatorar a Sidebar (`public/modules/sidebar/setup-events.js`) para substituir o listener inline pela instanciação do novo `LogoutButton`.
- Criar a suíte de testes unitários/de integração na pasta `tests/` (`tests/logout.test.js`) utilizando o test runner nativo do Node.js (`node --test`).
- Adicionar o alvo `test-logout` no `Makefile` para permitir execução direta via linha de comando (`make test-logout`).

## Out of Scope

- Invalidação de token no backend ou comunicação via API de revogação.
- Alteração do fluxo de redirecionamento final (`/index.html`).
- Modificação na tela de login (`/index.html` ou `public/js/pages/login.js`).

---

## User Stories

### P1: Componente Autônomo e Reutilizável de Logout

**User Story:** Como desenvolvedor/designer do sistema, quero um componente ES6 de logout autônomo para poder renderizá-lo e gerenciá-lo em qualquer parte da aplicação (Sidebar, Header, Perfil) sem duplicar código de eventos ou estados visuais.

**Acceptance Criteria:**

1. **LOGOUT-FE-01**: WHEN o arquivo `public/modules/logout/logout-button.js` for importado, THEN ele SHALL exportar a classe/módulo `LogoutButton` responsável pela inicialização e gestão do botão de logout.
2. **LOGOUT-FE-02**: WHEN `LogoutButton.init(elementOrSelector, options)` for chamado, THEN ele SHALL vincular o manipulador de eventos ao elemento informado e gerenciar seus estados.
3. **LOGOUT-FE-03**: WHEN o botão de logout for clicado, THEN ele SHALL executar `e.preventDefault()`, aplicar feedback visual de estado (desabilitado/carregamento) e chamar `clearSession()` de `public/js/core/session.js`.
4. **LOGOUT-FE-04**: WHEN múltiplos cliques rápidos ocorrerem, THEN o botão SHALL ser desabilitado imediatamente no primeiro clique para evitar chamadas duplicadas.

### P1: Integração com a Sidebar Refatorada (Pós-PR #95)

**User Story:** Como usuário do CRM, quero que o botão de logout na Sidebar utilize o novo componente padronizado, mantendo a correção de perfis introduzida no PR #95.

**Acceptance Criteria:**

5. **LOGOUT-FE-05**: WHEN a Sidebar for inicializada em `public/modules/sidebar/setup-events.js`, THEN ela SHALL instanciar `LogoutButton.init(logoutBtn)` em vez de manter o evento inline.
6. **LOGOUT-FE-06**: WHEN a Sidebar for renderizada, THEN a classe/marcação do botão no rodapé da Sidebar SHALL manter compatibilidade total de layout com o design system.

### P1: Testes Nativos e Makefile Integration

**User Story:** Como desenvolvedor, quero rodar testes automatizados da funcionalidade de logout com o comando `make test-logout` apontando para a pasta `tests/`.

**Acceptance Criteria:**

7. **LOGOUT-TEST-01**: WHEN o comando `make test-logout` for executado, THEN ele SHALL rodar `node --test tests/logout.test.js`.
8. **LOGOUT-TEST-02**: WHEN `tests/logout.test.js` for executado, THEN ele SHALL testar nativamente a função `clearSession` do `session.js`, a limpeza do `localStorage`/`sessionStorage` e o comportamento do componente `LogoutButton`.

---

## Test Plan & Edge Cases

| ID | Cenário | Comportamento Esperado |
|---|---|---|
| 1 | Clique no LogoutButton com sessão ativa | Limpa `user` e `token` do localStorage, redireciona para `/index.html` |
| 2 | Elemento contêiner/botão não encontrado no DOM | `LogoutButton.init()` retorna `null` graciosamente sem exceções não tratadas |
| 3 | Cliques múltiplos rápidos | Botão é desabilitado no primeiro clique impedindo acionamentos duplicados |
| 4 | Execução em qualquer perfil de usuário | Funciona de forma consistente sem depender de globals como `window.App` |
