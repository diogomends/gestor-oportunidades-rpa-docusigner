# Extracao OneDS — envelopeId, Assunto, Destinatario e Status (AD-042/043/044)

## Problem Statement
A UI moderna OneDS do DocuSign nao usa links `<a>` com href; extracao deve vir de atributos data-qa da linha. Precisa ignorar header thead e sanitizar prefixos Para:/To:.

## Requisitos

### REQ-EXT-01 — envelopeId e subject (AD-042)
- Extrair envelopeId do atributo `tr[data-qa^="manage-envelopes-list.row."]` — sufixo apos `manage-envelopes-list.row.` eh UUID.
- Capturar subject de `button[data-qa$="-mobile-name"]` ou `[data-qa$="-mobile-name-text"]`, fallback para `a[href]` legado.

### REQ-EXT-02 — Segmentacao tbody (AD-043)
- Query exclusiva `tbody[data-qa="manage-envelopes-list.body"] tr, tr[data-qa^="manage-envelopes-list.row."]` para evitar `thead` (`manage-envelopes-list.header.row`).
- Nao iterar registro nulo do cabecalho.

### REQ-EXT-03 — Destinatario e sanitizacao (AD-044)
- Query `[data-qa$="-mobile-from"]`, fallback `td:nth-child(2) [data-qa$="-mobile-from"]` ou `td:nth-child(2)` (corrigido da 3a coluna).
- Sanitizar prefixos `replace(/^(para|to):\s*/i,"")` e trim antes de filtro e payload.
- Status de ` [data-qa$="-status-status"]` fallback `[data-qa$="-mobile-status"]`; preservar texto bruto e warn se nao mapeado (Concluido, Aguardando outros, Anulado, Falha na entrega).

## Criterios (EARS)
- WHEN row OneDS parsed THEN SHALL extrair envelopeId do data-qa da tr (AD-042).
- WHEN tabela query THEN SHALL usar apenas tbody (AD-043).
- WHEN recipient extraido THEN SHALL sanitizar Para:/To: e usar coluna 2 (AD-044).
- WHEN status desconhecido THEN SHALL warn e preservar raw text (REQ-AGR-05).

## Trace
AD-042, AD-043, AD-044, REQ-AGR-02/03/05/06/07/08. Implementado em browserrobot/agreementsService.js, robot/src/browser/agreements.js, robotSelectors.js, selectors.js.
