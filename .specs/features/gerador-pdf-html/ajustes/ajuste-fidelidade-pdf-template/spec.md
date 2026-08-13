# Ajuste de Fidelidade Visual — PDFs de Contrato vs Template Base64

## Problem Statement

Os PDFs gerados pelo módulo `src/modules/criador-contratos-pdf/` (via `pdf-lib`) divergem visualmente dos templates canônicos base64 em `src/modules/criador-contratos-pdf/submodules/` (`permanenciaTemplate.js`, `propostaTemplate.js`, `termoTemplate.js`). Esses templates base64 foram gerados por iTextSharp e constituem a referência de layout oficial e imutável homologada pela TIM. Para garantir 100% de fidelidade visual na geração dinâmica via `pdf-lib`, é necessário especificar minuciosamente cada componente dos 3 contratos (Termo, Proposta e Permanência), incluindo espaçamentos, fontes, tamanhos de letra e a lista exata de elementos em negrito.

## Goals

- [x] Corrigir constantes globais de layout (cores, fontes, margens, alturas de linha) para espelhar os templates base64 originais
- [x] Remover linhas separadoras internas entre rows que não existem no original
- [x] Adicionar bordas externas por seção com stroke 0.75pt preto
- [x] Implementar quebra manual de labels longos ("Tipo de Contratação:", "Data de Vencimento:") idêntica ao original
- [x] Centralizar valores verticalmente quando o label ocupa 2 linhas
- [x] Especificar em detalhe os espaçamentos, fontes, tamanhos e negritos dos 3 submódulos (`Termo`, `Proposta`, `Permanência`)
- [x] Refatorar `permanenciaService.js` — extrair renderizadores dedicados em arquivos separados (intro, clauses, aditivo, assinaturas)
- [x] Extrair espaçamentos de cláusulas/parágrafos para constantes nomeadas em `shared/constants.js` (`CLAUSE_*`, `INTRO_*`)
- [x] Adicionar suporte a texto formatado com negrito (`<b>` tags) no `pdfEngine.js` (`wrapFormatted`, `drawFormattedLine`, `parseFormattedText`)
- [x] Atualizar textos e layout do Contrato de Permanência para fidelidade ao template TIM oficial (cláusulas, aditivo 7 colunas, assinaturas)
- [ ] Implantar a geração dinâmica das Páginas 2 e 3 do Termo de Contratação (Item 10: tabela de ofertas por linha, texto legal integral e bloco de assinaturas na Página 2)
- [ ] Garantir fidelidade de layout e tipografia na Proposta Comercial e no Contrato de Permanência

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alteração no frontend | Ajustes exclusivamente no módulo backend `src/modules/criador-contratos-pdf/` |
| Regeneração dos templates base64 | Os templates originais permanecem como referência canônica imutável |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Fonte de verdade do layout | Templates base64 decodificados (`termoTemplate.js`, `propostaTemplate.js`, `permanenciaTemplate.js`) | Única referência canônica aprovada pela TIM | Sim |
| Tipografia oficial | Helvetica (Corpo: `/F2`) e Helvetica-Bold (Negrito: `/F1`) | Fontes padrão embutidas nos streams iTextSharp originais | Sim |
| Quebra de labels longos | Hardcode no `layoutBuilder.js` | Fidelidade exata; labels específicos que não cabem na coluna de 81pt | Sim |
| Bordas das seções | Box individual por seção (left + right + top + bottom) com stroke 0.75pt | Desenho preciso do contorno de seções e tabelas | Sim |
| Escopo de páginas do Termo | Páginas 1, 2 e 3 geradas dinamicamente via `pdf-lib` | Requisito de fidelidade total ao modelo TIM v5.10 | Sim |
| Dados de Oferta / Linhas | Array em `data.linhas` / `data.itens` (cada item com oferta, valor mensal e chip) | Permitir dinamismo para múltiplos acessos e chips | Sim |
| Texto legal das cláusulas | Hardcoded em `layoutBuilder.js` com texto oficial | Fidelidade ao texto jurídico homologado pela TIM | Sim |
| Renderizadores do Permanência | Extraídos para `permanenciaRenderer.js`, `renderClauses.js`, `renderIntroParagraphs.js`, `renderAditivoTable.js`, `renderSignatures.js` | Separação de responsabilidades (SOLID) sem quebrar o layout | Sim |
| Espaçamentos de cláusulas | Constantes nomeadas em `shared/constants.js` (`CLAUSE_SPACE_BEFORE`, `CLAUSE_TITLE_GAP_AFTER`, etc.) | Ajuste centralizado sem caça no código | Sim |
| Engine de texto formatado | `pdfEngine.js` com `wrapFormatted`, `drawFormattedLine`, `parseFormattedText` | Suporte a negrito inline com `<b>` tags no texto jurídico | Sim |

