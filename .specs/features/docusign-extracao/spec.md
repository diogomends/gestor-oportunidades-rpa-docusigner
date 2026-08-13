# Extração do Módulo DocuSign — Specification

> **Nota de Arquitetura (AD-022)**: Esta especificação é responsável pelo desacoplamento e refatoração do **Módulo DocuSign** (`src/modules/docusign/`) e da collection `docusign_envelopes`. O escopo funcional do Módulo de Contratos e do Portal do Cliente é mantido na especificação [`modulo-contratos`](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/.specs/features/modulo-contratos/spec.md).

## Problem Statement

Atualmente, toda a lógica de integração com DocuSign (envio de envelopes, webhook, portal do cliente) está **embutida** no módulo `src/modules/contract/` como subdocumento `docusign` no schema Contract e controllers misturados no mesmo `docusignController.js`. Isso viola o SRP (Single Responsibility Principle) — o módulo contract acumula CRUD de contratos + integração com API externa + gerenciamento de arquivos + portal do cliente.

Precisamos extrair um módulo `docusign` independente, com:
- Schema `DocusignEnvelope` próprio (collection separada)
- Rotas próprias sob `/api/docusign`
- Ciclo de vida independente do Contract
- Coordenação mínima entre módulos (atualização de `contract.status` via `contractId`)

## Goals

- [ ] Módulo `src/modules/docusign/` com model, controller, service e rotas próprios
- [ ] Schema `DocusignEnvelope` separado em collection `crm_contracts.docusign_envelopes`
- [ ] Rotas movidas de `/api/contracts/docusign/*` para `/api/docusign/*`
- [ ] Módulo `contract` removido do subdocumento `docusign` e de todas as responsabilidades de integração
- [ ] `client-server` atualizado para ler/escrever em `DocusignEnvelope` em vez de `contract.docusign`
- [ ] Frontend atualizado para apontar para as novas rotas `/api/docusign/*`
- [ ] Nenhuma regressão no fluxo de contratos (CRUD, wizard, dashboard)

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Alteração de lógica de negócio | Refatoração estrutural apenas; comportamento existente é preservado |
| Mudança no fluxo do portal do cliente | Permanece em container `client-server` separado |
| Troca de biblioteca/migração de SDK | `docusign-esign` permanece |
| Criação de módulo para validação (CPF/CNPJ) | Fica para outra extração futura |

> **Nota**: Endpoints novos `/api/docusign/portal/*` serão criados para o client-server (substituem acesso direto ao MongoDB). Isto é uma adaptação de infraestrutura, não novo escopo de negócio.

---

## Assumptions & Open Questions

| Assumption | Rationale | Confirmed? |
| ---------- | --------- | ---------- |
| `DocusignEnvelope` será salvo no database `crm_contracts`, mesma connection dos Contracts | Já existe `getContractsConnection()` configurada | y |
| `contract.status` continuará sendo atualizado pelo módulo docusign via `contractId` | Coordenação mínima inevitável — contract precisa saber se foi assinado | y |
| `contract.status` geral será atualizado no mesmo esquema atual (rascunho/gerado/enviado/assinado/cancelado) | Nenhuma mudança de domínio | y |
| client-server acessará dados de envelope via API do app_gestor (portais `/api/docusign/portal/*`), não via MongoDB direto | Client-server (porta 27018) não enxerga dados escritos por app_gestor (porta 27017) | y |
| Dados existentes em `contract.docusign.*` serão migrados (ou ignorados se não houver) | Perguntado e confirmado: limpar se houver, com confirmação | y |

---

## User Stories

### P0: Schema DocusignEnvelope

**User Story**: Como plataforma, preciso que os dados de integração DocuSign estejam em collection própria, desacoplada do Contract, para que o módulo docusign tenha ciclo de vida independente.

**Acceptance Criteria**:

1. **DOC-ENV-01**: WHEN o módulo docusign é carregado THEN o schema DocusignEnvelope SHALL ser registrado no database `crm_contracts`, collection `docusign_envelopes`
2. **DOC-ENV-02**: WHEN um envelope é criado THEN o DocusignEnvelope SHALL conter: `contractId` (ObjectId ref), `envelopeId`, `status`, `sentAt`, `completedAt`, `signer` (nome, email, cpf), `accessHash`, `signedDocPath`, `clientDocs[]`, `webhookEvents[]`
3. **DOC-ENV-03**: WHEN o módulo contract é carregado THEN o schema Contract NÃO SHALL conter mais o subdocumento `docusign`
4. **DOC-ENV-04**: WHEN um envelope é enviado/atualizado THEN o módulo docusign SHALL atualizar `contract.status` no módulo contract via referência direta (import do model Contract)

