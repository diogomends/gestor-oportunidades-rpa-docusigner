# Gerador PDF HTML — Specification

## Problem Statement

O módulo `src/modules/criador-contratos-pdf/` (agora removido) usava `pdf-lib` para renderizar PDFs com coordenadas x/y manuais, wrapping customizado e lógica de página procedural (~1500 linhas de renderização). Isto tornava a manutenção e adição de novos modelos de contrato custosa.

O módulo `src/modules/gerador-pdf-html/` gera PDF a partir de HTML + CSS + Playwright, delegando layout, wrapping, justificação e quebras de página para o navegador headless.

## Goals

- [x] Criar módulo `src/modules/gerador-pdf-html/` que gere PDFs a partir de templates HTML.
- [x] Criar templates HTML nos próprios submodules para os 3 tipos de contrato.
- [x] Usar Playwright (já no projeto) como motor de renderização HTML → PDF.
- [x] Criar layouts próprios (`*Layout.js`) em cada submodule, copiados do módulo `criador-contratos-pdf` e independentes dele.
- [x] Simplificar permanencia: remover `permanenciaService.js` e `permanenciaLayout.js`, mover lógica para o Façade `service.js`, conteúdo estático no próprio template HTML.
- [x] Substituir o módulo `criador-contratos-pdf` — removido após migração completa.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alteração em schemas, models ou banco | Mesma interface de dados, sem impacto em persistência |
| Frontend | A rota nova pode ser consumida futuramente; sem mudanças no frontend agora |

---

## Assumptions & Open Questions

| Assumption | Default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Templates HTML nos submodules | `submodules/*/*Template.html` | Templates junto ao service que os consome | Sim |
| Engine de template | `string.replace` com `{{placeholder}}` | Sem dependência extra; repetições montadas no service | Sim |
| Playwright | Runtime dep (já instalado) | Já instalado no projeto | Sim |
| Roteamento | Rota nova separada | Não quebra endpoints existentes | Sim |

---

## User Stories

### P1: Módulo Backend de Geração HTML → PDF

**User Story**: Como desenvolvedor, quero gerar PDFs de contrato a partir de templates HTML para simplificar a manutenção e adição de novos modelos.

**Acceptance Criteria**:

1. WHEN uma requisição `POST /api/contracts/generate-pdf-html` com `{type, data}` for enviada THEN o servidor SHALL ler o template HTML correspondente em `submodules/*/*Template.html`.
2. WHEN o template for carregado THEN o servidor SHALL substituir os placeholders `{{nome}}` pelos valores de `data`.
3. WHEN o HTML estiver montado THEN o servidor SHALL renderizá-lo com Playwright e retornar `application/pdf`.
4. WHEN o tipo for inválido THEN o servidor SHALL retornar HTTP 400.
5. WHEN o tipo for `permanencia` THEN o servidor SHALL usar o método `generatePermanencia()` no próprio Façade `service.js`, sem delegar a um submodule separado.
6. WHEN um template de permanencia for processado THEN o servidor SHALL usar CSS inline nos elementos (sem `<style>` tag) e substituir diretamente os placeholders `{{var}}`.

**Independent Test**: Chamar a rota com dados válidos e verificar que o PDF gerado contém o texto injetado.

---

### P2: Templates HTML para os 3 Tipos de Contrato

**User Story**: Como desenvolvedor, quero templates HTML legíveis para cada tipo de contrato (termo, proposta, permanencia) para facilitar ajustes de layout sem mexer em código de renderização.

**Acceptance Criteria**:

1. WHEN o template `termoTemplate.html` for renderizado THEN o PDF deve conter título, tabela de dados do cliente, tabela de itens e cláusulas formatadas.
   - A seção 2 (DADOS DA CONTRATAÇÃO) deve ter os 3 primeiros campos (Tipo de Contratação, Data de Vencimento, Tipo de Fatura) com valores alinhados verticalmente ao centro (`vertical-align:middle`).
   - Após "Tipo de Fatura", deve haver um divisor independente (`<div style="border-bottom:0.75pt solid #888;">`) entre duas tabelas, ocupando 100% da largura da seção.
   - O campo "Qtd." deve ter espaçamento `margin-top:30px` da linha divisória.
2. WHEN o template `propostaTemplate.html` for renderizado THEN o PDF deve conter título, tabelas comerciais e condições.
3. WHEN o template `permanenciaTemplate.html` for renderizado THEN o PDF deve conter parágrafos introdutórios, cláusulas numeradas, tabela de aditivo e bloco de assinaturas.
4. WHEN um template for aberto em navegador THEN o layout deve ser legível (CSS incluso).

**Independent Test**: Abrir cada template HTML no navegador com dados de exemplo e verificar visualmente.

---

### P3: htmlRenderer com Playwright

**User Story**: Como desenvolvedor, quero um serviço reutilizável que converta HTML em PDF via Playwright sem instanciar um browser a cada chamada.

**Acceptance Criteria**:

1. WHEN `htmlRenderer.render(html)` for chamado THEN o método SHALL usar uma instância persistente de `Browser` (singleton).
2. WHEN o HTML for inválido THEN o método SHALL rejeitar com erro descritivo.
3. WHEN a página for gerada THEN o método SHALL retornar `Buffer` do PDF em formato A4 com margens configuráveis.

**Independent Test**: Chamar `htmlRenderer.render('<p>Teste</p>')` e verificar que o buffer tem cabeçalho PDF (`%PDF`).

---

## Requirement Traceability

