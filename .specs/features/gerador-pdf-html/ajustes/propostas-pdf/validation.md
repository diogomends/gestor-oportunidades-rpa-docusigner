# Propostas PDF — Validação

**Data**: 2026-07-28
**Spec**: `.specs/features/propostas-pdf/spec.md`
**Diff range**: 4 arquivos alterados (htmlRenderer.js, termoLayout.js, termoTemplate.html, termoService.js)
**Verifier**: independent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | Constantes de margem atualizadas para spec |
| T2   | ✅ Done | Seções fundidas: 7 → 4, 3 signers + consultor |
| T3   | ✅ Done | Template reestruturado, título 12pt underline, sem page-break |
| T4   | ✅ Done | Logo TIM via headerTemplate, margin top 37mm |
| T5   | ✅ Done | Assinaturas verticais 3 campos + bloco consultor |

---

## Spec-Anchored Acceptance Criteria

### P1: Margens e Header do PDF Alinhados ao Spec

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| WHEN termo gerado THEN margens top=12.7mm, bottom=26.27mm, left=17.64mm, right=17.64mm | Margem top do corpo 12.7mm (sem header); com header usa 37mm top + 12.7mm padding logo | `htmlRenderer.js:4-7` — constantes atualizadas; `termoTemplate.html:6` — @page margin fallback; `termoService.js:100` — margin top 37mm | ✅ PASS |
| WHEN termo gerado THEN logo TIM em TODAS as páginas | Logo base64 renderizada em todas as páginas via headerTemplate do Playwright | `termoService.js:93-99` — `displayHeaderFooter: true` + `headerTemplate` com logo base64 | ✅ PASS |
| WHEN termo gerado THEN primeiro texto a 37mm do topo | Body inicia a 37mm da borda superior da página | `termoService.js:100` — `margin: { top: '37mm' }`; `termoTemplate.html:9` — titulo com `margin-top: 0` | ✅ PASS |

### P2: Tipografia do Título Corrigida

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| WHEN termo gerado THEN título 12pt bold underline | font-size: 12pt, font-weight: bold, text-decoration: underline | `termoTemplate.html:9` — `.title { font-size: 12pt; font-weight: bold; text-decoration: underline }` | ✅ PASS |

### P3: Estrutura de Seções Simplificada

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| WHEN termo gerado THEN admTelefone/admEmail na seção 1 | Campos na seção IDENTIFICAÇÃO DO CLIENTE CONTRATANTE | `termoLayout.js:46-47` — linhas de dados; `termoTemplate.html:37-38` — templates HTML | ✅ PASS |
| WHEN termo gerado THEN ddd/tipoVenda/plano/aparelho na seção 2 | Campos na seção DADOS DA CONTRATAÇÃO | `termoLayout.js:57-60` — linhas de dados; `termoTemplate.html:57-60` — templates HTML | ✅ PASS |
| WHEN termo gerado THEN observações como campo simples (não seção própria) | Campo na seção 2, sem seção própria | `termoLayout.js:61` — linha de Observações na seção 2; `termoTemplate.html:61` — template como linha simples | ✅ PASS |

### P4: Bloco de Assinaturas Vertical com 3 Campos + Consultor

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| ------------------------- | -------------------- | ----------------------- | ------ |
| WHEN termo gerado THEN assinaturas em layout vertical | CSS: block layout (sem flex), cada signer em `.signature-item` com margin-top | `termoTemplate.html:22-24` — `.signature-item { margin-top: 40px }` (vertical stack); `termoService.js:69-71` — geração sem wrapper flex | ✅ PASS |
| WHEN termo gerado THEN 3 campos de assinatura (Rep Legal + 2 Testemunhas) | 3 signers no array signatures | `termoLayout.js:67-69` — 3 entries: Representante Legal, Testemunha 1, Testemunha 2 | ✅ PASS |
| WHEN termo gerado THEN informações do consultor exibidas | seniorAccount, cnpjAccount, consultorNome, consultorCpf em bloco separado abaixo das assinaturas | `termoLayout.js:71-76` — objeto consultant; `termoService.js:74-86` — geração HTML com filtro de campos preenchidos | ✅ PASS |

**Status**: ✅ Todas 10 ACs cobertas com evidência `file:line`

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `htmlRenderer.js:4` | MARGIN_TOP "12.7mm" → "18mm" | ⚠️ Not killable — visual-only, sem testes automatizados |
| 2 | `termoService.js:97` | Removido `displayHeaderFooter: true` | ⚠️ Not killable — gate passa sem header |
| 3 | `termoTemplate.html:9` | Título font-size 12pt → 10pt | ⚠️ Not killable — gate passa com qualquer font-size |

