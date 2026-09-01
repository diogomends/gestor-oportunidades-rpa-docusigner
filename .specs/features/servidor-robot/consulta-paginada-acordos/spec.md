# Consulta na Web DocuSign — URL, Periodo e Paginacao

## Problem Statement
O servico precisa consultar envelopes na interface web DocuSign navegando para `https://apps.docusign.com/send/documents?view=agreements&from={FROM}&to={TO}&pageSize=50`, calculando FROM = hoje -5 dias e TO = hoje (YYYY-MM-DD), e percorrendo todas as paginas ate o botao next ficar disabled.

> Parte da rotina de Conciliacao (AD-041 parte 2). Depende de `trava-concorrencia-periodica` para orquestracao e alimenta `extracao-oneds` e `cruzamento-atualizacao`.

## Requisitos

### REQ-CONS-01 — URL e Periodo
- Montar URL com `view=agreements`, `from` e `to` em YYYY-MM-DD, `pageSize=50`.
- Recuo dinamico de 5 dias (Date.now() - 5*24h). Validar formato antes de navegar.
- Implementacao em `backend/src/modules/robot-docusign/browserrobot/agreementsService.js` e `robot/src/browser/agreements.js`.

### REQ-CONS-02 — Paginacao Continua
- Enquanto `button[data-qa="manage-envelopes-list.footer.pagination-pagination-next"]` sem atributo `disabled`, clicar next e processar proxima pagina.
- Quando disabled, encerrar varredura e retornar envelopes acumulados.
- Timeout por pagina 10s; retry 1x se click falhar.

## Criterios (EARS)
- WHEN consulta inicia THEN SHALL calcular from/to YYYY-MM-DD e navegar para URL alvo (REQ-AGR-01).
- WHILE botao next enabled THEN SHALL clicar e processar proxima pagina ate disabled (REQ-AGR-04).
- WHEN paginacao termina THEN SHALL retornar lista completa sem duplicar header.

## Trace
docusign-agreements-query REQ-AGR-01/04, AD-041. Seletor pagination-next centralizado em robotSelectors.js.