| ID | Story | Phase | Status |
| --- | --- | --- | --- |
| HTMLPDF-01 | P1: Módulo backend + rota | Implemented | Shipped |
| HTMLPDF-02 | P2: Templates HTML | Implemented | Shipped |
| HTMLPDF-03 | P3: htmlRenderer Playwright | Implemented | Shipped |
| HTMLPDF-04 | T10: Layouts próprios (desacoplamento) | Implemented | Shipped |
| HTMLPDF-05 | Permanencia inline: remover service/layout dedicados | Implemented | Shipped |

---

## Success Criteria

- [x] Módulo `src/modules/gerador-pdf-html/` criado com estrutura análoga ao existente.
- [x] Templates HTML nos submodules para termo, proposta e permanencia.
- [x] Playwright configurado como runtime dependency.
- [x] Rota `/api/contracts/generate-pdf-html` funcional.
- [x] Módulo `criador-contratos-pdf` removido após migração completa.

---

## Layout Measurements — Permanência (Header/Logo via Playwright)

### Page Margins (`htmlRenderer.js`)

Margem padrão aplicada a todos os tipos. O tipo `permanencia` sobrescreve via `service.js:generatePermanencia()`.

| Propriedade | Padrão | Permanencia | Descrição |
|---|---|---|---|
| `PDF_FORMAT` | `A4` | `A4` | Formato de página |
| `PDF_MARGIN_TOP` | `18mm` | `37mm` | Margem superior. Permanencia usa 37mm para posicionar o primeiro texto abaixo do logo (spec). |
| `PDF_MARGIN_BOTTOM` | `14mm` | `14mm` | Margem inferior |
| `PDF_MARGIN_LEFT` | `18mm` | `18mm` | Margem esquerda (≈ 51pt) |
| `PDF_MARGIN_RIGHT` | `18mm` | `18mm` | Margem direita |

### HeaderTemplate (`service.js` — `headerTemplate`)

O headerTemplate é renderizado pelo Playwright na área da **margem superior** (37mm de altura no permanencia, 18mm nos demais). O conteúdo preenche a **largura total da página** (não limitado pelas margens laterais).

```html
<div style="padding:12.7mm 18mm 0;box-sizing:border-box;">
  <img src="data:image/png;base64,{logo}" style="max-width:100%;height:auto;max-height:12.35mm;display:block;" alt="TIM" />
</div>
```

| Propriedade | Valor | Efeito |
|---|---|---|
| Padding superior | `12.7mm` | Logo alinhado a 12.7mm do topo da página (spec) |
| Padding lateral | `18mm` | Alinhamento com o conteúdo (match MARGIN_LEFT/RIGHT) |
| Box-sizing | `border-box` | Padding incluso na altura total do header |
| `max-width` | `100%` | Ocupa toda largura disponível após padding |
| `max-height` | `12.35mm` | Altura da logo conforme spec do PDF original |
| `height` | `auto` | Proporção mantida |
| `display` | `block` | Ancorado à esquerda |

### Template Body (`permanenciaTemplate.html`)

**Arquivo**: `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaTemplate.html`

| Propriedade | Localização (linha) | Valor | Origem |
|---|---|---|---|
| `font-family` | body (7-8) | `Helvetica, Arial, sans-serif` | — |
| `font-size` (body) | body (9) | `14pt` | — |
| `line-height` | body (11) | `1.4` | — |
| `color` | body (10) | `#1a1a1a` | — |
| `body margin` | body (12) | `0` | — |
| `body padding` | body (13) | `0 0 40pt` (topo 0, fundo 40pt ≈ 14mm). Margem superior é controlada pelo `margin.top:37mm` do Playwright. | `MARGIN_BOT:40pt` |
| `CONTRATO DE PERMANÊNCIA` | `<h1>` (17) | Título centralizado, sublinhado, 12pt bold | — |
| `h1 margin` | h1 (22) | `0 0 26pt` | `titleBottomMargin:26pt` |
| `h1 font-size` | h1 (20) | `12pt` | — |
| `h1 text-decoration` | h1 (23) | `underline` | — |
| Intro `p margin-bottom` | p (33, 46) | `8pt` (≈ 2.8mm) | `INTRO_PARAGRAPH_GAP:8pt` |
| `h3 margin-top` | `<style>` (13) | `12pt` (≈ 4mm) | — |
| `h3 margin-bottom` | `<style>` (14) | `12pt` (≈ 4mm) | — |
| `h3` inline | removido | margens centralizadas no `<style>` | — |
| Cláusula `p margin-bottom` | p (71+) | `4pt` (≈ 1.5mm) | `CLAUSE_PARAGRAPH_GAP:4pt` |
| Seções (aditivo/assinaturas) | div (457, 729) | `margin:10pt 0` | `CLAUSE_SPACE_AFTER:10pt` |

### Logo Source

- **Arquivo**: `src/modules/gerador-pdf-html/shared/logo.png`
- **Formato**: PNG
- **Injeção**: Lido com `readFileSync`, convertido para base64, inserido como `data:image/png;base64,{logo}` no headerTemplate

---

## Documentos de Referência (Design Specs)

Os seguintes arquivos contêm as especificações completas de design extraídas dos PDFs originais via `pdfplumber` + `pymupdf`. Foram a base para os ajustes de layout implementados neste módulo.

| Arquivo | Descrição |
|---|---|
| `pdf_design_specs.json` | Specs completas em JSON: margens, posições, tipografia, espaçamentos, cores, tabelas (723 linhas). Fonte canônica para implementação. |
| `pdf_design_report.md` | Resumo legível com tabelas e CSS de replicação (211 linhas). Companheiro do JSON. |
| `tools/analyze_pdfs.py` | Script de extração via pdfplumber. |
| `tools/analyze_pdfs_v2.py` | Script de extração via pymupdf. |
