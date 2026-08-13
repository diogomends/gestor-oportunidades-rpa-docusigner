# 📄 Especificações de Design dos PDFs — Relatório de Replicação

Arquivo JSON gerado: [`pdf_design_specs.json`](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/tmp/test-pdfs/templates/pdf_design_specs.json)

---

## 📐 Dimensões e Formato de Página

| Documento | Páginas | Formato | Largura | Altura |
|-----------|---------|---------|---------|--------|
| permanencia | 5 | A4 | 209.9 mm / 595 pt | 297.04 mm / 842 pt |
| proposta | 2 | A4 | 209.9 mm / 595 pt | 297.04 mm / 842 pt |
| termo | 3 | A4 | 209.9 mm / 595 pt | 297.04 mm / 842 pt |

---

## 📏 Margens (medidas do texto extremo — página 1)

| Documento | Esquerda | Direita | Superior | Inferior |
|-----------|----------|---------|----------|---------|
| permanencia | 17.64 mm / 50 pt | 17.17 mm / 48.67 pt | 37.0 mm / 104.88 pt | 26.27 mm / 74.48 pt |
| proposta | 17.64 mm / 50 pt | ~17 mm | ~37 mm | ~27 mm |
| termo | 17.64 mm / 50 pt | ~17 mm | ~37 mm | ~27 mm |

> [!NOTE]
> A margem superior reportada (37 mm) é a posição do **primeiro texto** (abaixo do logo). A margem real da página começa em ~12.7 mm (topo do logo).

---

## 🖼️ Logo / Cabeçalho

### Permanência (e padrão para todos os docs)

| Propriedade | Valor |
|-------------|-------|
| Presente em todas as páginas | ✅ Sim |
| Posição X (esquerda) | 17.64 mm |
| Posição Y (distância do topo) | **12.7 mm** |
| Largura | 174.19 mm |
| Altura | 12.35 mm |
| Borda inferior (y_end) | **25.05 mm** |

### Distância Logo → Primeiro Texto (por página)

| Documento | Pág 1 | Pág 2 | Pág 3 | Pág 4 | Pág 5 |
|-----------|-------|-------|-------|-------|-------|
| permanencia | **11.95 mm** | 11.95 mm | 12.5 mm | 11.95 mm | 11.95 mm |
| proposta | — | — | — | — | — |
| termo | — | — | — | — | — |

---

## 🔤 Tipografia

### Permanência

| Fonte | Negrito | Itálico | Tamanho | Uso | Páginas |
|-------|---------|---------|---------|-----|---------|
| `Helvetica` | ❌ | ❌ | **12 pt** (4.23 mm) | Corpo principal | 1–5 |
| `Helvetica-Bold` | ✅ | ❌ | **12 pt** (4.23 mm) | Títulos, cláusulas, negritos | 1–5 |
| `Helvetica` | ❌ | ❌ | **8.2 pt** (2.89 mm) | Tabela de permanência | 3 |
| `Helvetica-Bold` | ✅ | ❌ | **8.2 pt** (2.89 mm) | Cabeçalho de tabela | 3 |

> [!IMPORTANT]
> **Fonte principal**: Helvetica / Helvetica-Bold — tamanho único de **12 pt** para todo o corpo.
> Apenas a tabela do Aditivo usa fonte menor: **8.2 pt** (corpo) e **8.2 pt bold** (cabeçalho).

---

## 📏 Espaçamentos

### Permanência

| Tipo de Espaço | Valor (pt) | Valor (mm) |
|----------------|-----------|-----------|
| Entre linhas do mesmo parágrafo (leading) | **1.89 pt** | 0.67 mm |
| Gap entre parágrafos (média) | **19.05 pt** | 6.72 mm |
| Gap antes de cláusula (média) | **24.45 pt** | 8.63 mm |
| Título → Primeiro parágrafo | ~34.88 pt | ~12.3 mm |
| Entre parágrafos numerados (ex: 1.1, 1.2) | ~16–20 pt | 5.6–7.0 mm |

> [!NOTE]
> `line-height` efetivo: fonte 12 pt + gap 1.89 pt = **~13.89 pt total por linha** ≈ `line-height: 1.16` em CSS.
> Em CSS pt: `margin-bottom: ~8pt` entre parágrafos numerados, `margin-top: ~12pt` antes de cláusulas.

---

## 📋 Elementos do Documento — Permanência (posições página 1)

