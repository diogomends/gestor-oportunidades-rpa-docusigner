# Gerador PDF HTML — Tasks

**Design**: `.specs/features/gerador-pdf-html/design.md`
**Status**: Shipped

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| htmlRenderer | unit | Singleton browser, render HTML, Buffer válido | `tests/**/*.test.js` | `npm test` |
| Service Layer | unit | Substituição de placeholders, geração de rows HTML | `tests/**/*.test.js` | `npm test` |
| Route / Controller | integration | HTTP POST `/api/contracts/generate-pdf-html` | `tests/**/*.test.js` | `npm test` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit | Yes | Mocks diretos, sem I/O | `node --test` |
| integration | Yes | Supertest + mock do htmlRenderer | `node --test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tarefas de unidade | `npm test` |
| Full | Após tarefas de rotas/integração | `npm test` |
| Build | Após conclusão das fases | `npm test` |

---

## Execution Plan

### Phase 1: Infraestrutura (Sequential)

```
T1 → T2
```

### Phase 2: Templates HTML (Paralelo OK)

```
      ┌→ T3 [P] ─┐
T2 ──┼→ T4 [P] ─┼──→ T6
      └→ T5 [P] ─┘
```

### Phase 3: Integração (Sequential)

```
T6 → T7 → T8 → T9
```

---

## Task Breakdown

### T1: Criar estrutura de diretórios do módulo

**What**: Criar pastas vazias do módulo e de templates.
**Where**:
- `src/modules/gerador-pdf-html/`
- `src/modules/gerador-pdf-html/shared/`
- `src/modules/gerador-pdf-html/submodules/termo/`
- `src/modules/gerador-pdf-html/submodules/proposta/`
- `src/modules/gerador-pdf-html/submodules/permanencia/`
- `tmp/test-pdfs/templates/`

**Depends on**: None

**Done when**:
- [ ] Pastas criadas
- [ ] `index.js` barrel export vazio criado

---

### T2: Configurar Playwright como runtime dependency

**What**: Mover Playwright de `devDependencies` para `dependencies` no `package.json` e configurar Dockerfile.
**Where**: `package.json`, `Dockerfile`, `docker-compose*.yml`

**Depends on**: T1

**Done when**:
- [ ] `@playwright/test` movido para dependências de runtime (ou `playwright` adicionado como dep)
- [ ] `npx playwright install chromium` adicionado ao Dockerfile
- [ ] Container sobe sem erros

**Gate**: build

---

### T3: Criar template HTML do Termo

**What**: Criar `termo.html` com CSS TIM, tabelas de dados do cliente, tabela de itens e cláusulas.
**Where**: `tmp/test-pdfs/templates/termo.html`

**Depends on**: T1

**Data injetada** (vinda de `getTermoLayout(data)`):
- Cabeçalho: `{{title}}`
- Tabela cliente: `{{razaoSocial}}`, `{{cnpj}}`, `{{endereco}}`, `{{bairro}}`, `{{cidade}}`, `{{estado}}`, `{{cep}}`, `{{repNome}}`, `{{repCpf}}`
- Tabela contratação: `{{tipoContratacao}}`, `{{vencimento}}`, `{{tipoFatura}}`, `{{acessos}}`
- Tabela contato: `{{admTelefone}}`, `{{admEmail}}`
- Tabela produto: `{{ddd}}`, `{{tipoVenda}}`, `{{plano}}`, `{{aparelho}}`
- Observações: `{{observacoes}}`
- Tabela de itens: `{{tableRows}}` (loop montado no service)
- Cláusulas: `{{clauses}}` (parágrafos montados no service)
- Assinaturas: `{{signatures}}` (bloco montado no service)

**Done when**:
- [ ] Template renderiza corretamente no navegador com dados estáticos
- [ ] Placeholders posicionados nos locais corretos
- [ `@page` configurado para A4 com margens

---

### T4: Criar template HTML da Proposta

**What**: Criar `proposta.html` com layout comercial.
**Where**: `tmp/test-pdfs/templates/proposta.html`

**Depends on**: T1

**Done when**:
- [ ] Template renderiza corretamente no navegador
- [ ] Placeholders para dados comerciais e valores
- [ ] Layout responsivo A4

---

### T5: Criar template HTML da Permanência

**What**: Criar `permanencia.html` com parágrafos introdutórios, cláusulas, tabela de aditivo e assinaturas.
**Where**: `tmp/test-pdfs/templates/permanencia.html`

**Depends on**: T1

**Done when**:
- [ ] Parágrafos com texto justificado (`text-align: justify`)
- [ ] Cláusulas com títulos em negrito
- [ ] Tabela de aditivo com 7 colunas
- [ ] Bloco de assinaturas com testemunhas
- [ ] Placeholders para todos os campos dinâmicos

---

### T6: Criar CSS compartilhado dos templates

**What**: Criar `style.css` com cores TIM, tipografia e layout A4.
**Where**: `tmp/test-pdfs/templates/style.css`

**Depends on**: T1

**Conteúdo do CSS**:
- Cores TIM (`#004691`, `#FFFFFF`, etc.)
- `@page { size: A4; margin: 40px 50px; }`
- `table { width: 100%; border-collapse: collapse; }`
- `th { background: #004691; color: white; }`
- `td, th { padding: 4px 8px; border: 1px solid #ccc; }`
- `.clauses { text-align: justify; font-size: 10pt; }`
- `page-break-inside: avoid` em seções
- `@media print` com estilos otimizados