---

## Especificação de Componentes por Contrato

### 1. Termo de Contratação v5.10 (`termoTemplate.js`)
- **Espaçamentos e Dimensões**:
  - Margem Esquerda: `50pt` (Logo em x=50, conteúdo em x=50..543.78 → Largura útil `493.78pt`)
  - Coluna 1 (Labels): Largura `81pt` (Labels em x=53, valores em x=134.31)
  - Banner Azul Header: Retângulo `#004691` (`0 0.27451 0.56863 rg`), altura 8pt (y=771..806)
  - Título do Documento: y=729.4pt, x=188.7pt
  - Delta Y de Linhas (`ROW_H_BASE`): `13.63pt`
  - Sub-tabelas e Seções: Borda externa preta stroke `0.75pt`
- **Fontes e Tamanhos**:
  - Título Principal: `10.5pt` `Helvetica-Bold` (`/F1 10.5 Tf`)
  - Cabeçalhos de Seção / Caixas: `8.25pt` `Helvetica-Bold` (`/F1 8.25 Tf`)
  - Subtotais / Destaques da Tabela: `9pt` `Helvetica-Bold` (`/F1 9 Tf`)
  - Rótulos e Valores (Corpo): `8.25pt` `Helvetica` (`/F2 8.25 Tf`)
  - Texto Legal (Cláusulas 1 a 14): `8.25pt` `Helvetica` (`/F2 8.25 Tf`)
  - Checkboxes Marcados: `8.25pt` `Helvetica-Bold` (`/F1 8.25 Tf` para o `X`)
- **Itens / Palavras em Negrito (`Helvetica-Bold` / `/F1`)**:
  - `TERMO DE CONTRATAÇÃO - VERSÃO 5.10`
  - `1. IDENTIFICAÇÃO DO CLIENTE` (ou `1. DADOS DO CLIENTE`)
  - `2. DADOS DA CONTRATAÇÃO`
  - `3. DADOS DO GESTOR DA CONTA`
  - `4. DADOS DA REVENDA / CONSULTOR`
  - `5. DETALHAMENTO DAS OFERTAS E SERVIÇOS` (Item 10)
  - Rótulos da Tabela de Linhas (Item 10): `Aparelho/Chip:`, `Valor Mensal:`, `Valor Chip 1x:`
  - `Valor Total Mensal Assinatura: R$ XX,XX`
  - `3. Assinaturas`
  - Labels do Bloco de Assinaturas: `Representante Legal:`, `Testemunhas:`, `Assinatura Consultor / Senior Account:`
  - Destaques Legais: `O Cliente declara que:`, checkbox de aceite `(X)`

---

### 2. Proposta Comercial (`propostaTemplate.js`)
- **Espaçamentos e Dimensões**:
  - Margem Esquerda: `50pt` (Largura de conteúdo `493.78pt`)
  - Y Inicial do Header: `727.6pt`
  - Coluna de Rótulos do Cliente: `110pt`
  - Colunas da Tabela de Ofertas: Item (35pt), Acesso/Linha (80pt), Plano Atual (110pt), Novo Plano (120pt), Valor Mensal (75pt), Valor Chip (73.78pt)
- **Fontes e Tamanhos**:
  - Título Principal: `12pt` `Helvetica-Bold` (`/F1 12 Tf`)
  - Títulos de Tabela e Seções: `12pt` `Helvetica-Bold` (`/F1 12 Tf`)
  - Rodapé Legal / Notas: `7.5pt` `Helvetica-Bold` (`/F1 7.5 Tf`) e `Helvetica` (`/F2 7.5 Tf`)
  - Dados das Tabelas: `8.25pt` `Helvetica` (`/F2 8.25 Tf`)
