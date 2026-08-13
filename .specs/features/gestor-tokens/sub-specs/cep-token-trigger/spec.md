# Sub-spec: Preenchimento Automático de Token via CEP e Feedback de Erro em Contratos — Specification

## Problem Statement

No formulário do módulo de contratos (`public/modules/contratos/`), a seleção manual do estado (`#cli-estado`) dispara a busca e auto-preenchimento das credenciais do token TBP via `resolveTokenForForm`. 

Porém, quando o endereço e a UF são preenchidos automaticamente via busca de CEP (`public/modules/contratos/services/cepService.js`), a opção correspondente da UF no elemento `<select id="cli-estado">` é marcada apenas com `opt.selected = true`. Como a atribuição direta via propriedade DOM não dispara nativamente o evento `change`, a função `resolveTokenForForm` não é acionada, deixando as credenciais do token vazias.

Além disso, na função `resolveTokenForForm` em `public/modules/contratos/contratos.js`, caso a API `/api/gestor-token/resolve` retorne erro (ex.: 404, 500) ou responda com sucesso mas sem nenhum token configurado para a UF/DDD selecionados (`data.token` nulo), o sistema falha em silêncio sem notificar o operador na interface.

## Goals

- [ ] Disparar programaticamente o evento `change` com propagação (`{ bubbles: true }`) no elemento `#cli-estado` após atribuir a UF selecionada via ViaCEP (`cepService.js`).
- [ ] Exibir notificação Toast de aviso (`window.ui.showToast`) em `contratos.js` quando a busca de token por UF/DDD não retornar um token ativo ou quando a API responder com status de erro.
- [ ] Preservar intactos a resolução server-side do contrato (`contractController.js`), a geração de PDF (`gerador-pdf-html`), a rota `/api/gestor-token/resolve`, regras de ACL e os seletores DOM legados.

## Out of Scope

| Componente / Funcionalidade | Motivo |
| --- | --- |
| Resolução server-side do contrato (`contractController.js`) | O comportamento do backend na emissão do contrato já é funcional e preservado. |
| Geração de PDF (`gerador-pdf-html/controller.js`) | Não faz parte da lógica de captura e preenchimento de formulário na UI. |
| Rota `/api/gestor-token/resolve` | O contrato de API backend permanece inalterado. |
| Testes automatizados novos | Lógica de UI trivial e pontual de evento/toast frontend (conforme escopo acordado). |

---

## Assumptions & Open Questions

| Premissa / Decisão | Escolha Padrão | Racional | Confirmado? |
| --- | --- | --- | --- |
| Disparar evento `change` com `{ bubbles: true }` | `new Event('change', { bubbles: true })` | Garante que listeners anexados no DOM capturem a alteração de valor | Sim |
| Mensagem de toast para token ausente | `'Nenhum token ativo configurado para esta UF/DDD.'` | Comunicação clara de aviso para o operador | Sim |
| Mensagem de toast para falha na API | `data?.message \|\| 'Não foi possível resolver o token para esta UF/DDD.'` | Reutiliza a mensagem de erro retornada pela API com fallback amigável | Sim |

---

## User Stories

### P1: Disparo Automático do Resolver de Token após Busca por CEP ⭐ MVP

**User Story**: Como operador do CRM, quero que ao digitar um CEP válido no formulário de contratos, a UF seja preenchida e o token TBP correspondente seja automaticamente resolvido e preenchido nos campos do formulário.

**Acceptance Criteria**:

1. WHEN o CEP for pesquisado com sucesso no ViaCEP e a UF for auto-selecionada em `#cli-estado` THEN o evento `change` SHALL ser disparado no elemento `estadoSelect` com `bubbles: true`.
2. WHEN o evento `change` for capturado pelo listener de `#cli-estado` THEN a função `resolveTokenForForm` SHALL ser executada automaticamente.

---

### P2: Notificação Amigável ao Usuário em Caso de Token Não Encontrado ou Erro na API ⭐ MVP

**User Story**: Como operador do CRM, quero ser avisado na tela por um toast de erro quando a UF/DDD informados não possuírem um token TBP ativo configurado ou quando a API de resolução falhar.

**Acceptance Criteria**:

1. WHEN a rota `/api/gestor-token/resolve` retornar HTTP status OK (`res.ok`), mas o payload `data.token` estiver ausente/nulo THEN a UI SHALL exibir um Toast de erro com a mensagem `"Nenhum token ativo configurado para esta UF/DDD."`.
2. WHEN a rota `/api/gestor-token/resolve` retornar HTTP status de erro (não 2xx) THEN a UI SHALL exibir um Toast de erro com a mensagem `data?.message` ou o fallback `"Não foi possível resolver o token para esta UF/DDD."`.

---

## Edge Cases

- WHEN o elemento `#cli-estado` não for encontrado no DOM durante a execução de `searchCEP` THEN o código não deve lançar exceção e deve continuar graciosamente.
- WHEN a resposta da API de resolução de token falhar com erro de parse JSON THEN o `.catch(() => null)` deve tratar a exceção e usar a mensagem de fallback.

---

## Requirement Traceability

| Requirement ID | User Story | Arquivo Alvo |
| --- | --- | --- |
| TOKEN-CEP-01 | P1 | `public/modules/contratos/services/cepService.js` |
| TOKEN-CEP-02 | P2 | `public/modules/contratos/contratos.js` |

---

## Success Criteria

- [ ] Digitar CEP preenche a UF e engatilha o preenchimento automático das credenciais do token.
- [ ] Selecionar uma UF/DDD sem token ativo exibe o toast de erro explicativo na tela.
- [ ] Nenhuma regressão em rotas, gerador de PDF ou envio de contratos.