**Done when**:
- [ ] CSS importado por todos os templates HTML
- [ ] Cores TIM aplicadas consistentemente
- [ ] Quebras de página controladas

---

### T7: Criar htmlRenderer (Playwright singleton)

**What**: Criar `htmlRenderer.js` com instância singleton do Playwright.
**Where**: `src/modules/gerador-pdf-html/htmlRenderer.js`

**Depends on**: T2

**Especificação**:

```js
class HtmlRenderer {
  #browser = null;

  async #getBrowser() {
    if (!this.#browser) {
      this.#browser = await chromium.launch({ headless: true });
    }
    return this.#browser;
  }

  async render(html, options = {}) {
    const browser = await this.#getBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const buffer = await page.pdf({
      format: 'A4',
      margin: { top: '40px', bottom: '40px', left: '50px', right: '50px' },
      ...options,
    });
    await page.close();
    return Buffer.from(buffer);
  }

  async close() {
    if (this.#browser) await this.#browser.close();
  }
}
```

**Done when**:
- [ ] Singleton do browser implementado
- [ ] `render(html)` retorna Buffer com cabeçalho `%PDF`
- [ ] Fechamento graceful no `SIGTERM`
- [ ] Teste unitário com mock do Playwright

**Tests**: unit
**Gate**: quick

---

### T8: Criar services dos submodules

**What**: Criar `termoService.js`, `propostaService.js`, `permanenciaService.js` que montam HTML e chamam `htmlRenderer`.
**Where**:
- `src/modules/gerador-pdf-html/submodules/termo/termoService.js`
- `src/modules/gerador-pdf-html/submodules/proposta/propostaService.js`
- `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaService.js`

**Depends on**: T3, T4, T5, T7

**Padrão do service**:

```js
import { readFileSync } from 'fs';
import { getTermoLayout } from './termoLayout.js';
import { htmlRenderer } from '../../htmlRenderer.js';

const template = readFileSync('tmp/test-pdfs/templates/termo.html', 'utf-8');

export class TermoService {
  async generate(data) {
    const layout = getTermoLayout(data);
    let html = template;

    // Placeholders simples
    html = html.replace('{{title}}', layout.title);
    html = html.replace('{{razaoSocial}}', data.razaoSocial || '');
    // ... demais placeholders

    // Blocos dinâmicos montados como HTML
    const rows = layout.tableSections.find(s => s.headers)
      .rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    html = html.replace('{{tableRows}}', rows);

    const clauses = layout.clauses.map(c => `<p>${c}</p>`).join('');
    html = html.replace('{{clauses}}', clauses);

    return htmlRenderer.render(html);
  }
}
```