**Sensor depth**: lightweight (3 behavior-level mutations)
**Result**: ⚠️ 3/3 sobreviveram — esperado para feature puramente visual (tasks.md define testes como "none" para todos os arquivos). Verificação confia em `make test-pdf-html-generation` como build gate + análise visual de PDF.

---

## Gate Check

- **Gate command**: `make test-pdf-html-generation`
- **Result**: 3 PDFs gerados (termo 70.81 KB, proposta 55.06 KB, permanencia 86.10 KB) — sem erros
- **Test count**: N/A (geração de PDF, sem testes unitários)

---

## Code Quality

| Principle | Status | Notes |
| --------- | ------ | ----- |
| Minimum code | ✅ | 4 arquivos, ~80 linhas alteradas |
| Surgical changes | ✅ | Apenas submódulo termo afetado |
| No scope creep | ✅ | Sem alterações em proposta/permanencia |
| Matches patterns | ✅ | headerTemplate segue padrão service.js; layout segue padrão existente |
| No unused code | ✅ | Todas as sections do layout são usadas no template |
| Spec-anchored outcome check | ✅ | Todas 10 ACs rastreadas a file:line |
| Documented guidelines followed | ✅ | AGENTS.md — ES Modules, SOLID |

---

## Observação Técnica

**htmlRenderer margin shallow-merge**: O método `render()` em `htmlRenderer.js:27-31` faz spread top-level de `options`, substituindo o objeto `margin` inteiro em vez de deep-merge. Isso significa que quando um caller passa `margin: { top: '37mm' }`, os defaults de left/right/bottom são perdidos (substituídos pelo objeto parcial). No caso do termo, o fallback vem do CSS `@page` no template (`termoTemplate.html:6`), que mantém os valores corretos (`17.64mm / 17.64mm / 26.27mm`). **Não é um bug para este feature**, mas se o `@page` fosse removido ou valores divergissem, as margens laterais e inferior ficariam em 0 (default do Playwright/Chromium). Para robustez futura, considere deep-merge do objeto `margin` no `htmlRenderer.render()`.

---

## Requirement Traceability Update

| Requirement ID | Story | Status |
| -------------- | ----- | ------ |
| PROPOSTAS-PDF-01 | P1: Margens e Header do PDF | ✅ Verified |
| PROPOSTAS-PDF-02 | P1: Margens e Header do PDF | ✅ Verified |
| PROPOSTAS-PDF-03 | P1: Margens e Header do PDF | ✅ Verified |
| PROPOSTAS-PDF-04 | P2: Tipografia do Título | ✅ Verified |
| PROPOSTAS-PDF-05 | P3: Estrutura Simplificada | ✅ Verified |
| PROPOSTAS-PDF-06 | P3: Estrutura Simplificada | ✅ Verified |
| PROPOSTAS-PDF-07 | P3: Estrutura Simplificada | ✅ Verified |
| PROPOSTAS-PDF-08 | P4: Assinaturas Verticais | ✅ Verified |
| PROPOSTAS-PDF-09 | P4: Assinaturas Verticais | ✅ Verified |
| PROPOSTAS-PDF-10 | P4: Assinaturas Verticais | ✅ Verified |

---

## Success Criteria

- [x] PDF gerado do termo tem margens e logo consistentes com o spec
- [x] Título do termo em 12pt bold underline
- [x] Estrutura de seções simplificada (fundidas)
- [x] Assinaturas em layout vertical com 3 campos + consultor
- [x] Sem page-breaks forçados (fluxo livre)

---

## Summary

**Overall**: ✅ PASS

**Spec-anchored check**: 10/10 ACs matched spec outcome, 0 precision gaps
**Sensor**: 0/3 killed (expected — visual-only feature, no automated regression tests)
**Gate**: `make test-pdf-html-generation` — 3 PDFs gerados sem erro

**What works**: Margens spec, logo em todas páginas, título 12pt underline, seções consolidadas (7→4), assinaturas verticais 3 campos + consultor, fluxo livre sem page-break.

**Issues found**: Nenhum issue bloqueante. Observação sobre shallow merge do `margin` no `htmlRenderer.render()` (ver seção Observação Técnica). Não afeta o feature atual.

**Next steps**: Nenhum — feature completo.
