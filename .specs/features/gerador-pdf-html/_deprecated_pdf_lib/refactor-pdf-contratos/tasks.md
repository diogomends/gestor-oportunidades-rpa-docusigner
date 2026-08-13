# Tasks: Refactor PDF Contratos

**Spec**: `.specs/features/refactor-pdf-contratos/spec.md`  

---

- [x] **Ajustar Coordenadas das Testemunhas no PDF**
  - [x] Atualizar $y$ de testemunhas no `getPermanenciaSpec` (Página 5) para $601.26$, $586.86$, $523.70$, $509.30$.
  - [x] Aplicar formatação condicional `Nome Testemunha Um:` e `Nome Testemunha Dois:` quando vazias ou preenchidas.

- [x] **Implementar Cobertura e Substituição do Senior Account**
  - [x] Adicionar instrução com `cover: 520` em $y = 382.96$ para `TBP / Senior Account: H. B. SERVICOS DE INFORMATICA LTDA - ME`.
  - [x] Adicionar instrução com `cover: 350` em $y = 368.56$ para `CNPJ: 41.342.670/0001-73`.

- [x] **Implementar Cobertura e Substituição do Consultor**
  - [x] Extrair dados do usuário logado via `window.getUser()`.
  - [x] Adicionar instrução com `cover: 520` em $y = 322.28$ para `Consultor: ${consultorNome}`.
  - [x] Adicionar instrução com `cover: 350` em $y = 307.88$ para `CPF: ${consultorCpf}`.

- [x] **Validação e Testes Automatizados**
  - [x] Executar `node tests/test-pdf-generation.js` e validar a geração sem erros.
  - [x] Inspecionar os streams descompactados do PDF gerado confirmando as máscaras e novos textos.
