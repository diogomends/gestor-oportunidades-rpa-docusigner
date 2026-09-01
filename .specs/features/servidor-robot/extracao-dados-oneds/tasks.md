# Tasks — Extracao OneDS

- [x] envelopeId via data-qa row UUID (AD-042)
- [x] subject via button[data-qa$="-mobile-name"] + fallback href
- [x] Seletor tbody strict (AD-043)
- [x] Fallback coluna 2 + sanitizacao Para:/To: (AD-044)
- [x] Status warn para nao mapeados
- [x] Testes: selectors.test.js, docusign.test.js

## Gate
- node --test tests/robot/browser/selectors.test.js
