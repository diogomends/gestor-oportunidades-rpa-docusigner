# Feature Specification: Refactor PDF Contratos (Ajuste de Testemunhas, Senior Account e Coordenadas)

## Problem Statement

No formulário do Gestor de Oportunidades (Step 1 do fluxo de contratos), são capturados os dados das testemunhas através dos campos `test1-nome`, `test1-cpf`, `test2-nome` e `test2-cpf`. Na geração dos documentos PDF (especialmente o **Contrato de Permanência** e o **Termo de Contratação**), as coordenadas verticais ($y$) no arquivo de leiaute declarativo (`pdfCoordinatesLayout.js`) estavam desalinhadas em relação ao template original em PDF Base64, fazendo com que o retângulo de máscara (`cover`) não cobrisse o texto estático original do modelo (`Nome:` e `CPF:`), sobrepondo informações e gerando visualização incorreta.

Além disso, na Página 5 do **Contrato de Permanência**, o bloco estático de rodapé continha os dados legados da empresa *AMK PREMIUM CORP* e da consultora *Mariana Brito*. Era necessário cobrir (`cover`) e substituir esses dados estáticos pelos dados atualizados da empresa Senior Account (`H. B. SERVICOS DE INFORMATICA LTDA - ME`, CNPJ `41.342.670/0001-73`) e pelos dados dinâmicos do Consultor/Usuário cadastrador logado no sistema (`window.getUser()`).

Além disso, era necessário garantir a formatação padronizada:
1. Quando os campos de testemunhas forem informados no formulário, desenhar no PDF:
   - `Nome Testemunha Um: <Nome>`
   - `CPF: <CPF>`
   - `Nome Testemunha Dois: <Nome>`
   - `CPF: <CPF>`
2. Quando os campos de testemunhas estiverem em branco, desenhar no PDF:
   - `Nome Testemunha Um:`
   - `CPF:`
   - `Nome Testemunha Dois:`
   - `CPF:`
3. Na seção de Senior Account e Consultor:
   - `TBP / Senior Account: H. B. SERVICOS DE INFORMATICA LTDA - ME`
   - `CNPJ: 41.342.670/0001-73`
   - `Consultor: <Nome do Usuário Logado>`
   - `CPF: <CPF do Usuário Logado>`

## Goals

- [x] Corrigir as coordenadas de desenho ($x, y$) no `pdfCoordinatesLayout.js` para o **Contrato de Permanência** (Página 5) e **Termo de Contratação** (Página 2).
- [x] Garantir que a caixa de cobertura branca (`cover: 500` para nomes, `cover: 300` para CPFs, `cover: 520` para Senior Account/Consultor) oculte totalmente o texto estático do PDF base.
- [x] Implementar a formatação condicional das labels para `Nome Testemunha Um:`, `Nome Testemunha Dois:` e `CPF:` quando preenchidos ou vazios.
- [x] Implementar a cobertura e substituição dinâmica dos campos de Senior Account (`H. B. SERVICOS DE INFORMATICA LTDA - ME 41.342.670/0001-73`) e Consultor (`window.getUser()`) na Página 5 do Contrato de Permanência.
- [x] Validar a geração dos PDFs via script de teste automatizado `tests/test-pdf-generation.js`.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Alteração estrutural em outros modelos PDF (Proposta Comercial) | Proposta Comercial não possui bloco de assinaturas de testemunhas ou Senior Account estático na página 5. |
| Alterações de layout no HTML do formulário de contratos | O formulário já captura os IDs `test1-nome`, `test1-cpf`, `test2-nome`, `test2-cpf` e os dados do usuário cadastrador já existem na sessão. |

---

## User Stories

### P1: Ajuste de Coordenadas e Máscara de Testemunhas e Senior Account no PDF ⭐ MVP

**User Story**: Como gestor de vendas, quero gerar os contratos em PDF com os dados das testemunhas e do Consultor/Senior Account devidamente posicionados e mascarando o texto estático do PDF base, para que o documento fique limpo, atualizado com a empresa H. B. Serviços de Informática e os dados do usuário cadastrador, e sem sobreposição de caracteres.

**Why P1**: Essencial para a legitimidade jurídica, adequação cadastral e legibilidade visual dos contratos em PDF gerados pelo sistema.

**Acceptance Criteria**:
1. WHEN o PDF do **Contrato de Permanência** é gerado THEN os campos de testemunhas 1 e 2 SHALL ser renderizados nas coordenadas verticais corretas ($y = 601.26$, $y = 586.86$, $y = 523.70$, $y = 509.30$).
2. WHEN o PDF do **Termo de Contratação** é gerado THEN os campos de testemunhas 1 e 2 SHALL ser renderizados alinhados com o template base ($y = 442.5$, $y = 432.6$, $y = 323.7$, $y = 313.8$).
3. WHEN a propriedade `cover` é aplicada THEN a engine `pdfRenderer.js` SHALL desenhar um retângulo branco cobrindo integralmente os rótulos antigos do PDF base.
4. WHEN as testemunhas forem preenchidas no formulário THEN os rótulos SHALL ser formatados como `Nome Testemunha Um: <Nome>` e `Nome Testemunha Dois: <Nome>`.
5. WHEN os campos de testemunhas estiverem em branco THEN os rótulos SHALL ser mantidos como `Nome Testemunha Um:` e `Nome Testemunha Dois:`.
6. WHEN a seção de Senior Account na Página 5 do Contrato de Permanência é gerada THEN o sistema SHALL cobrir o texto antigo e renderizar `TBP / Senior Account: H. B. SERVICOS DE INFORMATICA LTDA - ME` em $y = 382.96$ e `CNPJ: 41.342.670/0001-73` em $y = 368.56$.
7. WHEN a seção de Consultor na Página 5 do Contrato de Permanência é gerada THEN o sistema SHALL cobrir o texto antigo e renderizar o nome e CPF do usuário cadastrador logado em $y = 322.28$ e $y = 307.88$.

---

## Requirement Traceability

| Requirement ID | Story | Component | Status |
| -------------- | ----- | --------- | ------ |
| PDF-TEST-01 | P1: Ajuste de Coordenadas e Máscara | `pdfCoordinatesLayout.getPermanenciaSpec` | ✅ Implemented |
| PDF-TEST-02 | P1: Ajuste de Coordenadas e Máscara | `pdfCoordinatesLayout.getTermoSpec` | ✅ Implemented |
| PDF-TEST-03 | P1: Formatação Condicional de Testemunhas | `pdfCoordinatesLayout.js` | ✅ Implemented |
| PDF-TEST-04 | P1: Cobertura de Texto no PDF | `pdfRenderer.writeTextOnPage` | ✅ Implemented |
| PDF-SENIOR-01 | P1: Cobertura e Atualização Senior Account | `pdfCoordinatesLayout.getPermanenciaSpec` | ✅ Implemented |
| PDF-CONSULTOR-02 | P1: Cobertura e Substituição Consultor | `pdfCoordinatesLayout.getPermanenciaSpec` | ✅ Implemented |

---

## Success Criteria

- [x] `tests/test-pdf-generation.js` executa com sucesso gerando `Contrato_Permanencia_TESTE.pdf` sem erros.
- [x] O stream do PDF gerado confirma a existência da cobertura em retângulo branco e o desenho correto de `Nome Testemunha Um:`, `Nome Testemunha Dois:`, `H. B. SERVICOS DE INFORMATICA LTDA - ME` e dados do Consultor.