| Elemento | Tipo | Top (mm) | Bottom (mm) | Font | Negrito | Gap anterior (mm) |
|----------|------|----------|-------------|------|---------|------------------|
| `CONTRATO DE PERMANÊNCIA` | title | 37.0 | 41.23 | Helvetica-Bold 12pt | ✅ | — |
| `Pelo presente instrumento...` (§1) | paragraph | 53.54 | 57.77 | Helvetica 12pt | ❌ | 12.3 |
| `Neto, nº 850, bloco 01...` (cont.) | paragraph | 58.62 | 62.85 | Helvetica 12pt | ❌ | 0.85 |
| `inscrita no CNPJ/MF...` (cont.) | paragraph | 63.70 | 67.93 | Helvetica 12pt | ❌ | 0.85 |
| `'TIM'.` (cont.) | paragraph | 68.78 | 73.01 | Helvetica-Bold 12pt | ✅ | 0.85 |
| `E, de outro lado, o CLIENTE...` (§2) | paragraph | 80.03 | 84.26 | Helvetica 12pt | ❌ | 7.02 |
| `As Partes resolvem celebrar...` (cont.) | paragraph | 85.11 | 89.34 | Helvetica 12pt | ❌ | 0.85 |
| `condições:` (cont.) | paragraph | 90.19 | 94.42 | Helvetica 12pt | ❌ | 0.85 |
| **`CLÁUSULA PRIMEIRA - OBJETO`** | **clause_header** | **101.44** | **105.67** | **Helvetica-Bold 12pt** | ✅ | **7.01** |
| `1.1 O presente Contrato tem por objeto...` | numbered_item | 112.69 | 116.92 | Helvetica 12pt | ❌ | 7.02 |

### Cláusulas — Distâncias

| Cláusula | Página | Top (mm) | Gap do elemento anterior (mm) |
|----------|--------|----------|-------------------------------|
| CLÁUSULA PRIMEIRA - OBJETO | 1 | 101.44 | 7.01 |
| CLÁUSULA SEGUNDA - CONDIÇÕES COMERCIAIS | 2 | — | ~7 |
| CLÁUSULA TERCEIRA - CANCELAMENTO | 2 | — | ~7 |
| CLÁUSULA QUARTA - DISPOSIÇÕES GERAIS | 4 | 79.82 | 7.02 |
| CLÁUSULA QUINTA - FORO | 4/5 | — | ~7 |

---

## 🎨 Tabela de Permanência (Aditivo)

| Propriedade | Valor |
|-------------|-------|
| Borda | 0.75 pt solid #000 |
| Cabeçalho cor de fundo | `#004691` (azul TIM) |
| Cabeçalho cor texto | `#ffffff` |
| Padding cabeçalho | 5px 8px |
| Fonte cabeçalho | Helvetica-Bold 7–8.25 pt |
| Fonte corpo tabela | Helvetica 8 pt |
| Padding célula corpo | 4px 8px |
| Alinhamento | center |
| Colunas | Aditivo | Plano/Pacote | Valor Sem Perm | Valor Com Perm | Benefício | Multa/mês | Tempo |

---

## ✍️ Bloco de Assinaturas

| Propriedade | Valor |
|-------------|-------|
| Borda caixa | 0.75 pt solid #000 |
| Padding interno | 10px |
| Linha de assinatura | border-top: 1px solid #000 |
| Espaço acima da linha | margin-top: 40px |
| Fonte nome assinante | 14 pt, bold |
| Fonte CPF/info | 10 pt, color: #666 |
| Fonte razão social | 11 pt |
| Layout | flex, gap: 30px |
| Data/local | 14 pt, margin-bottom: 20px |

---

## 📋 CSS de Replicação (Resumo)

```css
/* Corpo do documento */
body {
  font-family: "Helvetica", "Arial", sans-serif;
  font-size: 12pt;
  color: #1a1a1a;
  line-height: 1.4;
  padding: 26pt 0 40pt;
}

/* Margens da página (para Playwright PDF) */
/* @page: margin: 12.7mm 17.64mm 26.27mm 17.64mm */
/* Equivalente: top=12.7mm left=right=17.64mm bottom=26.27mm */

/* Título do contrato */
h1 {
  text-align: center;
  font-size: 12pt;
  font-weight: bold;
  text-decoration: underline;
  margin: 20pt 0 26pt;
}

/* Cabeçalho de cláusula */
h3 {
  font-weight: bold;
  font-size: 12pt;
  margin-top: 12pt;
  margin-bottom: 12pt;
}

/* Parágrafo corpo */
p {
  text-align: justify;
  font-size: 12pt;
  margin-bottom: 4pt;
}

/* Tabela do Aditivo */
.table-header {
  background-color: #004691;
  color: #ffffff;
  padding: 5px 8px;
  font-size: 7pt;
  font-weight: bold;
  text-align: center;
}

.table-cell {
  padding: 4px 8px;
  font-size: 8pt;
  text-align: center;
}
```

---

## 🔍 Arquivos de Saída

| Arquivo | Descrição |
|---------|-----------|
| [`pdf_design_specs.json`](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/tmp/test-pdfs/templates/pdf_design_specs.json) | Especificações completas (180 KB) |
| [`pdf_specs_clean.json`](file:///C:/Users/Convidade/.gemini/antigravity-ide/brain/bc0b4e52-88a9-4309-bce7-eb78b9bd5b62/pdf_specs_clean.json) | Dados brutos por página (225 KB) |

---

## Alterações Estruturais — Termo Template

### Seção 2 (DADOS DA CONTRATAÇÃO)

Para garantir linha divisória independente entre "Tipo de Fatura" e "Qtd.", a tabela única foi dividida em duas, com `<div style="border-bottom:0.75pt solid #888;">` como filho direto da seção. Os 3 primeiros campos (`vertical-align:middle`) ficam na primeira tabela; os demais na segunda com `margin-top:30px`.
