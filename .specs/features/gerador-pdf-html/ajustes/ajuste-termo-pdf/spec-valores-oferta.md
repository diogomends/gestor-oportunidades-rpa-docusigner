# Spec: Inclusão de Valores de Ofertas e Itens de Combo no Termo PDF (`spec-valores-oferta`)

## Problem Statement

No Termo de Contratação gerado em PDF (`src/modules/gerador-pdf-html/submodules/termo`), os detalhes das ofertas contratadas (nome da oferta, item do combo e valor mensal do item) precisam ser exibidos explicitamente na Seção 2 ("DADOS DA CONTRATAÇÃO"), logo abaixo do campo **Aparelho**.

Atualmente, o layout do Termo renderiza ofertas genéricas ou sem o detalhamento padronizado do item de combo e valor de assinatura mensal correspondente.

## Target Output Format

As linhas de oferta exibidas abaixo de "Aparelho:" seguem as seguintes convenções confirmadas pelo usuário:

1. **Padrão de Texto**: `"Oferta" [nome-da-oferta] "-" [item-do-combo] "Ass.Mensal" [valor-do-item]`
2. **Oferta Simples (Não Combo)**: Repete o nome da oferta no lugar do item de combo: `"Oferta" [nome-da-oferta] "-" [nome-da-oferta] "Ass.Mensal" [valor-da-oferta]`.
3. **Formatação Monetária**: Formato padrão brasileiro com R$ (ex: `R$ 89,90`).
4. **Múltiplos Itens de Combo**: Cada item de combo é renderizado como uma linha `<tr>` separada no PDF.
5. **Estrutura de Tabela**: Tabela de 4 colunas com `"Oferta:"` à esquerda e `"Ass. Mensal:"` + `[valor]` à direita.

### Exemplo de Renderização na Tabela da Seção 2:
| Coluna 1 (Label) | Coluna 2 (Descrição) | Coluna 3 (Label Valor) | Coluna 4 (Valor) |
|---|---|---|---|
| Aparelho: | Próprio | | |
| Oferta: | Plano Voz Ilimitado - Combo 10GB | Ass. Mensal: | R$ 89,90 |
| Oferta: | Plano Voz Ilimitado - Pacote de Dados II | Ass. Mensal: | R$ 49,90 |

---

## Goals

- [x] Atualizar a especificação em `.specs/features/modulo-gerador-pdf-html/ajustes/ajuste-termo-pdf/spec-valores-oferta.md`.
- [x] Atualizar o mapeamento de dados em `termoService.js` para iterar sobre a lista de ofertas/itens de combo e formatar no padrão `"Oferta" [nome-da-oferta] "-" [item-do-combo] "Ass.Mensal" [valor-do-item]`.
- [x] Posicionar o placeholder `{{offerRows}}` em `termoTemplate.html` imediatamente abaixo da linha do campo `Aparelho:`.
- [x] Garantir o alinhamento adequado na tabela HTML de 4 colunas (Label da Oferta, Nome/Item, Label Ass. Mensal, Valor).
- [x] Atualizar `tests/test-pdf-html-generation.js` com massa de dados de teste contendo nome de oferta, item de combo e valor mensal.
- [x] Validar a geração via comando `make test-pdf-html-generation` (gerando `tmp/test-pdfs/html_termo_TESTE.pdf`).

---

## Out of Scope (Escopo Protegido - Impact Protector)

| Componente / Módulo | Status | Justificativa |
|---|---|---|
| Submódulos `proposta` e `permanencia` | Intocado | Ajuste exclusivo do Termo |
| Engine Playwright (`htmlRenderer.js`) | Intocado | Motor de renderização genérico mantido sem alterações |
| Controller & Rotas `/api/contracts` | Intocado | Contrato de API e endpoints mantidos |
| Frontend em `public/` | Intocado | Geração de PDF ocorre 100% no servidor |
| Schemas Mongoose / Banco de dados | Intocado | Sem alterações em persistência de dados |

---

## Abordagem Arquitetural (PonyTail & SOLID)

