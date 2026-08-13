# Feature Tasks: Isolamento do Sub-Módulo de Link de Documentação do Cliente

**Feature Name:** `isolamento-link-documentacao-cliente`  
**Status:** Completed (Tasks 1–5) — Task 6 parcial  
**Date:** 2026-07-20  

---

## Fases de Implementação

### Fase 1: Isolamento do Sub-Módulo Backend `client-docs`

- [x] **Task 1: Modelo de Dados `ClientDocAccess`**
  * Criar `src/modules/client-docs/models/ClientDocAccess.js` utilizando a conexão do database `crm_contracts`.
  * Verificação: Importação e inicialização sem erros; teste de criação de schema.
  * **Implementado**: `src/modules/client-docs/models/ClientDocAccess.js` (collection `client_doc_accesses` no DB `crm_contracts`); registrado em `src/server.js:14`.

- [x] **Task 2: Serviço `clientDocsService`**
  * Criar `src/modules/client-docs/services/clientDocsService.js` contendo lógica de busca/geração do `accessHash` e validação de permissão de acesso ao contrato por usuário.
  * Verificação: Teste unitário isolado cobrindo geração de hash e montagem da URL.
  * **Implementado**: `src/modules/client-docs/services/clientDocsService.js` (`getOrGenerateLink`, `validateUserAccess`).
  * **Nota**: resíduo de acoplamento — ainda sincroniza `DocusignEnvelope.accessHash` e usa env `DOCUSIGN_EMAIL_LINK_BASE_URL`.

- [x] **Task 3: Controller e Rotas `client-docs`**
  * Criar `src/modules/client-docs/controllers/clientDocsController.js`, `src/modules/client-docs/routes.js` e `src/modules/client-docs/index.js`.
  * Registrar a rota `/api/client-docs` no `app.js` e registrar o model no `server.js`.
  * Verificação: Endpoint `GET /api/client-docs/link/:contractId` respondendo com 200 OK e JSON válido para o contrato do usuário.
  * **Implementado**: controller + `routes.js` (`GET /link/:contractId` com `protect`) + montagem em `src/app.js:65,69`.

### Fase 2: Desacoplamento da DocuSign

- [x] **Task 4: Remoção do `linkUrl` da DocuSign**
  * Remover os parâmetros e injeções de `linkUrl` e `emailBlurb` em `src/modules/docusign/services/docusignService.js` e `src/modules/docusign/controllers/docusignController.js`.
  * Verificação: Suíte de testes do DocuSign executando sem dependência do `linkUrl`.
  * **Implementado**: `sendEnvelope` sem parâmetro `linkUrl`; sem resquícios de `linkUrl`/`emailBlurb` em `src/modules/docusign/`.
  * **Nota**: permanecem fallbacks de compatibilidade que **leem** `ClientDocAccess` no portal (`getPortalEnvelope`, `portalUpload`, `portalDownload`) e o campo `DocusignEnvelope.accessHash`.

### Fase 3: Frontend - Botões de Copiar Links na Etapa 4 (Assinatura DocuSign) e Tabela

- [x] **Task 5: Botões "Copiar Link de Documentos" e "Copiar Link DocuSign" na Interface do Usuário**
  * Adicionar funções `getClientDocLink` e `getDocusignSigningUrl` em `public/modules/contratos/api.js`.
  * Na **Etapa 4 (Assinatura DocuSign)** dos arquivos `public/modules/contratos/contratos.js` e `public/modules/contratos/dashboard-contratos-docusigner.js`, renderizar bloco de ações com 2 botões:
    1. **"Copiar Link de Documentos"**: Copia a URL do portal do cliente para anexar documentação.
    2. **"Copiar Link DocuSign (WhatsApp)"**: Copia a URL de assinatura direta para o operador enviar manualmente via WhatsApp.
  * Adicionar botão de copiar link de documentos na tabela de contratos.
  * Verificação: Ambos os botões copiam corretamente suas respectivas URLs para o Clipboard com notificação visual.
  * **Implementado**: card "Links de Acesso do Cliente" em `contratos.html:956-970` (`#btn-copy-client-doc-link` e `#btn-copy-docusign-link`); handlers em `contratos.js:44-80`; botão `.btn-copy-doc-link` na tabela em `render-contracts.js:167-168`; APIs `getClientDocLink`/`getDocusignSigningUrl` em `api.js:176-205`.

### Fase 4: Testes Automatizados e Validação

- [ ] **Task 6: Testes Automatizados e Suíte Geral** *(parcial — unitários OK, falta teste de integração da rota)*
  * Criar `src/modules/client-docs/services/clientDocsService.test.js` e atualizar testes legados de contrato/DocuSign.
  * Verificação: Execução de `npm test` sem regressões.
  * **Parcial**: unitários existem (`clientDocsService.test.js`, `clientDocsController.test.js`, fallback no `docusignController.test.js`) e rodam via `node --test`. **Falta**: teste de integração da rota `/api/client-docs` em `tests/` (ver pendência registrada abaixo).

---

## Pendências Registradas (NÃO executar — aguardando aprovação)

- [ ] **TASK-NOVA-01**: Criar teste de integração/supertest para a rota `GET /api/client-docs/link/:contractId` em `tests/` (cobertura ACL por cargo + 200 OK com `linkUrl`/`accessHash`), conforme Task 6 acima.
