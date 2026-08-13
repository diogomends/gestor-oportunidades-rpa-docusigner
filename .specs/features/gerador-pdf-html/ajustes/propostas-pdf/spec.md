# Propostas PDF — Ajuste do Submódulo Termo

## Problem Statement

O submódulo `termo` do módulo `gerador-pdf-html` atualmente não segue as especificações de design extraídas dos PDFs originais da TIM. As margens, logo, tipografia, estrutura de seções e bloco de assinaturas divergem do padrão documentado em `pdf_design_specs.json` e nas referências de análise (`analise-termo.md`, `analise-termo.json`). Isso resulta em PDFs gerados com aparência diferente dos documentos oficiais.

## Goals

- [ ] Alinhar margens e header (logo TIM) do termo ao design system especificado *(bottom divergente — ver T6.1/AD-046)*
- [ ] Ajustar tipografia do título para 12pt bold underline conforme original *(T6.2 pendente)*
- [x] Simplificar estrutura de seções para espelhar o PDF original (3 seções principais)
- [x] Reformatar bloco de assinaturas para layout vertical com 3 campos + consultor
- [x] Remover page-breaks forçados (fluxo livre conforme tamanho da tabela)

## Out of Scope

| Item | Razão |
| ---- | ----- |
| Alteração nos templates `proposta` e `permanencia` | Escopo deliberado apenas no submódulo `termo` |
| Mudanças no schema/banco de dados | Feature puramente visual/de template |
| Alterações no frontend | Geração 100% server-side |
| Criação de novos placeholders ou campos | Apenas ajuste dos existentes |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Estrutura de seções | Simplificar para 3 seções + cláusulas + tabela | Original PDF tem 3 seções numeradas; seções extras removidas | y |
| Layout de assinaturas | Vertical com 3 campos (Rep Legal + 2 Testemunhas) + consultor | Original PDF mostra 3 campos de assinatura + consultor info | y |
| Paginação | Sem page-break forçado | Tabela dita o tamanho natural das páginas | y |
| Font-size corpo | Manter 8.25pt | Diferença de 0.05pt para o spec é irrelevante | y |
| Margens padrão htmlRenderer | Atualizar para spec (12.7mm top, 26.27mm bottom, 17.64mm left/right) | Afeta apenas termo (demais sobrescrevem inline em service.js) | y |

---

## User Stories

### P1: Margens e Header do PDF Alinhados ao Spec ⭐ MVP

**User Story**: Como usuário do sistema, quero que o PDF gerado tenha as margens corretas e o logo da TIM no cabeçalho de todas as páginas, igual aos documentos oficiais.

**Why P1**: Fidelidade visual ao documento original é o requisito central.

**Acceptance Criteria**:
1. WHEN o termo é gerado THEN as margens SHOULD ser top=12.7mm, bottom=26.27mm, left=17.64mm, right=17.64mm
2. WHEN o termo é gerado THEN o logo TIM SHALL aparecer em TODAS as páginas
3. WHEN o termo é gerado THEN o primeiro texto SHALL iniciar a 37mm do topo da página

**Independent Test**: Gerar PDF e medir margens com ferramenta de análise (pdfplumber/pymupdf).

---

### P2: Tipografia do Título Corrigida

**User Story**: Como usuário, quero que o título "TERMO DE CONTRATAÇÃO" tenha tamanho 12pt bold com underline, conforme documento original.

**Why P2**: O título atualmente está em 10.5pt com border-bottom em vez de underline.

**Acceptance Criteria**:
1. WHEN o termo é gerado THEN o título SHALL ter font-size 12pt, font-weight bold, text-decoration underline

---

### P3: Estrutura de Seções Simplificada

**User Story**: Como usuário, quero que as seções do termo correspondam à estrutura do documento original (3 seções) sem seções adicionais.

**Why P3**: O PDF original tem apenas as seções IDENTIFICAÇÃO DO CLIENTE, DADOS DA CONTRATAÇÃO e ASSINATURAS. Seções extras (Contato Administrativo, Produto/Serviço, Observações como seção) devem ser fundidas nas principais.

**Acceptance Criteria**:
1. WHEN o termo é gerado THEN os campos admTelefone e admEmail SHALL estar na seção IDENTIFICAÇÃO DO CLIENTE
2. WHEN o termo é gerado THEN os campos ddd, tipoVenda, plano, aparelho SHALL estar na seção DADOS DA CONTRATAÇÃO
3. WHEN o termo é gerado THEN observações SHALL ser exibido como campo simples (não seção própria)

---

### P4: Bloco de Assinaturas Vertical com 3 Campos + Consultor

**User Story**: Como usuário, quero que o bloco de assinaturas tenha layout vertical com 3 campos (Representante Legal + 2 Testemunhas) mais informações do consultor/senior account, conforme original.

**Why P4**: Atualmente o bloco é horizontal com 2 campos apenas.

**Acceptance Criteria**:
1. WHEN o termo é gerado THEN as assinaturas SHALL ter layout vertical
2. WHEN o termo é gerado THEN SHALL conter 3 campos de assinatura (Representante Legal + Testemunha 1 + Testemunha 2)
3. WHEN o termo é gerado THEN SHALL exibir informações do consultor (seniorAccount, cnpjAccount, consultorNome, consultorCpf)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PROPOSTAS-PDF-01 | P1: Margens e Header do PDF | Implemented | Partial (bottom 26.27mm divergente — AD-046 usa 10mm, ver T6) |
| PROPOSTAS-PDF-02 | P1: Margens e Header do PDF | Implemented | Done |
| PROPOSTAS-PDF-03 | P1: Margens e Header do PDF | Implemented | Done |
| PROPOSTAS-PDF-04 | P2: Tipografia do Título | Pending | Pending (T6.2 — título segue 11pt sem underline) |
| PROPOSTAS-PDF-05 | P3: Estrutura Simplificada | Implemented | Done |
| PROPOSTAS-PDF-06 | P3: Estrutura Simplificada | Implemented | Done |
| PROPOSTAS-PDF-07 | P3: Estrutura Simplificada | Implemented | Done |
| PROPOSTAS-PDF-08 | P4: Assinaturas Verticais | Implemented | Done |
| PROPOSTAS-PDF-09 | P4: Assinaturas Verticais | Implemented | Done |
| PROPOSTAS-PDF-10 | P4: Assinaturas Verticais | Implemented | Done (CPF #666 pendente — T6.3) |

---

## Success Criteria

- [ ] PDF gerado do termo tem margens e logo consistentes com o spec *(bottom divergente — ver T6.1/AD-046)*
- [ ] Título do termo em 12pt bold underline
- [x] Estrutura de seções simplificada (fundidas)
- [x] Assinaturas em layout vertical com 3 campos + consultor
- [x] Sem page-breaks forçados (fluxo livre)
