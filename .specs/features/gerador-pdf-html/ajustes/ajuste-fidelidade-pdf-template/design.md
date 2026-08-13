# Ajuste de Fidelidade PDF Template — Design

**Spec**: `.specs/features/ajuste-fidelidade-pdf-template/spec.md`  
**Status**: In Progress

---

## Arquivos Afetados

| Arquivo | Tipo de mudança |
| --- | --- |
| `src/modules/criador-contratos-pdf/shared/constants.js` | Constantes de layout + novas `CLAUSE_*` e `INTRO_*` de espaçamento |
| `src/modules/criador-contratos-pdf/shared/pdfEngine.js` | `wrapFormatted`, `drawFormattedLine`, `parseFormattedText` (+ bold); logo escalada; header/título configurável |
| `src/modules/criador-contratos-pdf/submodules/termo/termoLayout.js` | Added `titleTopMargin`, `titleBottomMargin` |
| `src/modules/criador-contratos-pdf/submodules/proposta/propostaLayout.js` | Added `titleTopMargin`, `titleBottomMargin` |
| `src/modules/criador-contratos-pdf/submodules/permanencia/permanenciaLayout.js` | Textos jurídicos atualizados, `defaultFontSize: 12`, `hideHeaderLine`, aditivo 7 colunas, assinaturas completas |
| `src/modules/criador-contratos-pdf/submodules/permanencia/permanenciaService.js` | Refatorado: delega renderização para módulos dedicados, `_buildContext` compartilhado |
| `src/modules/criador-contratos-pdf/submodules/permanencia/permanenciaRenderer.js` | **Novo**: `ensureSpace()` e `renderFormattedLines()` — helpers de paginação e texto formatado |
| `src/modules/criador-contratos-pdf/submodules/permanencia/renderIntroParagraphs.js` | **Novo**: Renderiza os parágrafos introdutórios |
| `src/modules/criador-contratos-pdf/submodules/permanencia/renderClauses.js` | **Novo**: Renderiza cláusulas com/sem título, usa constantes de espaçamento |
| `src/modules/criador-contratos-pdf/submodules/permanencia/renderAditivoTable.js` | **Novo**: Renderiza a tabela de aditivo com cabeçalho e linhas |
| `src/modules/criador-contratos-pdf/submodules/permanencia/renderSignatures.js` | **Novo**: Renderiza o bloco de assinaturas (representantes, TIM, testemunhas, consultor) |

---

## Especificação Técnica dos Componentes dos Contratos

### 1. Termo de Contratação v5.10 (`termoTemplate.js`)

