# Propostas PDF — Tasks

## Execution Protocol

Implement these tasks with the `tlc-spec-driven` skill: activate it by name and follow its Execute flow and Critical Rules.

**Spec**: `.specs/features/propostas-pdf/spec.md`
**Status**: Executed (parcial) — pendências registradas em T6 (NÃO executar sem aprovação)

---

## Test Coverage Matrix

> Generated from codebase — confirm before Execute. Guidelines found: `AGENTS.md`, `.specs/features/modulo-gerador-pdf-html/tasks.md`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| htmlRenderer.js | none | Build gate only (visual regression) | — | `npm start` |
| termoLayout.js | none | No business logic change — layout data only | — | `npm start` |
| termoTemplate.html | none | Visual/CSS only — verify via generation | — | `make test-pdf-html-generation` |
| termoService.js | none | Template string ops only — no new logic | — | `npm start` |

**Note**: Todas as mudanças são puramente visuais/layout (CSS, HTML, constantes). Não há nova lógica de negócio que exija testes unitários. A verificação é visual via `make test-pdf-html-generation`.

## Parallelism Assessment

> All tasks touch different files — fully parallel-safe at implementation level.

| Task | Parallel-Safe? | Isolation Model | Evidence |
| ---- | -------------- | --------------- | -------- |
| T1 | Yes | File-level isolated | Different file |
| T2 | Yes | File-level isolated | Different file |
| T3 | Yes | File-level isolated | Different file |
| T4 | No (depends on T2) | Sequential | T3 modifies layout used by T4 |
| T5 | No (depends on T2, T3) | Sequential | T5 uses layout + template |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After any task | `npm run dev` (check no crash) |
| Full | After all tasks | `make test-pdf-html-generation` (visual verify) |

---

## Execution Plan

```
Phase 1 (Parallel):
  T1 ──→ (done)
  T2 ──→ (done)

Phase 2 (Sequential after T2):
  T2 ──→ T3
  T2 ──→ T4

Phase 3 (Sequential after T3, T4):
  T3 ──┐
       ├──→ T5
  T4 ──┘
```

### Phase 1: Foundation (Parallel)

### T1: Atualizar Margens Padrão no htmlRenderer

**What**: Alterar constantes de margem no singleton HtmlRenderer para os valores do spec
**Where**: `src/modules/gerador-pdf-html/htmlRenderer.js:4-7`
**Depends on**: None
**Reuses**: Existing pattern (permanencia/proposta sobrescrevem inline)

**Requirement**: PROPOSTAS-PDF-01, PROPOSTAS-PDF-02

**Done when**:
- [x] `PDF_MARGIN_TOP` alterado de `"18mm"` para `"12.7mm"`
- [x] `PDF_MARGIN_BOTTOM` alterado de `"14mm"` para `"26.27mm"`
- [x] `PDF_MARGIN_LEFT` alterado de `"18mm"` para `"17.64mm"`
- [x] `PDF_MARGIN_RIGHT` alterado de `"18mm"` para `"17.64mm"`
  - **Implementado**: `htmlRenderer.js:4-7` (constantes padrão do singleton). O Termo sobrescreve `margin` inline (ver T6).

**Tests**: none
**Gate**: quick

---

### T2: Simplificar Estrutura de Seções no termoLayout

**What**: Fundir seções extras nas principais: admTelefone/admEmail → seção 1; ddd/tipoVenda/plano/aparelho → seção 2; observações como label simples (não seção própria)
**Where**: `src/modules/gerador-pdf-html/submodules/termo/termoLayout.js`
**Depends on**: None
**Reuses**: Existing section/row pattern

**Requirement**: PROPOSTAS-PDF-05, PROPOSTAS-PDF-06, PROPOSTAS-PDF-07

**Done when**:
- [x] `tableSections` array reduzido para ~4 seções (não 7)
- [x] Seção "DADOS DE CONTATO ADMINISTRATIVO" removida (campos movidos para seção 1)
- [x] Seção "DADOS DO PRODUTO / SERVIÇO" removida (campos movidos para seção 2)
- [x] Seção "OBSERVAÇÕES E CONDIÇÕES DA OFERTA" convertida para campo simples
- [x] Seção 10 "DETALHAMENTO DE ACESSOS" mantida como seção autônoma
- [x] Seção "ASSINATURAS E ACEITE" atualizada para suportar 3 signers + consultor
  - **Implementado (abordagem divergente da spec)**: `tableSections` foi **removida** de `termoLayout.js` (agora apenas `title/fileName/data/rawLinhas/clauses`). A estrutura de ~4 blocos é conduzida pelo template (`termoTemplate.html`: Seção 1, Seção 2, Assinaturas, Cliente declara) e pelo `termoService`. Resultado atende os critérios P3 da spec.

**Tests**: none
**Gate**: quick

---

### Phase 2: Core Implementation (Sequential after T2)

### T3: Atualizar Template HTML do Termo

**What**: Restruturar termoTemplate.html: remover seções fundidas, atualizar `@page margin`, corrigir título (12pt underline), remover `.header` estático, reformatar bloco de assinaturas para vertical, remover page-break forçado
**Where**: `src/modules/gerador-pdf-html/submodules/termo/termoTemplate.html`
**Depends on**: T2 (estrutura de seções definida)
**Reuses**: Existing CSS patterns

**Requirement**: PROPOSTAS-PDF-04, PROPOSTAS-PDF-05, PROPOSTAS-PDF-06, PROPOSTAS-PDF-07, PROPOSTAS-PDF-08