---

### P0: Rotas /api/docusign

**User Story**: Como operador, quero que os endpoints do DocuSign estejam sob prefixo próprio para clareza de domínio.

**Acceptance Criteria**:

5. **DOC-ROT-01**: WHEN o módulo docusign é montado THEN `app.js` SHALL registrar `app.use("/api/docusign", docusignModule.routes)`
6. **DOC-ROT-02**: WHEN uma requisição autenticada (admin/suporte) faz `POST /api/docusign/send/:contractId` THEN o sistema SHALL criar um DocusignEnvelope, enviar o envelope para DocuSign e retornar 200 com `{ envelopeId, status }`
7. **DOC-ROT-03**: WHEN uma requisição não autenticada faz `POST /api/docusign/webhook` THEN o sistema SHALL processar o webhook (público, sem auth)
8. **DOC-ROT-04**: WHEN uma requisição autenticada faz `GET /api/docusign/status/:contractId` THEN o sistema SHALL retornar o status do envelope mais recente
9. **DOC-ROT-05**: WHEN uma requisição autenticada faz `GET /api/docusign/signing-url/:contractId` THEN o sistema SHALL retornar a URL de embedded signing
10. **DOC-ROT-06**: WHEN uma requisição autenticada faz `GET /api/docusign/download/:contractId` THEN o sistema SHALL retornar o PDF assinado para download
11. **DOC-ROT-07**: WHEN uma requisição autenticada faz `GET /api/docusign/consent-url` THEN o sistema SHALL retornar a URL de consentimento OAuth
12. **DOC-ROT-08**: WHEN a rota `/api/contracts/docusign/*` é acessada THEN o sistema SHALL retornar 404 (rotas removidas do módulo contract)

---

### P0: Módulo Contract — Remoção do subdoc docusign

**User Story**: Como plataforma, quero que o schema Contract não tenha mais responsabilidade sobre dados de integração DocuSign.

**Acceptance Criteria**:

13. **DOC-CON-01**: WHEN o schema Contract é carregado THEN o campo `docusign` NÃO SHALL existir no schema
14. **DOC-CON-02**: WHEN o controller contractController é carregado THEN os métodos relacionados a DocuSign NÃO SHALL existir (sendContractToDocuSign, getEnvelopeStatus, getSigningUrl, downloadSignedDocuments, getConsentUrl, handleWebhook)
15. **DOC-CON-03**: WHEN o arquivo routes.js do módulo contract é carregado THEN as rotas `/docusign/*` NÃO SHALL existir

---

### P0: Contract Service — Adaptação de operações de arquivo

**User Story**: Como operador, quero continuar gerenciando arquivos de clientDocs e signedDocPath normalmente após a extração do módulo docusign.

**Acceptance Criteria**:

16. **DOC-CON-04**: WHEN `contractService.deleteContract(id)` é chamado THEN o sistema SHALL deletar arquivos de `DocusignEnvelope.clientDocs[].filePath` e `DocusignEnvelope.signedDocPath` do disco
17. **DOC-CON-05**: WHEN `getAttachmentInfo(id, "clientDocs", index)` é chamado THEN o sistema SHALL ler de `DocusignEnvelope.clientDocs[index]`
18. **DOC-CON-06**: WHEN `deleteAttachment(id, "clientDocs", index)` é chamado THEN o sistema SHALL remover o item de `DocusignEnvelope.clientDocs`
19. **DOC-CON-07**: WHEN `uploadClientAttachment(id, docType, file)` é chamado THEN o sistema SHALL criar/atualizar entrada em `DocusignEnvelope.clientDocs[]` (não em contract.docusign)

---

### P0: Frontend — Dashboard DocuSign

**User Story**: Como operador, quero que o dashboard de documentos do cliente continue funcionando após a extração.

**Acceptance Criteria**:

20. **DOC-FE-04**: WHEN o dashboard carrega `clientDocs` THEN a leitura SHALL ser de `DocusignEnvelope` via API
21. **DOC-FE-05**: WHEN o dashboard faz polling de status THEN a requisição SHALL ser `GET /api/docusign/status/:contractId`
22. **DOC-FE-06**: WHEN o dashboard exibe `signedDocPath` THEN o link SHALL apontar para `/api/docusign/download/:contractId`

---

### P0: client-server — Acesso via API

**User Story**: Como cliente, quero continuar acessando o portal normalmente, com o client-server lendo dados de envelope via API do app_gestor.

**Acceptance Criteria**:

23. **DOC-CS-01**: WHEN o client-server busca contrato por `accessHash` THEN o sistema SHALL chamar `GET /api/docusign/portal/:hash` no app_gestor
24. **DOC-CS-02**: WHEN o client-server faz upload de clientDoc THEN o sistema SHALL chamar `POST /api/docusign/portal/:hash/upload` no app_gestor
25. **DOC-CS-03**: WHEN o client-server serve o PDF assinado THEN o sistema SHALL chamar `GET /api/docusign/portal/:hash/download` no app_gestor
26. **DOC-CS-04**: WHEN o app_gestor recebe requisição em `/api/docusign/portal/*` THEN o sistema SHALL processar sem JWT (autenticado via accessHash)

---

### P1: Scripts de suporte

**Acceptance Criteria**:

27. **DOC-SCR-01**: WHEN `test-docusign-recipients.js` é executado THEN o import de docusignService SHALL ser de `../modules/docusign/services/docusignService.js`

---

### P1: Reenvio de e-mail de assinatura

**User Story**: Como operador, quero reenviar o e-mail de assinatura DocuSign com 1 clique, para quando o cliente não recebeu ou perdeu o e-mail original.

**Acceptance Criteria**:

28. **DOC-RESEND-01**: WHEN operador clica "Reenviar" em contrato com status `sent`/`enviado` THEN sistema SHALL chamar `POST /api/docusign/resend/:contractId`
29. **DOC-RESEND-02**: WHEN API DocuSign retorna sucesso THEN sistema SHALL exibir "E-mail reenviado com sucesso!"
30. **DOC-RESEND-03**: WHEN API DocuSign retorna erro THEN sistema SHALL exibir mensagem de erro
31. **DOC-RESEND-04**: WHEN botão é clicado THEN botão SHALL mostrar spinner e ficar desabilitado até resposta
32. **DOC-RESEND-05**: WHEN contrato está `completed`/`assinado`/`declined`/`voided`/`cancelado` THEN botão SHALL não ser exibido
33. **DOC-RESEND-06**: WHEN contrato não tem envelope DocuSign registrado THEN sistema SHALL retornar 400

> **Nota de Correção (2026-07-22)**: Corrigida a assinatura da chamada de `envelopesApi.update` no `docusignService.js`. O parâmetro `resendEnvelope` deve ser enviado dentro do objeto de opções como 3º argumento.

---

### P0: Registro de schema

**Acceptance Criteria**:

28. **DOC-ENV-05**: WHEN `server.js` carrega os modelos THEN DocusignEnvelope SHALL ser importado para registrar o schema

---

### P0: Frontend — Atualização de endpoints

**User Story**: Como operador, quero que o frontend continue funcionando após a separação dos módulos.

**Acceptance Criteria**:

16. **DOC-FE-01**: WHEN o frontend chama `sendToDocuSign()` THEN a requisição SHALL ser `POST /api/docusign/send/:contractId`
17. **DOC-FE-02**: WHEN o frontend chama `getDocuSignStatus()` THEN a requisição SHALL ser `GET /api/docusign/status/:contractId`
18. **DOC-FE-03**: WHEN o frontend chama `downloadSignedContract()` THEN a requisição SHALL ser `GET /api/docusign/download/:contractId`

---

### P0: client-server — Atualização do acesso a dados

**User Story**: Como cliente, quero continuar acessando o portal normalmente após a refatoração.

**Acceptance Criteria**:

19. **DOC-CS-01**: WHEN the client-server searches for a contract by `accessHash` THEN the system SHALL search in `DocusignEnvelope.findOne({ accessHash })` and populate `contractId`
20. **DOC-CS-02**: WHEN the client-server uploads a clientDoc THEN the system SHALL add it to `DocusignEnvelope.clientDocs[]`
21. **DOC-CS-03**: WHEN the client-server serves the signed PDF THEN the system SHALL read `DocusignEnvelope.signedDocPath`

---

### P1: Resiliência de Rede e Timeouts

**User Story**: Como operador e sistema, quero que as chamadas à API externa do DocuSign tenham timeout explícito e erros de rede amigáveis, para evitar travamentos indefinidos da rota (que causariam erros 502/504 no proxy Nginx).

**Acceptance Criteria**:

34. **DOC-NET-01**: WHEN qualquer chamada de API é feita usando o DocuSign `apiClient` THEN o tempo de conexão SHALL expirar após 15 segundos (ou valor definido em `DOCUSIGN_TIMEOUT_MS`).
35. **DOC-NET-02**: WHEN ocorre timeout na chamada da API (`ETIMEDOUT`) THEN o sistema SHALL retornar HTTP 504 Gateway Timeout com mensagem traduzida em português sobre limite de tempo excedido.
36. **DOC-NET-03**: WHEN ocorre falha na resolução DNS da DocuSign (`ENOTFOUND`) THEN o sistema SHALL retornar HTTP 503 Service Unavailable com mensagem traduzida em português sobre erro de DNS.
37. **DOC-NET-04**: WHEN ocorre conexão recusada ou reiniciada (`ECONNREFUSED` / `ECONNRESET`) THEN o sistema SHALL retornar HTTP 503 com mensagem apropriada.

---

## Requirement Traceability

| ID | Story | Phase | Status |
| -- | ----- | ----- | ------ |
| DOC-ENV-01 | P0: Schema DocusignEnvelope | Spec | Pending |
| DOC-ENV-02 | P0: Schema DocusignEnvelope | Spec | Pending |
| DOC-ENV-03 | P0: Schema DocusignEnvelope | Spec | Pending |
| DOC-ENV-04 | P0: Schema DocusignEnvelope | Spec | Pending |
| DOC-ENV-05 | P0: Registro de schema | Spec | Pending |
| DOC-ROT-01 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-02 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-03 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-04 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-05 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-06 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-07 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-08 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-CON-01 | P0: Módulo Contract — schema | Spec | Pending |
| DOC-CON-02 | P0: Módulo Contract — controller | Spec | Pending |
| DOC-CON-03 | P0: Módulo Contract — routes | Spec | Pending |
| DOC-CON-04 | P0: Contract Service — deleteContract | Spec | Pending |
| DOC-CON-05 | P0: Contract Service — getAttachmentInfo | Spec | Pending |
| DOC-CON-06 | P0: Contract Service — deleteAttachment | Spec | Pending |
| DOC-CON-07 | P0: Contract Service — uploadClientAttachment | Spec | Pending |
| DOC-FE-01 | P0: Frontend — sendToDocuSign | Spec | Pending |
| DOC-FE-02 | P0: Frontend — getDocuSignStatus | Spec | Pending |
| DOC-FE-03 | P0: Frontend — downloadSigned | Spec | Pending |
| DOC-FE-04 | P0: Frontend — dashboard clientDocs | Spec | Pending |
| DOC-FE-05 | P0: Frontend — dashboard polling | Spec | Pending |
| DOC-FE-06 | P0: Frontend — dashboard download link | Spec | Pending |
> **Nota de Correção (2026-07-22)**: Corrigida a assinatura da chamada de `envelopesApi.update` no `docusignService.js`. O parâmetro `resendEnvelope` deve ser enviado dentro do objeto de opções como 3º argumento.

---

### P0: Registro de schema

**Acceptance Criteria**:

28. **DOC-ENV-05**: WHEN `server.js` carrega os modelos THEN DocusignEnvelope SHALL ser importado para registrar o schema

---

### P0: Frontend — Atualização de endpoints

**User Story**: Como operador, quero que o frontend continue funcionando após a separação dos módulos.

**Acceptance Criteria**:

16. **DOC-FE-01**: WHEN the frontend calls `sendToDocuSign()` THEN the request SHALL be `POST /api/docusign/send/:contractId`
17. **DOC-FE-02**: WHEN the frontend calls `getDocuSignStatus()` THEN the request SHALL be `GET /api/docusign/status/:contractId`
18. **DOC-FE-03**: WHEN the frontend calls `downloadSignedContract()` THEN the request SHALL be `GET /api/docusign/download/:contractId`

