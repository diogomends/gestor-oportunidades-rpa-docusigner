# Plano de Tarefas — Ajuste de Espaçamento e Quebra de Página (Termo PDF)

## Visão Geral
Combinação das Opções 1 e 2: remoção de código duplicado, redução de margens internas na Seção 2 e flexibilização da quebra de página na Seção 3.

---

### [x] Tarefa 1: Limpeza de Duplicação e Margens em `termoService.js`
- **Arquivo:** [`termoService.js`](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/gerador-pdf-html/submodules/termo/termoService.js)
- **Status:** Concluído
- **Ações:**
  1. [x] Remover o texto duplicado das 14 cláusulas da string `signaturesHtml` (linhas 308-326).
  2. [x] Alterar o `padding-top` inline de 40px para 10px na linha "Aparelho/Chip:" (linha 190).
  3. [x] Reduzir as margens de `notesHtml` (linhas 239-251), alterando `margin-top: 25px` para `10px`, `margin-top: 20px` para `10px` e ajustando `<p style="margin-top:20px;">Observação:</p>` para `<p style="margin-top:5px;">Observação:</p>`.
- **Verificação:** Executar verificação visual via geração de PDF.

---

### [x] Tarefa 2: Ajuste de Margens CSS e Quebra de Página em `termoTemplate.html`
- **Arquivo:** [`termoTemplate.html`](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/gerador-pdf-html/submodules/termo/termoTemplate.html)
- **Status:** Concluído
- **Ações:**
  1. [x] Alterar `.valor-total-title` de `margin-top: 40px` para `margin-top: 10px` (linha 120).
  2. [x] Alterar a tabela secundária da Seção 2 de `style="margin-top: 30px"` para `style="margin-top: 10px"` (linha 254).
  3. [x] Remover `page-break-inside: avoid;` de `.assinaturas-section` (linha 142).
  4. [x] Adicionar `page-break-inside: avoid;` na classe `.sig-block` (linha 147).
- **Verificação:** Inspeção do código CSS e validação no renderizador.

---

### [x] Tarefa 3: Validação da Geração de PDF
- **Comando:** `make test-pdf-html-generation`
- **Status:** Concluído
- **Ações:**
  1. [x] Gerar os PDFs de teste em `tmp/test-pdfs/`.
  2. [x] Verificar visualmente se a Seção 3 inicia na primeira página sem lacuna excessiva e sem duplicação de cláusulas.