**Done when**:
- [ ] TermoService injeta dados do layout e retorna PDF
- [ ] PropostaService injeta dados e retorna PDF
- [ ] Permanencia tratado inline no Façade `service.js` via `generatePermanencia()`, sem service dedicado — lê template, substitui `{{var}}` e renderiza
- [ ] Placeholders não substituídos permanecem visíveis (debug)

**Tests**: unit
**Gate**: quick

---

### T9: Criar Façade Service, Controller, Routes e montagem em app.js

**What**: Criar `service.js` (Façade), `controller.js`, `routes.js` e montar em `app.js`.
**Where**:
- `src/modules/gerador-pdf-html/service.js`
- `src/modules/gerador-pdf-html/controller.js`
- `src/modules/gerador-pdf-html/routes.js`
- `src/app.js`

**Depends on**: T8

**Done when**:
- [ ] Service Façade roteia para o submodule correto por `type`
- [ ] Controller valida body com Zod e retorna `application/pdf`
- [ ] Rota `POST /api/contracts/generate-pdf-html` registrada com `authMiddleware`
- [ ] Módulo montado em `app.js`
- [ ] Teste de integração via supertest cobre happy path
- [ ] Teste de integração cobre erro 400 para type inválido
- [ ] Módulo `criador-contratos-pdf` original intacto (layouts copiados localmente)

**Tests**: unit + integration
**Gate**: full

---

### T13: Divisor independente e alinhamento vertical na Seção 2 do Termo

**What**: Separar a tabela da Seção 2 (DADOS DA CONTRATAÇÃO) em duas partes, inserir `<div>` com `border-bottom` como divisor independente entre elas, e alinhar verticalmente os valores dos 3 primeiros campos.

**Where**:
- `src/modules/gerador-pdf-html/submodules/termo/termoTemplate.html`

**Depends on**: T11

**Detalhes**:
- Tabela 1: 3 campos iniciais (Tipo de Contratação, Data de Vencimento, Tipo de Fatura) com `vertical-align:middle` nos valores
- Divisor: `<div style="border-bottom:0.75pt solid #888;">` filho direto da `<div class="section">` (fora da tabela)
- Tabela 2: demais campos (Qtd., DDD, etc.) com `margin-top:30px`

**Done when**:
- [x] Tabela da Seção 2 dividida em duas
- [x] Divisor `<div>` com `border-bottom` ocupa 100% da largura da seção
- [x] Valores dos 3 primeiros campos centralizados verticalmente
- [x] Espaçamento de 30px entre o divisor e a linha "Qtd."

**Tests**: visual (comparação com PDF gerado)
**Gate**: quick

---

### T10: Extrair layouts próprios para desacoplamento do módulo antigo

**What**: Copiar `getTermoLayout`, `getPropostaLayout`, `getPermanenciaLayout` e `getFileNameBase` para dentro do `gerador-pdf-html`, eliminando a dependência de `criador-contratos-pdf/submodules/*/`.

**Where**:
- `src/modules/gerador-pdf-html/shared/constants.js` (novo)
- `src/modules/gerador-pdf-html/submodules/termo/termoLayout.js` (novo)
- `src/modules/gerador-pdf-html/submodules/proposta/propostaLayout.js` (novo)
- `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaLayout.js` (novo)

**Depends on**: T3, T4, T5

**Changed imports**:
- `termoService.js`: `../../../criador-contratos-pdf/...` → `./termoLayout.js`
- `propostaService.js`: `../../../criador-contratos-pdf/...` → `./propostaLayout.js`
- `permanenciaService.js`: `../../../criador-contratos-pdf/...` → `./permanenciaLayout.js`