---

### P0: client-server — Atualização do acesso a dados

**User Story**: Como cliente, quero continuar acessando o portal normalmente após a refatoração.

**Acceptance Criteria**:

19. **DOC-CS-01**: WHEN the client-server searches for a contract by `accessHash` THEN the system SHALL search in `DocusignEnvelope.findOne({ accessHash })` and populate `contractId`
20. **DOC-CS-02**: WHEN the client-server uploads a clientDoc THEN the system SHALL add it to `DocusignEnvelope.clientDocs[]`
21. **DOC-CS-03**: WHEN the client-server serves the signed PDF THEN the system SHALL read `DocusignEnvelope.signedDocPath`

---

### P1: Resiliência de Rede e Timeouts

**User Story**: Como operador e sistema, quero que as chamadas à API externa do DocuSign tenham timeout explícito e erros de rede amigáveis, para evitar travamentos indefinidos da rota (que causariam erros 502/504 no proxy Nginx).

**Acceptance Criteria**:

34. **DOC-NET-01**: WHEN qualquer chamada de API é feita usando o DocuSign `apiClient` THEN o tempo de conexão SHALL expirar após 15 segundos (ou valor definido em `DOCUSIGN_TIMEOUT_MS`).
35. **DOC-NET-02**: WHEN ocorre timeout na chamada da API (`ETIMEDOUT`) THEN o sistema SHALL retornar HTTP 504 Gateway Timeout com mensagem traduzida em português sobre limite de tempo excedido.
36. **DOC-NET-03**: WHEN ocorre falha na resolução DNS da DocuSign (`ENOTFOUND`) THEN o sistema SHALL retornar HTTP 503 Service Unavailable com mensagem traduzida em português sobre erro de DNS.
37. **DOC-NET-04**: WHEN ocorre conexão recusada ou reiniciada (`ECONNREFUSED` / `ECONNRESET`) THEN o sistema SHALL retornar HTTP 503 com mensagem apropriada.

---

## Requirement Traceability

| ID | Story | Phase | Status |
| -- | ----- | ----- | ------ |
| DOC-ENV-01 | P0: Schema DocusignEnvelope | Spec | Pending |
| DOC-ENV-02 | P0: Schema DocusignEnvelope | Spec | Pending |
| DOC-ENV-03 | P0: Schema DocusignEnvelope | Spec | Pending |
| DOC-ENV-04 | P0: Schema DocusignEnvelope | Spec | Pending |
| DOC-ENV-05 | P0: Registro de schema | Spec | Pending |
| DOC-ROT-01 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-02 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-03 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-04 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-05 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-06 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-07 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-ROT-08 | P0: Rotas /api/docusign | Spec | Pending |
| DOC-CON-01 | P0: Módulo Contract — schema | Spec | Pending |
| DOC-CON-02 | P0: Módulo Contract — controller | Spec | Pending |
| DOC-CON-03 | P0: Módulo Contract — routes | Spec | Pending |
| DOC-CON-04 | P0: Contract Service — deleteContract | Spec | Pending |
| DOC-CON-05 | P0: Contract Service — getAttachmentInfo | Spec | Pending |
| DOC-CON-06 | P0: Contract Service — deleteAttachment | Spec | Pending |
| DOC-CON-07 | P0: Contract Service — uploadClientAttachment | Spec | Pending |
| DOC-FE-01 | P0: Frontend — sendToDocuSign | Spec | Pending |
| DOC-FE-02 | P0: Frontend — getDocuSignStatus | Spec | Pending |
| DOC-FE-03 | P0: Frontend — downloadSigned | Spec | Pending |
| DOC-FE-04 | P0: Frontend — dashboard clientDocs | Spec | Pending |
| DOC-FE-05 | P0: Frontend — dashboard polling | Spec | Pending |
| DOC-FE-06 | P0: Frontend — dashboard download link | Spec | Pending |
| DOC-CS-01 | P0: client-server — via API | Spec | Pending |
| DOC-CS-02 | P0: client-server — via API | Spec | Pending |
| DOC-CS-03 | P0: client-server — via API | Spec | Pending |
| DOC-CS-04 | P0: client-server — via API | Spec | Pending |
| DOC-SCR-01 | P1: Scripts de suporte | Spec | Pending |
| DOC-RESEND-01 | P1: Reenvio de e-mail — service | Spec | Implemented |
| DOC-RESEND-02 | P1: Reenvio de e-mail — controller | Spec | Implemented |
| DOC-RESEND-03 | P1: Reenvio de e-mail — route | Spec | Implemented |
| DOC-RESEND-04 | P1: Reenvio de e-mail — botão frontend | Spec | Implemented |
| DOC-RESEND-05 | P1: Reenvio de e-mail — visibilidade do botão | Spec | Implemented |
| DOC-RESEND-06 | P1: Reenvio de e-mail — spinner loading | Spec | Implemented |
| DOC-NET-01 | P1: Resiliência de Rede e Timeouts — timeout apiClient | Spec | Implemented |
| DOC-NET-02 | P1: Resiliência de Rede e Timeouts — erro HTTP 504 | Spec | Implemented |
| DOC-NET-03 | P1: Resiliência de Rede e Timeouts — erro HTTP 503 DNS | Spec | Implemented |
| DOC-NET-04 | P1: Resiliência de Rede e Timeouts — erro HTTP 503 Conexão | Spec | Implemented |