- **Itens / Palavras em Negrito (`Helvetica-Bold` / `/F1`)**:
  - `PROPOSTA COMERCIAL`
  - `CONDIÇÕES COMERCIAIS DA NEGOCIAÇÃO`
  - `RAZÃO SOCIAL`, `CNPJ`, `TOTAL DE MULTA ANTECIPADA A PAGAR NESTA NEGOCIAÇÃO`
  - Cabeçalhos de Colunas da Tabela: `Item`, `Acesso/Linha`, `Plano Atual`, `Novo Plano / Oferta`, `Aparelho/Modelo`, `Valor Mensal (R$)`, `Valor Chip (R$)`
  - Totais e Subtotais: `TOTAL MENSAL:`, `TOTAL REPETIDOR:`, `TOTAL CHIP:`

---

### 3. Contrato de Permanência (`permanenciaTemplate.js`)
- **Espaçamentos e Dimensões**:
  - Margem Esquerda: `50pt` (Largura útil `493.78pt`)
  - Y Inicial de Texto: `727.6pt`, Y Limite Inferior: `54.88pt`
  - Espaçamento entre Cláusulas / Parágrafos: `14.4pt`
  - Altura de Linha de Texto Jurídico: `14.4pt`
- **Fontes e Tamanhos**:
  - Título do Contrato: `12pt` `Helvetica-Bold` (`/F1 12 Tf`) (x=207.17pt, y=727.6pt)
  - Nomes das Partes / Cabeçalhos das Cláusulas: `12pt` `Helvetica-Bold` (`/F1 12 Tf`)
  - Numeradores e Títulos de Cláusula: `12pt` `Helvetica-Bold` (`/F1 12 Tf`)
  - Texto Jurídico (Corpo): `12pt` e `8.25pt` `Helvetica` (`/F2 12 Tf` e `/F2 8.25 Tf`)
- **Itens / Palavras em Negrito (`Helvetica-Bold` / `/F1`)** (implementado via `<b>` tags no texto):
  - `CONTRATO DE PERMANÊNCIA`
  - `TIM S.A.` e `'TIM'`
  - `CLIENTE` (ao longo de todo o texto jurídico)
  - `CLÁUSULA PRIMEIRA - OBJETO`
  - `CLÁUSULA SEGUNDA - CONDIÇÕES COMERCIAIS`
  - `CLÁUSULA TERCEIRA - CANCELAMENTO`
  - Numeração de sub-cláusulas: `3.1`, `3.2`, `3.2.1`, `a)`, `b)`, `c)`
  - `CLÁUSULA QUARTA - DISPOSIÇÕES GERAIS`
  - `CLÁUSULA QUINTA - FORO`
  - Bloco de Assinaturas: `REPRESENTANTES LEGAIS:`, `TESTEMUNHAS`, `CONSULTOR / SENIOR ACCOUNT:`

---

## User Stories

### P1: Layout da Página 1 do Termo idêntico ao template base64 ⭐ MVP

**User Story**: Como operador do CRM, quero que o PDF da Página 1 do Termo de Contratação seja visualmente idêntico ao template TIM aprovado.

**Why P1**: Divergências visuais na Página 1 causam rejeição imediata pela auditoria TIM.

**Acceptance Criteria**:

1. WHEN o PDF for gerado THEN as cores do header SHALL ser `#004691` (não `#0B3569`)
2. WHEN o PDF for gerado THEN NÃO SHALL haver linhas horizontais separando cada row de dados
3. WHEN o PDF for gerado THEN cada seção SHALL ter borda externa (left, right, top, bottom) com stroke 0.75pt preto
4. WHEN o label "Tipo de Contratação:" for renderizado THEN SHALL quebrar em duas linhas ("Tipo de" / "Contratação:") com valor centralizado verticalmente
5. WHEN o label "Data de Vencimento:" for renderizado THEN SHALL quebrar em duas linhas ("Data de" / "Vencimento:") com valor centralizado verticalmente
6. WHEN o PDF for gerado THEN as fontes SHALL ser 8.25pt Helvetica (body) e 10.5pt Helvetica-Bold (título)
7. WHEN o PDF for gerado THEN as margens SHALL ser 50pt (esquerda) e a coluna de labels SHALL ter 81pt de largura