### Principles (SOLID)
1. **SRP (Single Responsibility Principle)**:
   - `termoTemplate.html`: Responsável exclusivamente pela estrutura markup da tabela.
   - `termoService.js`: Responsável exclusivamente pelo mapeamento, transformação e interpolação dos dados de oferta no HTML.
   - `htmlRenderer.js`: Responsável exclusivamente pela conversão do HTML final para PDF via Playwright.
2. **OCP (Open/Closed Principle)**:
   - O gerador de PDF genérico é estendido via especificidades do submodule `termo`, sem modificar o core da aplicação.

### PonyTail Guidelines
- **Zero Sobre-Engenharia**: Não criar classes abstratas, construtores de tabelas complexos ou parsers adicionais. Utilizar funções simples com `.map()` e interpolação direta de strings (`template literals`).
- **Simplicidade de Manutenção**: Manter a formatação das tabelas usando as classes CSS utilitárias existentes (`.lbl`, `.section-table`).

---

## Traceable Requirements

### [REQ-OFERTA-001] Formatação da Linha de Oferta
- **Descrição**: Cada oferta/item de combo presente no payload do contrato deve ser formatado como uma linha de tabela de 4 colunas:
  - Coluna 1 (`class="lbl"`): `"Oferta:"`
  - Coluna 2: `"[nome-da-oferta] - [item-do-combo]"` (para oferta simples: `"[nome-da-oferta] - [nome-da-oferta]"`).
  - Coluna 3 (`style="text-align:right;"`): `"Ass. Mensal:"`
  - Coluna 4 (`style="text-align:right;"`): `"[valor-do-item]"` em formato R$ (ex: `"R$ 89,90"`).
- **Critério de Aceite**: A interpolação em `termoService.js` deve gerar o HTML exato no formato especificado.

### [REQ-OFERTA-002] Posicionamento no Template HTML
- **Descrição**: No arquivo `termoTemplate.html`, as linhas geradas pelo placeholder `{{offerRows}}` devem ser renderizadas imediatamente após a tr do campo `Aparelho:`.
- **Critério de Aceite**: A tabela da Seção 2 exibe em ordem: Qtd, DDD, Tipo de Venda, Plano, Aparelho, [Linhas de Oferta], Aparelho/Chip.

### [REQ-OFERTA-003] Validação Visual e de Execução
- **Descrição**: O script de teste `tests/test-pdf-html-generation.js` deve ser atualizado para simular a presença de itens de combo e verificar se o PDF `tmp/test-pdfs/html_termo_TESTE.pdf` é gerado sem erros.
- **Critério de Aceite**: `make test-pdf-html-generation` executa com sucesso e produz o PDF formatado conforme o padrão especificado.

### [REQ-OFERTA-004] Coleta Híbrida e Lookup Fallback de Combos
- **Descrição**:
  - **Frontend (`contractFormCollector.js`)**: Coleta `isCombo` e `itensCombo` a partir do `OfferStore` (via `findOfferByName`) para cada item de negociação do formulário.
  - **Backend (`termoService.js`)**: Caso `itensCombo` não venha preenchido no payload mas a oferta seja um combo cadastrado no MongoDB, realiza a busca via Mongoose `Offer.findOne({ nome: nomeOferta })` para expandir os sub-itens do combo.
  - **Tratamento de Exceção**: Em caso de falha de conexão com a base MongoDB, lança mensagem amigável ao usuário: *"Não foi possível gerar seu contrato neste momento devido a uma instabilidade temporária. Por favor, tente novamente em alguns instantes."*.
- **Critério de Aceite**: Ofertas do tipo combo são desestruturadas e exibidas na Seção 2 independentemente se a requisição originar do frontend ou de chamadas diretas de API sem desestruturação prévia.

---

## Checkpoints de Validação e Execução

- [x] Spec criada e atualizada com as especificações.
- [x] Implementação da coleta de `isCombo` e `itensCombo` no `contractFormCollector.js`.
- [x] Implementação do lookup fallback com tratamento de erros em `termoService.js`.
- [x] Registro da decisão arquitetural AD-044 em `.specs/STATE.md`.
- [x] Commit e merge automatizado das alterações na branch de trabalho.