---

## Edge Cases

- WHEN um contrato tem DocusignEnvelope mas o contractId ref não existe (contrato deletado) THEN o envelope SHALL ser retornado sem dados do contrato (status "órfão")
- WHEN uma requisição chega em `/api/contracts/docusign/*` THEN o sistema SHALL retornar 404 com mensagem "Rota movida para /api/docusign/*"
- WHEN o client-server chama `/api/docusign/portal/:hash` e o hash não existe THEN retorna 404 com "Link inválido ou expirado"
- WHEN o módulo docusign atualiza contract.status e o contract não existe THEN loga erro e prossegue (não quebra o fluxo)
- WHEN `contractService.deleteContract` é chamado e não há DocusignEnvelope para o contractId THEN apaga apenas os documents[] e prossegue
- WHEN `contractService.uploadClientAttachment` é chamado e não há DocusignEnvelope THEN cria um novo envelope minimalista com o clientDoc
- WHEN `POST /api/docusign/resend/:contractId` é chamado e não há DocusignEnvelope THEN retorna 400 com mensagem
- WHEN `POST /api/docusign/resend/:contractId` é chamado e envelope está `completed` THEN retorna 400 (envelope já finalizado)
- WHEN ocorre erro de DNS (ENOTFOUND/EAI_AGAIN) na comunicação com DocuSign THEN o sistema retorna HTTP 503 com diagnóstico claro em português
- WHEN ocorre limite de tempo excedido (ETIMEDOUT) na comunicação com DocuSign THEN o sistema retorna HTTP 504 com diagnóstico claro de timeout em português

---

## Success Criteria

- [ ] `src/modules/docusign/` criado com model, controller, service, routes, index.js
- [ ] `DocusignEnvelope` schema registrado e funcional em `crm_contracts.docusign_envelopes`
- [ ] Todos os endpoints `/api/docusign/*` respondem como os antigos `/api/contracts/docusign/*`
- [ ] `contractService.js` opera sobre `DocusignEnvelope` em vez de `contract.docusign` (4 métodos adaptados)
- [ ] Wizard de contratos no frontend envia/consulta/baixa sem erros
- [ ] Dashboard de contratos exibe status DocuSign corretamente
- [ ] Dashboard de documentos do cliente lê de `DocusignEnvelope` via API
- [x] Botão "Reenviar" aparece no dashboard apenas p/ status sent/enviado
- [x] Botão "Copiar Link DocuSign" removido do dashboard
- [ ] Portal do cliente (client-server) acessa dados de envelope via API do app_gestor
- [ ] `src/scripts/test-docusign-recipients.js` importa do novo path
- [ ] `server.js` importa DocusignEnvelope para registrar schema
- [ ] Testes existentes passam (ou são atualizados)
- [x] Limite de tempo (timeout) explícito de 15 segundos configurado no DocuSign ApiClient
- [x] Tratamento robusto de falhas de rede no docusignController fornecendo diagnóstico adequado em português do dashboard
