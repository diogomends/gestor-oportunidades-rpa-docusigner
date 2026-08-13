# Spec: Ajuste do Layout do Termo de Contratação PDF (`ajuste-termo-pdf`)

## Visão Geral
Ajustar a renderização do bloco **Aparelho/Chip**, **Valor Total Mensal Assinatura** e observações/cláusulas no submódulo `src/modules/gerador-pdf-html/submodules/termo`, tomando como base a captura de tela `tmp/Captura de tela 2026-07-29 104343.png`.

## Escopo & Limites
- **Escopo Incluído:**
  - Ajuste de `termoTemplate.html`, `termoService.js` e `termoLayout.js`.
  - Remoção da linha divisória superior acima de `Aparelho/Chip` (não presente no layout original).
  - Agrupamento em um **único quadro delimitado por borda** de todos os itens a partir de `Valor Total Mensal Assinatura:` até a frase de consentimento (`Sim, concordo...`).
  - Mapeamento adequado das 3 linhas de detalhes de Aparelho/Chip (Ex: "Próprio", "Nano Chip", "Venda à Vista 1x").
  - Formatação dos alinhamentos à direita para "Valor Mensal:" e "Valor Chip 1x:".
  - Ajuste preciso do distanciamento e margens (padding/margin) entre elementos e linhas de texto dentro do quadro unificado.
- **Escopo Excluído (Protegido):**
  - Módulos de `proposta` e `permanencia`.
  - `htmlRenderer.js`.
  - Rotas e controllers da API `/api/contracts/`.

## Requisitos Traceáveis

### [REQ-001] Estrutura da Seção Aparelho/Chip
- **Descrição:** O bloco de Aparelho/Chip deve exibir 3 linhas na coluna central (Aparelho, Modelo/Tipo do Chip, Condição de Pagamento) e alinhar os rótulos e valores de "Valor Mensal" e "Valor Chip 1x" à direita, sem a linha divisória superior que existia anteriormente sobre Aparelho/Chip.
- **Critério de Aceite:** A área de Aparelho/Chip deve se conectar sem linha divisória superior às linhas anteriores, exibindo os dados em 3 linhas verticalizadas.

### [REQ-002] Quadro Unificado para Valor Total e Observações
- **Descrição:** Agrupar em um mesmo quadro delimitado por borda (`border: 0.75pt solid #888` ou `#000`) o título `Valor Total Mensal Assinatura: R$ XX,XX`, as notas explicativas (cobrança de chip 1x, venda facilitada, CMO/VF/AP) e a pergunta/resposta do item 1 (consentimento de mensagens de novos produtos e serviços).
- **Critério de Aceite:** Todos esses itens devem estar contidos no mesmo container com borda delimitadora, sem divisão por caixas separadas.

### [REQ-003] Validação de Geração de PDF
- **Descrição:** O comando `make test-pdf-html-generation` deve rodar sem erros e gerar o PDF do termo em `tmp/test-pdfs/` com a nova estrutura visual.
- **Critério de Aceite:** PDF gerado em `tmp/test-pdfs/termo.pdf` reflete a remoção da linha sobre Aparelho/Chip e o quadro unificado do Valor Total e notas.

### [REQ-004] Linha Divisória de Separação de Seção
- **Descrição:** Manter a linha horizontal contínua de separação abaixo de `Aparelho/Chip` que encerra a Seção 2 de Dados da Contratação antes do início do quadro unificado do Valor Total Mensal.
- **Critério de Aceite:** Linha divisória horizontal visível abaixo do último item de Aparelho/Chip separando a seção do quadro unificado.

### [REQ-005] Distanciamento e Espaçamento Interno do Quadro
- **Descrição:** Ajustar margens e espaçamentos internos do quadro unificado (margem superior do título do valor total, espaçamento de 6px a 10px antes da pergunta 1 e entrelinhas das notas explicativas).
- **Critério de Aceite:** O distanciamento interno do quadro unificado deve garantir respiro idêntico ao apresentado na captura de tela.
