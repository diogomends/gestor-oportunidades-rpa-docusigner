# Tarefas: Bordas Completas em Quadros Divididos por Quebra de Página (Termo PDF)

## Mapeamento de Escopo & Proteção (Impact Protector)
- **Onde irá mudar:** 
  - `src/modules/gerador-pdf-html/submodules/termo/termoTemplate.html` (remoção do margin-bottom do container final `.cliente-declara`, zeramento da margem do último parágrafo filho `:last-child` e inclusão de `overflow: hidden;`).
  - `src/modules/gerador-pdf-html/submodules/termo/termoService.js` (definição explícita de `margin.bottom: "10mm"` na chamada ao `htmlRenderer.render`).
- **O que permanece intocado:**
  - Propriedades `-webkit-box-decoration-break: clone;` e `box-decoration-break: clone;` (exigidas pelos REQ-001 e REQ-002 da spec).
  - Submódulos `proposta` e `permanencia`.
  - Demais rotas da API e frontend em `public/`.

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| PDF Generator (Termo) | integration / visual | Geração do PDF sem regressões e sem borda extra duplicada ao final | `tmp/test-pdfs/termo_test.pdf` | `make test-pdf-html-generation` |

---

## Lista de Tarefas Atômicas

### Tarefa 1: Ajustar CSS de `.cliente-declara` em `termoTemplate.html` para Prevenir Microestouro Fantasma
- **Arquivo:** [termoTemplate.html](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/gerador-pdf-html/submodules/termo/termoTemplate.html)
- **Descrição:**
  1. Alterar `margin-bottom: 6px;` para `margin-bottom: 0;` na classe `.cliente-declara` (por ser o elemento final da página).
  2. Adicionar `overflow: hidden;` na classe `.cliente-declara`.
  3. Adicionar regra `.cliente-declara p:last-child { margin-bottom: 0; }` (e `.declara-item:last-child { margin-bottom: 0; }`) garantindo que o último elemento não empurre a margem.
- **Requisitos:** REQ-001, REQ-002 (preservar `box-decoration-break: clone`).
- **Verificação:** Inspeção do arquivo HTML.

### Tarefa 2: Explicitar Margem Inferior de 10mm no `termoService.js`
- **Arquivo:** [termoService.js](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/gerador-pdf-html/submodules/termo/termoService.js)
- **Descrição:** Na chamada do `htmlRenderer.render`, definir `margin: { top: "37mm", bottom: "10mm" }` em total consonância com a regra `@page` do template CSS.
- **Verificação:** Inspeção do arquivo JS.

### Tarefa 3: Validar Geração do PDF e Ausência de Borda Duplicada Extra
- **Comando:** `make test-pdf-html-generation`
- **Descrição:** Executar a geração dos PDFs via Playwright e inspecionar o PDF gerado em `tmp/test-pdfs/`.
- **Verificação:** Execução com saída 0 e ausência de linha dupla no rodapé do Termo.