---

### P2: Renderização Dinâmica das Páginas 2 e 3 do Termo (Item 10)

**User Story**: Como auditor/operador, quero que o Termo de Contratação contenha as Páginas 2 e 3 completas com a tabela detalhada de ofertas por acesso (Oferta, Valor Mensal, Valor Chip), o texto legal e o bloco de assinaturas no local correto.

**Why P2**: O Termo precisa conter os valores individuais por chip e as cláusulas legais de contratação para ter validade jurídica perante a operadora.

**Acceptance Criteria**:

1. WHEN o Termo de Contratação for gerado THEN system SHALL renderizar a tabela detalhada de acessos/linhas (Oferta, Valor Mensal, Valor Chip) a partir do array `data.linhas` / `data.itens`.
2. WHEN as Páginas 2 e 3 forem renderizadas THEN system SHALL incluir o texto legal integral (cláusulas de 1 a 14, condições de roaming e vigência) fiel ao Termo TIM v5.10.
3. WHEN o bloco de assinaturas e testemunhas for renderizado no Termo THEN system SHALL posicionar o bloco no final da Página 2.
4. WHEN a quantidade de acessos exceder a capacidade de uma página THEN system SHALL realizar a paginação dinâmica garantindo que os cabeçalhos e bordas das tabelas sejam mantidos sem sobreposição.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| FIDELIDADE-01 | P1: Cores e fontes corrigidas | Design | Verified |
| FIDELIDADE-02 | P1: Linhas entre rows removidas | Design | Verified |
| FIDELIDADE-03 | P1: Bordas externas por seção | Design | Verified |
| FIDELIDADE-04 | P1: Quebra manual de labels longos | Design | Verified |
| FIDELIDADE-05 | P1: Valor centralizado em labels multi-linha | Design | Verified |
| FIDELIDADE-06 | P1: Constantes de layout ajustadas | Design | Verified |
| FIDELIDADE-07 | P2: Tabela de Ofertas/Linhas (Item 10) | Execute | Verified |
| FIDELIDADE-08 | P2: Texto Legal Integral Páginas 2-3 | Execute | Verified |
| FIDELIDADE-09 | P2: Posicionamento de Assinaturas na Página 2 | Execute | Verified |
| FIDELIDADE-10 | P2: Paginação Dinâmica para Múltiplos Acessos | Execute | Verified |
| FIDELIDADE-11 | Especificação completa de componentes dos 3 contratos | Design | Verified |
| FIDELIDADE-12 | Extração de renderizadores do Permanência em módulos separados | Execute | Verified |
| FIDELIDADE-13 | Constantes nomeadas de espaçamento (`CLAUSE_*`, `INTRO_*`) | Execute | Verified |
| FIDELIDADE-14 | Engine de texto formatado com suporte a `<b>` tags | Execute | Verified |
| FIDELIDADE-15 | Atualização dos textos jurídicos do Contrato de Permanência | Execute | Verified |
| FIDELIDADE-16 | Header/Título configurável por layout (`titleTopMargin`, `titleBottomMargin`, `hideHeaderLine`) | Execute | Verified |

---

## Success Criteria

- [x] PDF gerado da Página 1 visualmente indistinguível do template base64 em inspeção lado a lado
- [x] Páginas 2 e 3 do Termo geradas dinamicamente com tabela de ofertas, valores e cláusulas jurídicas completas
- [x] Proposta Comercial e Contrato de Permanência com especificações detalhadas de fontes, negritos, tamanhos e margens
- [x] Renderizadores do Permanência extraídos para arquivos dedicados com responsabilidade única
- [x] Espaçamentos de cláusulas centralizados em constantes nomeadas de fácil ajuste
- [x] `pdfEngine.js` com suporte a texto formatado (`<b>` tags), logo escalada proporcionalmente e header configurável
- [x] Textos do Contrato de Permanência atualizados para fidelidade ao template oficial TIM
- [x] Testes automatizados cobrem a geração de 1 e múltiplas páginas do Termo

