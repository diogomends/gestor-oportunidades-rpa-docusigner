# Tasks: Ajuste do Layout do Termo de Contratação PDF (`ajuste-termo-pdf`)

**Spec**: `.specs/features/ajuste-termo-pdf/spec.md`
**Status**: Executed (REQ-001 a REQ-005 implementados nos commits de 03 a 05/08/2026)
**Gate pendente**: validação visual final via `make test-pdf-html-generation` (T4.2)

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| gerador-pdf-html/submodules/termo | visual / E2E PDF | PDF gerado em `tmp/test-pdfs/termo.pdf` reflete imagem de referência | `tests/test-pdf-html-generation.js` | `make test-pdf-html-generation` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após edições nos arquivos do submódulo termo | `make test-pdf-html-generation` |
| Full | Validação final da geração de PDFs | `make test-pdf-html-generation` |

---

## Parallelism Assessment

| Phase / Task | Parallel-Safe? | Dependencies | Target Subagent Role |
| --- | --- | --- | --- |
| Phase 1 (HTML/CSS) | Yes | None | HTML/CSS Developer |
| Phase 2 (Service/Layout) | Yes (Parallel with Phase 1) | Shared contract specs | Node.js Backend Developer |
| Phase 3 (Test Mocks) | No | Requires Phase 1 & 2 | QA / Test Engineer |
| Phase 4 (Gate Check) | No | Requires Phase 3 | Verifier / PDF Inspector |

---

## Execution Plan

### Phase 1: Ajuste do Template HTML & Estilos CSS (`termoTemplate.html`)

```
T1.1 ──> T1.2
```

#### Task 1.1: Ajustar Estilos CSS e Remover Borda Superior de Aparelho/Chip
- **Arquivo:** `src/modules/gerador-pdf-html/submodules/termo/termoTemplate.html`
- **Requisitos:** REQ-001, REQ-004
- **Ação:**
  - Remover a classe `.aparelho-row` ou a propriedade `border-top` que exibia a linha horizontal sobre o bloco `Aparelho/Chip`.
  - Definir e ajustar estilos CSS de padding/margin da seção de Aparelho/Chip para alinhamento correto dos rótulos e valores.
- **Verification:** `make test-pdf-html-generation`

#### Task 1.2: Reestruturar Container Unificado em HTML/CSS
- **Arquivo:** `src/modules/gerador-pdf-html/submodules/termo/termoTemplate.html`
- **Requisitos:** REQ-002, REQ-005
- **Ação:**
  - Atualizar o container `.valor-total-box` para englobar dentro de um **único quadro com borda** (`border: 0.75pt solid #888`):
    - O título `Valor Total Mensal Assinatura: {{valorTotalTotal}}`
    - As 3 frases de notas explicativas (`Cobrança de chip em 1X...`, `Venda facilitada...`, `CMO = Comodato...`)
    - A pergunta e resposta do item 1 (consentimento de novas ofertas e serviços).
  - Garantir o respiro de margens e padding interno idênticos à captura de tela `tmp/Captura de tela 2026-07-29 104343.png`.
- **Verification:** `make test-pdf-html-generation`

---

### Phase 2: Ajuste do Service e Formatação dos Campos (`termoService.js` & `termoLayout.js`)

```
T2.1 ──> T2.2
```

#### Task 2.1: Mapear Estrutura de 3 Linhas do Aparelho/Chip no Service
- **Arquivos:**
  - `src/modules/gerador-pdf-html/submodules/termo/termoService.js`
  - `src/modules/gerador-pdf-html/submodules/termo/termoLayout.js`
- **Requisitos:** REQ-001
- **Ação:**
  - Atualizar a função de geração de `aparelhoChipRows` em `termoService.js` para renderizar a coluna central em 3 linhas verticalizadas (Linha 1: Aparelho ex: *Próprio*, Linha 2: Tipo do Chip ex: *Nano Chip*, Linha 3: Modalidade ex: *Venda à Vista 1x*).
  - Alinhar à direita a coluna de rótulos (`Valor Mensal:`, `Valor Chip 1x:`) e a coluna de valores (`R$ 0,00`, `R$ 7,00`).
- **Verification:** `make test-pdf-html-generation`

#### Task 2.2: Montar Interpolação de Placeholders do Quadro Unificado
- **Arquivo:** `src/modules/gerador-pdf-html/submodules/termo/termoService.js`
- **Requisitos:** REQ-002
- **Ação:**
  - Atualizar a geração da variável `valorTotalNotes` ou do HTML do quadro unificado para injetar os textos formatados e garantir que o bloco final seja renderizado de forma fluida.
- **Verification:** `make test-pdf-html-generation`

---

### Phase 3: Atualização do Script de Teste e Mocks (`tests/test-pdf-html-generation.js`)

```
T3.1
```

#### Task 3.1: Atualizar Payload de Teste em `test-pdf-html-generation.js`
- **Arquivo:** `tests/test-pdf-html-generation.js`
- **Requisitos:** REQ-003
- **Ação:**
  - Atualizar os campos de `dummyData` para refletir os valores da imagem de referência:
    - `aparelho: 'Próprio'`
    - `tipoChip: 'Nano Chip'`
    - `modalidadeVenda: 'Venda à Vista 1x'`
    - `valorChip: 'R$ 7,00'`
    - `valorTotalMensal: 'R$ 29,99'`
- **Verification:** `make test-pdf-html-generation`

---

### Phase 4: Execução do Gate Check & Validação Visual do PDF

```
T4.1 ──> T4.2
```

#### Task 4.1: Executar Compilação e Geração do PDF no Servidor Playwright
- **Comando:** `make test-pdf-html-generation`
- **Requisitos:** REQ-003
- **Ação:**
  - Executar o comando no ambiente dev e verificar que o PDF foi gerado sem erros e salvo em `tmp/test-pdfs/termo.pdf`.
- **Verification:** `make test-pdf-html-generation`

#### Task 4.2: Inspecionar e Validar o PDF Gerado (`tmp/test-pdfs/termo.pdf`)
- **Arquivo:** `tmp/test-pdfs/termo.pdf`
- **Requisitos:** REQ-001, REQ-002, REQ-004, REQ-005
- **Ação:**
  - Inspecionar a saída visual do PDF gerado comparando com `tmp/Captura de tela 2026-07-29 104343.png` para atestar a conformidade total do layout e encerramento da especificação.
- **Verification:** `make test-pdf-html-generation`