**Done when**:
- [ ] `@page margin` alterado para `12.7mm 17.64mm 26.27mm 17.64mm` *(atual: `37mm 17.64mm 10mm 17.64mm` — bottom 10mm, ver T6)*
- [x] `.header` estático removido (logo via headerTemplate do Playwright)
- [ ] Título alterado para `font-size: 12pt` com `text-decoration: underline` *(atual: 11pt sem underline, ver T6)*
- [x] Seções 3, 4, 5 removidas do HTML (conteúdo realocado)
- [x] Bloco de assinaturas atualizado para layout vertical com 3 campos
- [x] `page-break-before` removido das seções (fluxo livre)

**Tests**: none
**Gate**: quick

---

### T4: Adicionar Logo TIM via HeaderTemplate no termoService

**What**: Fazer termoService usar `displayHeaderFooter: true` + `headerTemplate` com logo TIM (shared/logo.png) igual permanencia/proposta fazem em service.js
**Where**: `src/modules/gerador-pdf-html/submodules/termo/termoService.js`
**Depends on**: T2 (para estrutura final)
**Reuses**: `readFileSync(LOGO_PATH)` pattern de `service.js`

**Requirement**: PROPOSTAS-PDF-01, PROPOSTAS-PDF-02, PROPOSTAS-PDF-03

**Done when**:
- [x] Logo lida como base64 de `shared/logo.png`
- [x] `htmlRenderer.render()` chamado com `displayHeaderFooter: true` + `headerTemplate`
- [x] Margem superior do render definida para `"37mm"` (início do corpo abaixo do logo)
- [ ] Margens left/right/bottom herdadas do htmlRenderer (spec) *(Termo sobrescreve com `margin: { top: "37mm", bottom: "10mm" }` — bottom ≠ 26.27mm, ver T6)*
- [x] Servidor não quebra ao gerar termo

**Tests**: none
**Gate**: quick

---

### Phase 3: Signature Generation Update

### T5: Atualizar Geração de Assinaturas no termoService

**What**: Alterar geração do HTML de assinaturas para layout vertical com 3 signers (Representante Legal + Testemunha 1 + Testemunha 2) + bloco de informações do consultor (seniorAccount, cnpjAccount, consultorNome, consultorCpf)
**Where**: `src/modules/gerador-pdf-html/submodules/termo/termoService.js`
**Depends on**: T2 (layout com dados de signature atualizados), T3 (template com espaço para assinaturas)
**Reuses**: signature-section pattern

**Requirement**: PROPOSTAS-PDF-08, PROPOSTAS-PDF-09, PROPOSTAS-PDF-10

**Done when**:
- [x] Assinaturas renderizadas em layout vertical (não horizontal)
- [x] 3 campos de assinatura gerados: Representante Legal, Testemunha 1, Testemunha 2
- [x] Informações do consultor exibidas abaixo das assinaturas
- [ ] CPFs renderizados em fonte menor #666 conforme spec *(não há cor/size #666 — `.sig-info` usa padrão 8.5pt, ver T6)*
- [ ] `make test-pdf-html-generation` gera PDF sem erros *(gate final a rodar)*

**Tests**: none
**Gate**: full

---

### T6: Pendências do Ajuste do Termo (REGISTRADA — NÃO EXECUTAR sem aprovação)

**What**: Concluir os itens divergentes da spec no submódulo `termo`
**Where**: `src/modules/gerador-pdf-html/submodules/termo/` (`termoTemplate.html`, `termoService.js`)
**Depends on**: decisão de margem (T6.1)

**T6.1 — Conflito de margem inferior**: A spec (P1/AC1 e `@page`) exige `bottom: 26.27mm`, porém `termoService.js:459` sobrescreve com `margin: { top: "37mm", bottom: "10mm" }` e `termoTemplate.html:8` usa `@page margin: 37mm 17.64mm 10mm 17.64mm`. O valor `10mm` é **decisão deliberada** da **AD-046** (correção de microestouro de margem no rodapé). Decidir: manter 10mm (e atualizar a spec) ou aplicar 26.27mm (e revalidar bordas/rodapé).

**T6.2 — Título**: Aplicar `font-size: 12pt` + `text-decoration: underline` no `.title` de `termoTemplate.html:25` (atual 11pt sem underline).

**T6.3 — CPFs das assinaturas**: Aplicar fonte menor `#666` nos CPFs dos blocos de assinatura em `termoService.js:371-419`.

**T6.4 — Gate final**: Rodar `make test-pdf-html-generation` e validar visualmente o `termo.pdf` antes de fechar a spec.

**Done when**:
- [ ] T6.1 resolvido (spec alinhada ao comportamento real OU margem alterada com revalidação)
- [ ] T6.2 título 12pt bold underline
- [ ] T6.3 CPFs em `#666`/fonte menor
- [ ] T6.4 `make test-pdf-html-generation` OK e validação visual

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: htmlRenderer margins | 4 constants, 1 file | ✅ Granular |
| T2: termoLayout sections | Section data restructuring, 1 file | ✅ Granular |
| T3: termoTemplate HTML | Template + CSS, 1 file | ✅ Granular |
| T4: termoService header | Logo + render options, 1 file | ✅ Granular |
| T5: termoService signatures | Signature HTML gen, 1 file | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Root of Phase 1 | ✅ Match |
| T2 | None | Root of Phase 1 | ✅ Match |
| T3 | T2 | After T2 in Phase 2 | ✅ Match |
| T4 | T2 | After T2 in Phase 2 | ✅ Match |
| T5 | T2, T3, T4 | After T3, T4 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | htmlRenderer.js | none | none | ✅ OK |
| T2 | termoLayout.js | none | none | ✅ OK |
| T3 | termoTemplate.html | none | none | ✅ OK |
| T4 | termoService.js | none | none | ✅ OK |
| T5 | termoService.js | none | none | ✅ OK |