#### Espaçamentos e Geometria
- **Margem Esquerda (`MARGIN_LEFT`)**: `50.00pt` (Largura útil de impressão: `493.78pt`, x = 50.00 a 543.78)
- **Largura da Coluna de Labels (`COL1_W`)**: `81.00pt` (Labels iniciam em x=53.00, valores em x=134.31)
- **Header Retângulo Azul (`COLOR_HEADER_BG`)**: `rgb(0, 0.27451, 0.56863)` (#004691), altura `8.00pt` (y=771..806)
- **Título do Documento**: y=729.40pt, x=188.70pt, tamanho 10.5pt Bold
- **Altura de Linha Base (`ROW_H_BASE`)**: `13.63pt` (Delta Y constante entre linhas)
- **Bordas de Seção**: Retângulo completo (left, right, top, bottom) com espessura `0.75pt` e cor preta `rgb(0,0,0)`

#### Tipografia e Tamanho das Letras
- **Título do Documento**: `10.50pt` `Helvetica-Bold` (`/F1 10.5 Tf`)
- **Títulos de Seção (Header Bar)**: `8.25pt` `Helvetica-Bold` (`/F1 8.25 Tf`)
- **Destaques e Totais da Tabela (Item 10)**: `9.00pt` `Helvetica-Bold` (`/F1 9 Tf`)
- **Rótulos e Valores (Corpo)**: `8.25pt` `Helvetica` (`/F2 8.25 Tf`)
- **Texto Legal (Cláusulas 1 a 14)**: `8.25pt` `Helvetica` (`/F2 8.25 Tf`)
- **Checkboxes Marcados**: `8.25pt` `Helvetica-Bold` (`/F1 8.25 Tf` para o `X`)

#### Mapeamento Detalhado de Itens em Negrito (`/F1` = `Helvetica-Bold`)
1. **Título Principal**: `"TERMO DE CONTRATAÇÃO - VERSÃO 5.10"`
2. **Cabeçalhos de Seção**:
   - `"1. IDENTIFICAÇÃO DO CLIENTE"` (ou `"1. DADOS DO CLIENTE"`)
   - `"2. DADOS DA CONTRATAÇÃO"`
   - `"3. DADOS DO GESTOR DA CONTA"`
   - `"4. DADOS DA REVENDA / CONSULTOR"`
   - `"5. DETALHAMENTO DAS OFERTAS E SERVIÇOS"` (Item 10)
3. **Labels da Tabela de Acessos / Ofertas (Item 10)**:
   - `"Aparelho/Chip:"`
   - `"Valor Mensal:"`
   - `"Valor Chip 1x:"`
   - `"Valor Total Mensal Assinatura: R$ 29,99"`
4. **Assinaturas e Testemunhas**:
   - `"3. Assinaturas"`
   - `"Representante Legal:"`
   - `"Testemunhas:"`
   - `"Assinatura Consultor / Senior Account:"`
5. **Destaques Legais / Cláusulas (Páginas 2 e 3)**:
   - `"O Cliente declara que:"`
   - Checkbox de recebimento de fatura: `"(X)"`

---

### 2. Proposta Comercial (`propostaTemplate.js`)

#### Espaçamentos e Geometria
- **Margem Esquerda (`MARGIN_LEFT`)**: `50.00pt` (x=50.00..543.78)
- **Margem Superior Inicial**: `727.60pt`
- **Largura da Coluna de Rótulos do Cliente**: `110.00pt`
- **Larguras das Colunas da Tabela de Ofertas**:
  - `Item`: `35.00pt`
  - `Acesso / Linha`: `80.00pt`
  - `Plano Atual`: `110.00pt`
  - `Novo Plano / Oferta`: `120.00pt`
  - `Valor Mensal (R$)`: `75.00pt`
  - `Valor Chip (R$)`: `73.78pt`

#### Tipografia e Tamanho das Letras
- **Título do Documento**: `12.00pt` `Helvetica-Bold` (`/F1 12 Tf`) (x=167.94pt, y=727.60pt)
- **Títulos de Seção / Tabela**: `12.00pt` `Helvetica-Bold` (`/F1 12 Tf`)
- **Corpo da Tabela / Valores**: `8.25pt` `Helvetica` (`/F2 8.25 Tf`)
- **Rodapés e Notas Jurídicas**: `7.50pt` `Helvetica-Bold` (`/F1 7.5 Tf`) e `Helvetica` (`/F2 7.5 Tf`)

#### Mapeamento Detalhado de Itens em Negrito (`/F1` = `Helvetica-Bold`)
1. **Título Principal**: `"PROPOSTA COMERCIAL"`
2. **Cabeçalho de Negociação**: `"CONDIÇÕES COMERCIAIS DA NEGOCIAÇÃO"`
3. **Campos Chave do Cliente**: `"RAZÃO SOCIAL"`, `"CNPJ"`, `"TOTAL DE MULTA ANTECIPADA A PAGAR NESTA NEGOCIAÇÃO"`
4. **Cabeçalho da Tabela de Linhas**: `"Item"`, `"Acesso/Linha"`, `"Plano Atual"`, `"Novo Plano / Oferta"`, `"Aparelho/Modelo"`, `"Valor Mensal (R$)"`, `"Valor Chip (R$)"`
5. **Totais e Subtotais**: `"TOTAL MENSAL:"`, `"TOTAL REPETIDOR:"`, `"TOTAL CHIP:"`

---

### 3. Contrato de Permanência (`permanenciaTemplate.js`)

#### Espaçamentos e Geometria
- **Margem Esquerda (`MARGIN_LEFT`)**: `50.00pt` (Largura útil: `493.78pt`)
- **Margem Superior Inicial**: `727.60pt`, **Margem Inferior Limite**: `54.88pt`
- **Espaçamento entre Parágrafos/Cláusulas**: `14.40pt`
- **Altura de Linha do Corpo Jurídico**: `14.40pt`
- **Espaços configuráveis via constantes** (em `shared/constants.js`):
  - `CLAUSE_SPACE_BEFORE`: `3pt` — espaço antes do título da cláusula
  - `CLAUSE_TITLE_SAFETY`: `16pt` — margem de segurança para paginação antes do título
  - `CLAUSE_TITLE_GAP_AFTER`: `20pt` — espaço após o título, antes do primeiro parágrafo
  - `CLAUSE_PARAGRAPH_GAP`: `4pt` — espaço entre parágrafos dentro de uma cláusula
  - `CLAUSE_SPACE_AFTER`: `10pt` — espaço após todos os parágrafos, antes da próxima cláusula
  - `INTRO_PARAGRAPH_GAP`: `8pt` — espaço entre parágrafos introdutórios
  - `INTRO_SPACE_AFTER`: `10pt` — espaço após os parágrafos introdutórios

#### Tipografia e Tamanho das Letras
- **Título Principal do Contrato**: `12.00pt` `Helvetica-Bold` (`/F1 12 Tf`) (x=207.17pt, y=727.60pt)
- **Partes Contratantes / Títulos de Cláusulas**: `12.00pt` `Helvetica-Bold` (`/F1 12 Tf`)
- **Numeração de Cláusulas e Sub-cláusulas**: `12.00pt` `Helvetica-Bold` (`/F1 12 Tf`)
- **Texto Jurídico (Corpo)**: `12.00pt` `Helvetica` (`/F2 12 Tf`), com `<b>` tags para negrito inline
- **Header**: Sem linha separadora (`hideHeaderLine: true`), `titleTopMargin: 26`, `titleBottomMargin: 20`

#### Mapeamento Detalhado de Itens em Negrito (`/F1` = `Helvetica-Bold`) — implementado via `<b>` tags inline
1. **Título Principal**: `"CONTRATO DE PERMANÊNCIA"`
2. **Identificação das Partes**: `"TIM S.A."`, `"'TIM'"`, `"CLIENTE"` — marcados com `<b>` no texto
3. **Títulos de Cláusulas**:
   - `"CLÁUSULA PRIMEIRA - OBJETO"`
   - `"CLÁUSULA SEGUNDA - CONDIÇÕES COMERCIAIS"`
   - `"CLÁUSULA TERCEIRA - CANCELAMENTO"`
   - `"CLÁUSULA QUARTA - DISPOSIÇÕES GERAIS"`
   - `"CLÁUSULA QUINTA - FORO"`
4. **Numeração de Sub-cláusulas**: `"3.1"`, `"3.2"`, `"3.2.1"`, `"a)"`, `"b)"`, `"c)"`
5. **Bloco de Assinaturas**: `"REPRESENTANTES LEGAIS:"`, `"TESTEMUNHAS"`, `"CONSULTOR / SENIOR ACCOUNT:"`
6. **Outros**: `"TIM"` (no corpo do texto jurídico, ex.: `"<b>TIM</b>oferece um desconto"`)

---

## Mapa de Constantes do Módulo PDF Generator

| Constante | Valor Atual | Valor Novo | Origem (template base64) |
| --- | --- | --- | --- |
| `COLOR_HEADER_BG` | `rgb(0.043, 0.208, 0.42)` (#0B3569) | `rgb(0, 0.27451, 0.56863)` (#004691) | Stream 5 do Termo: `0 0.27451 0.56863 rg` |
| `MARGIN_LEFT` | `40` | `50` | Logo em x=50, labels em x=53 |
| `FONT_SIZE` | `9` | `8.25` | Operador `Tf` em todos os content streams: `/F2 8.25 Tf` |
| `HEADER_H` | `14` | `8` | Altura do retângulo azul: 7.63pt (arredondado para 8) |
| `ROW_H_BASE` | `13` | `13.63` | Delta Y consistente entre linhas: 685.69 − 672.06 = 13.63 |
| `COL1_W` | `100` | `81` | Labels em x=53, valores em x≈134.31 → 81.31pt (arredondado) |
| `COL2_X` | `MARGIN_LEFT + COL1_W` | `MARGIN_LEFT + COL1_W` | = 131 (fórmula dinâmica mantida) |
| `TITLE_SIZE` | `12` | `10.5` | Stream 5: `/F1 10.5 Tf` no título |
| `CLAUSE_SPACE_BEFORE` | — | `3` | Novo — espaço antes do título da cláusula |
| `CLAUSE_TITLE_SAFETY` | — | `16` | Novo — margem de segurança p/ paginação |
| `CLAUSE_TITLE_GAP_AFTER` | — | `20` | Novo — espaço após título da cláusula |
| `CLAUSE_PARAGRAPH_GAP` | — | `4` | Novo — espaço entre parágrafos |
| `CLAUSE_SPACE_AFTER` | — | `10` | Novo — espaço após último parágrafo |
| `INTRO_PARAGRAPH_GAP` | — | `8` | Novo — espaço entre parágrafos introdutórios |
| `INTRO_SPACE_AFTER` | — | `10` | Novo — espaço após intro |

---

## Mudanças Comportamentais

### 1. Remoção de linhas entre rows (`service.js:_renderTable`)

**Antes**:
```js
page.drawLine({
  start: { x: MARGIN_LEFT,             y: y - rowH },
  end:   { x: MARGIN_LEFT + CONTENT_W, y: y - rowH },
  thickness: 0.3, color: COLOR_BORDER,
});
```

**Depois**: Bloco removido. O template original não possui grid interno nas seções.

### 2. Bordas externas por seção (`service.js:_renderTable`)

**Novo**: Desenhar `drawRectangle` com stroke 0.75pt preto ao redor de header + rows de cada seção:

```js
const sectionStartY = y;
// ... renderiza header + rows ...
const sectionHeight = sectionStartY - y;
page.drawRectangle({
  x: MARGIN_LEFT - 3,
  y: y,
  width: CONTENT_W + 6,
  height: sectionHeight,
  borderColor: rgb(0, 0, 0),
  borderWidth: 0.75,
});
```

### 3. Suporte a label como array (`service.js:_renderTable`)

**Antes**: `const labelLines = wrap(label, fontReg, FONT_SIZE, COL1_W - 4);`

**Depois**:
```js
const labelLines = Array.isArray(label) ? label : wrap(label, fontReg, FONT_SIZE, COL1_W - 4);
```

### 4. Centralização vertical do valor (`service.js:_renderTable`)

**Antes**: Valor sempre na primeira linha do label (`y - ROW_H_BASE + 3`).

**Depois**:
```js
const valY = labelLines.length > 1
  ? y - (rowH / 2) + 2
  : y - ROW_H_BASE + 3;
page.drawText(String(value), {
  x: COL2_X + 3, y: valY,
  size: FONT_SIZE, font: fontReg, color: COLOR_ROW_TEXT,
});
```

### 5. Quebra hardcoded de labels (`layoutBuilder.js`)

**Antes**:
```js
['Tipo de Contratação:', data.tipoContratacao || ''],
['Data de Vencimento:', data.vencimento ? `Dia ${data.vencimento}` : ''],
```

**Depois**:
```js
[['Tipo de', 'Contratação:'], data.tipoContratacao || ''],
[['Data de', 'Vencimento:'], data.vencimento ? `Dia ${data.vencimento}` : ''],
```

---

## Nova Arquitetura de Renderização — Permanência

### Antes (monolítico)

`permanenciaService.js` continha ~250 linhas com toda a lógica de renderização inline:
- Quebra de linha manual com `wrap()`
- Paginação manual com `ensureSpace()` local
- Desenho direto de texto, tabelas, assinaturas
- Espaçamentos hardcoded espalhados pelo código

### Depois (renderizadores dedicados)

```
permanenciaService.js          → orquestrador (~40 linhas)
  ├─ permanenciaRenderer.js    → ensureSpace() + renderFormattedLines()
  ├─ renderIntroParagraphs.js  → intro paragraphs
  ├─ renderClauses.js          → clauses (com/sem título)
  ├─ renderAditivoTable.js     → aditivo table (7 colunas)
  └─ renderSignatures.js       → bloco de assinaturas
```

Cada renderizador recebe um `ctx` compartilhado (criado por `_buildContext()`) com:
- `pdfDoc`, `pdfEngineInstance`, `layout`, `fontBold`, `fontReg`, `logoImage`
- `bodyFontSize`, `bodyLineGap`, `clauseTitleSize`

### Engine de Texto Formatado (`pdfEngine.js`)

Novos métodos para suporte a `<b>` tags inline:

| Método | Função |
| --- | --- |
| `parseFormattedText(text)` | Converte texto com `<b>`, `<strong>`, `**` em tokens `{text, isBold}` |
| `textToWordTokens(text)` | Quebra tokens em palavras individuais para wrap |
| `wrapFormatted(text, fontReg, fontBold, size, maxW)` | Wrap de texto formatado respeitando bold |
| `mergeLineTokens(wordTokens)` | Mescla tokens contíguos do mesmo estilo |
| `drawFormattedLine(page, lineTokens, options)` | Desenha linha alternando fontes regular/bold |

### Header/Título Configurável

O `renderHeaderAndTitle()` agora respeita propriedades do layout:

| Propriedade | Padrão | Efeito |
| --- | --- | --- |
| `titleTopMargin` | `24` | Espaço entre logo e título |
| `titleBottomMargin` | `20` | Espaço entre título e conteúdo |
| `titleUnderline` | `true` | Se desenha underline no título |
| `hideHeaderLine` | `false` | Se oculta a linha separadora |
| `titleFontSize` | `12` | Tamanho da fonte do título |

---

## Verificação Visual

Critério de aceite: PDF gerado deve ser indistinguível das páginas dos templates base64 em inspeção lado a lado:

1. Decodificar templates base64 (`termoBase64`, `propostaBase64`, `permanenciaBase64` → PDF)
2. Gerar PDF com `contractsPDFService.generateContractPDF(tipo, dadosDummy)`
3. Comparar: cores, fontes, posições, bordas, negritos e cláusulas jurídicas