**Done when**:
- [x] `shared/constants.js` criado com `getFileNameBase` (sem pdf-lib) — **removido posteriormente**, constantes inlined nos consumers
- [x] `termoLayout.js` criado localmente com `getFileNameBase` e `TITLE_TERMO` inline
- [x] `propostaLayout.js` criado localmente com `getFileNameBase` e `TITLE_PROPOSTA` inline
- [x] `permanenciaLayout.js` **removido** — conteúdo estático movido para `permanenciaTemplate.html`, sem layout dedicado
- [x] Os 3 `*Service.js` importam do layout local, não do `criador-contratos-pdf`
- [x] Módulo `criador-contratos-pdf` removido após migração
- [x] `permanenciaService.js` removido — lógica inline no Façade `service.js`

---

### T11: Ajustar layout da página (tamanho, fontes, espaçamentos) conforme fidelidade PDF

**What**: Alinhar CSS, templates HTML e constantes do módulo `gerador-pdf-html` com as especificações do `ajuste-fidelidade-pdf-template/spec.md` (cores `#004691`, fontes Helvetica, tamanhos exatos em pt, espaçamentos, bordas externas sem grid interno).

**Where**:
- `submodules/*/*Template.html` (CSS inline nos templates)
- `src/modules/gerador-pdf-html/htmlRenderer.js` (margens em mm, constantes inline)

**Depends on**: T3, T4, T5, T6, T10

**Fonte**: `.specs/features/ajuste-fidelidade-pdf-template/spec.md` e `.specs/features/ajuste-fidelidade-pdf-template/design.md`

**Done when**:
- [x] CSS inline nos templates com `pt` em font-sizes
- [x] Bordas externas nas seções, sem bordas internas nas células
- [x] Font-sizes específicos por tipo de contrato (8.25pt Termo/Proposta, 12pt Permanência)
- [x] Label widths específicos (81pt Termo, 110pt Proposta)
- [x] Margens do Playwright centralizadas em `constants.js`

**Tests**: visual (comparação com templates base64)
**Gate**: quick

---

### T12: Refatorar constantes — centralizar em `shared/constants.js` e remover props mortas dos layouts

**What**: Consolidar todos os valores reutilizáveis em `shared/constants.js` (cores CSS, margens do renderizador, títulos, tipos de contrato, `getFileNameBase`) e remover propriedades de layout que não são mais consumidas por nenhum service (`defaultFontSize`, `type`, `justify`, `hideHeaderLine`, `titleTopMargin`, `titleBottomMargin`).

**OBS**: `shared/constants.js` foi removido posteriormente. As constantes foram inlined nos respectivos consumers (`htmlRenderer.js`, `controller.js`, `*Layout.js`) para eliminar acoplamento.

**Where** (historical):
- ~~`src/modules/gerador-pdf-html/shared/constants.js`~~ **removido**
- `src/modules/gerador-pdf-html/controller.js` (tipos inline)
- `src/modules/gerador-pdf-html/htmlRenderer.js` (margens inline)
- `submodules/termo/termoLayout.js` e `proposta/propostaLayout.js` (`getFileNameBase` + título inline)

**Motivação**: O HTML + CSS nos templates é a única fonte de verdade para apresentação. Props de layout do pdf-lib ficaram órfãs após a migração.

**Done when**:
- [x] `constants.js` exporta PDF render constants, títulos, tipos e `getFileNameBase` — depois removido, constantes inlined
- [x] Dead props removidas de `termoLayout.js`, `propostaLayout.js`
- [x] `permanenciaLayout.js` removido (conteúdo no template HTML)
- [x] `htmlRenderer.js` com constantes inline
- [x] `controller.js` com tipos inline
- [x] CSS do template controla 100% da apresentação

**Tests**: none (refatoração sem mudança de comportamento)
**Gate**: build
