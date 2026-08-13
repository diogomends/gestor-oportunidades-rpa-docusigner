# Tasks — Extração do Módulo DocuSign

> **Verifier:** Após a última task, um Verifier independente será acionado automaticamente.

---

## Fase 1: Schema e Modelo (DOC-ENV-01, DOC-ENV-02)

### T-01: Criar model DocusignEnvelope

- **Descrição**: Criar `src/modules/docusign/models/DocusignEnvelope.js` com schema Mongoose contendo: `contractId` (ref Contract), `envelopeId`, `status`, `signer` (nome, email, cpf), `sentAt`, `completedAt`, `webhookEvents[]`, `accessHash`, `signedDocPath`, `clientDocs[]`. Usar `getContractsConnection()` da config/database.
- **Critérios**:
  - Schema registrado no database `crm_contracts`, collection `docusign_envelopes`
  - Timestamps ativados (`createdAt`, `updatedAt`)
  - Export default do modelo
- **Verificação**: Importar o model e criar um documento manualmente via script de teste

### T-02: Remover subdoc docusign do Contract (DOC-ENV-03, DOC-CON-01)

- **Descrição**: Remover o campo `docusign` do schema em `src/modules/contract/models/Contract.js` (linhas 110-136).
- **Critérios**:
  - Schema Contract não contém mais `docusign`
  - Nenhum outro código quebra por referência ao campo (ajustes vêm em tasks seguintes)
- **Verificação**: `node --test` nos testes de contract passa sem erros

---

## Fase 2: Rotas e Módulo Docusign (DOC-ROT-01 a DOC-ROT-08)

### T-03: Criar estrutura do módulo docusign

- **Descrição**: Criar:
  - `src/modules/docusign/index.js` — exporta `{ routes }`
  - `src/modules/docusign/routes.js` — router com rotas `/docusign/*` idênticas às que estão em `src/modules/contract/routes.js` linhas 164-195
  - `src/modules/docusign/controllers/docusignController.js` — copiar de `src/modules/contract/controllers/docusignController.js` ajustando imports para o novo módulo
  - `src/modules/docusign/services/docusignService.js` — copiar de `src/modules/contract/services/docusignService.js`, sem alterações
- **Critérios**:
  - Rotas: consent-url, send/:contractId, status/:contractId, signing-url/:contractId, download/:contractId, webhook
  - Controller usa `DocusignEnvelope` model em vez de `Contract.docusign`
  - Service mantém mesma lógica de integração com API DocuSign
- **Verificação**: Servidor sobe, `POST /api/docusign/send/:contractId` cria DocusignEnvelope

### T-04: Montar módulo docusign no app.js (DOC-ROT-01)

- **Descrição**: Adicionar em `src/app.js`:
  ```js
  import docusignModule from "./modules/docusign/index.js";
  app.use("/api/docusign", docusignModule.routes);
  ```
- **Critérios**:
  - Rota montada antes de health check
  - `GET /api/docusign/consent-url` retorna 200 com auth
  - `POST /api/docusign/webhook` é pública (sem auth)
- **Verificação**: `curl /api/docusign/consent-url` sem token retorna 401; com token admin retorna 200

### T-05: Remover rotas docusign do módulo contract (DOC-CON-03, DOC-ROT-08)

- **Descrição**: Remover linhas 164-195 de `src/modules/contract/routes.js` (imports de docusignController + todas as rotas `/docusign/*`).
- **Critérios**:
  - Módulo contract não tem mais rotas docusign
  - Remover import dos controllers também (linhas 21-28)
  - `POST /api/contracts/docusign/send/:id` retorna 404
- **Verificação**: `curl /api/contracts/docusign/send/fakeid` retorna 404

---

## Fase 3: Controller Docusign — Lógica de Criação (DOC-ENV-04, DOC-ROT-02)

### T-06: Adaptar sendContractToDocuSign para criar DocusignEnvelope

- **Descrição**: Em `docusignController.js`, alterar `sendContractToDocuSign` para:
  1. Buscar Contract (dados do cliente, documents[])
  2. Criar `DocusignEnvelope` com `contractId`, signer (extraído do contract), `accessHash`
  3. Chamar `docusignService.sendEnvelope()` com os PDFs
  4. Salvar `envelopeId` e status no DocusignEnvelope
  5. Atualizar `contract.status = "enviado"` (import de Contract model)
- **Critérios**:
  - DocusignEnvelope criado com contractId correto
  - accessHash salvo no envelope (não no contract)
  - contract.status atualizado para "enviado"
- **Verificação**: Criar contrato, enviar, confirmar DocusignEnvelope no banco com envelopeId, e Contract.status = "enviado"

### T-07: Adaptar handleWebhook para DocusignEnvelope (DOC-ROT-03)

- **Descrição**: Alterar `handleWebhook` para:
  1. Buscar DocusignEnvelope por `envelopeId`
  2. Atualizar `DocusignEnvelope.status`
  3. Atualizar `Contract.status` correspondente (via envelope.contractId)
  4. Se completed: baixar PDF, salvar em `signedDocPath` do envelope
- **Critérios**:
  - Webhook atualiza DocusignEnvelope.status e Contract.status
  - PDF assinado salvo em signedDocPath do envelope
- **Verificação**: Simular webhook com HMAC, confirmar status em ambos os models

### T-08: Adaptar demais funções do controller (DOC-ROT-04 a DOC-ROT-07)

- **Descrição**: Alterar `getEnvelopeStatus`, `getSigningUrl`, `downloadSignedDocuments` para ler de DocusignEnvelope (buscar envelope por `contractId`).
- **Critérios**:
  - Envelope buscado por `{ contractId }` (não por `contract.docusign.envelopeId`)
  - ACL preservada (getSigningUrl/getEnvelopeStatus para todos; download/admin)
- **Verificação**: Cada endpoint retorna dados consistentes com o envelope

---

## Fase 4: Frontend (DOC-FE-01 a DOC-FE-03)

### T-09: Atualizar endpoints no api.js

- **Descrição**: Em `public/modules/contratos/api.js`, alterar os métodos:
  - `sendToDocuSign(contractId)`: `/api/docusign/send/${contractId}`
  - `getDocuSignStatus(contractId)`: `/api/docusign/status/${contractId}`
  - `downloadSignedContract(contractId)`: `/api/docusign/download/${contractId}`
- **Critérios**:
  - Nenhum endpoint de docusign aponta mais para `/api/contracts/docusign/*`
- **Verificação**: Clicar "Enviar para DocuSign" no frontend, inspecionar chamada de rede para `/api/docusign/send/...`

---

## Fase 5: client-server (DOC-CS-01 a DOC-CS-03)

### T-10: Adaptar client-server para DocusignEnvelope

- **Descrição**: Em `client-server/server.js`:
  1. Importar model DocusignEnvelope (criar schema simplificado inline ou importar)
  2. Nas rotas `GET /contract/:hash`, `POST /upload/:hash`, `GET /download/:hash/docusign`:
     - Buscar por `DocusignEnvelope.findOne({ accessHash })`
     - Ler `clientDocs[]` do envelope
     - Ler `signedDocPath` do envelope
     - Para dados do cliente (tipoEmpresa), buscar Contract pelo `envelope.contractId`
- **Critérios**:
  - Upload de cliente salva em `DocusignEnvelope.clientDocs[]`
  - Download de assinado lê `DocusignEnvelope.signedDocPath`
  - Portal do cliente funciona sem acesso a `contract.docusign`
- **Verificação**: Acessar portal com hash válido, fazer upload, confirmar documento aparece no dashboard

---

## Fase 6: Contract Service — Adaptação para DocusignEnvelope (DOC-CON-04 a DOC-CON-07)

### T-11: Adaptar contractService.js para usar DocusignEnvelope

- **Descrição**: Em `src/modules/contract/services/contractService.js`, alterar 4 métodos para ler/escrever em `DocusignEnvelope` em vez de `contract.docusign`:
  1. `deleteContract(id)`: apagar `signedDocPath` e `clientDocs[].filePath` do disco via DocusignEnvelope
  2. `getAttachmentInfo(id, fileType, index)`: para `clientDocs`/`signedDoc`, buscar `DocusignEnvelope.findOne({ contractId: id })`
  3. `deleteAttachment(id, fileType, index)`: para `clientDocs`/`signedDoc`, remover de DocusignEnvelope e salvar
  4. `uploadClientAttachment(id, docType, file)`: buscar ou criar DocusignEnvelope, gerenciar `clientDocs[]`, salvar envelope
  - `fileType=documents` permanece inalterado (opera em `contract.documents`)
- **Critérios**:
  - Nenhum método em contractService.js lê/grava `contract.docusign`
  - uploadClientAttachment salva em DocusignEnvelope, não em contract
  - deleteContract deleta arquivos de envelope e de contract
- **Verificação**: Testes de contractService passam; criar contrato, fazer upload, deletar, confirmar dados no DocusignEnvelope

---

## Fase 7: Frontend — Dashboard DocuSign (DOC-FE-04 a DOC-FE-06)

### T-12: Atualizar dashboard-contratos-docusigner

- **Descrição**: Em `public/modules/contratos/dashboard-contratos-docusigner.js`:
  - Substituir leitura de `contract.docusign.clientDocs` e `contract.docusign.signedDocPath` por chamadas à API
  - Usar `GET /api/docusign/status/:contractId` para polling
  - Usar `GET /api/docusign/download/:contractId` para link de download
  - Remover qualquer referência a `contract.docusign`
- **Critérios**:
  - Dashboard carrega clientDocs da API
  - Polling de status funciona
  - Download aponta para `/api/docusign/download/:contractId`
- **Verificação**: Abrir dashboard de contrato com envelope, confirmar dados carregados via rede

---

## Fase 8: client-server — Migração para API (DOC-CS-01 a DOC-CS-04)

### T-13: Criar endpoints públicos /api/docusign/portal/* no app_gestor

- **Descrição**: Adicionar em `src/modules/docusign/routes.js`:
  ```js
  router.get("/portal/:hash", getPortalEnvelope);         // sem protect — público
  router.post("/portal/:hash/upload", upload.single("file"), portalUpload);  // sem protect
  router.get("/portal/:hash/download", portalDownload);    // sem protect
  ```
  Criar funções no controller:
  - `getPortalEnvelope`: busca DocusignEnvelope por accessHash, popula contractId (tipoEmpresa)
  - `portalUpload`: recebe arquivo e filePath do client-server, adiciona em clientDocs[]
  - `portalDownload`: serve signedDocPath do envelope
- **Critérios**:
  - GET /api/docusign/portal/:hash retorna envelope + dados do contrato sem JWT
  - POST .../upload adiciona em clientDocs[] sem JWT
  - GET .../download serve PDF sem JWT
- **Verificação**: curl sem token nos 3 endpoints retorna dados corretos

### T-14: Adaptar client-server para chamar API

- **Descrição**: Em `client-server/server.js`:
  1. Remover schema `clientDocSchema` e `docusign` de `contractSchema` (não mais usados diretamente)
  2. Na rota `GET /:hash` (middleware): chamar `fetch(http://app_gestor:3000/api/docusign/portal/${hash})` em vez de MongoDB
  3. Na rota `GET /contract/:hash`: chamar a API e retornar dados
  4. Na rota `POST /upload/:hash`: salvar arquivo em disco, depois chamar `POST /api/docusign/portal/:hash/upload` com os dados
  5. Na rota `GET /download/:hash/docusign`: fazer proxy para app_gestor
  - Usar `process.env.APP_GESTOR_URL` (ou `http://app_gestor:3000` como fallback) para a URL
- **Critérios**:
  - client-server não acessa mais `contract.docusign` no MongoDB
  - Upload e download funcionam via API
- **Verificação**: Fluxo completo no portal (acessar hash, upload, download) funciona

---

## Fase 9: Registro e Scripts

### T-15: Importar DocusignEnvelope em server.js (DOC-ENV-05)

- **Descrição**: Adicionar em `src/server.js`:
  ```js
  import "./modules/docusign/models/DocusignEnvelope.js";
  ```
- **Critérios**:
  - Schema DocusignEnvelope registrado ao iniciar o servidor
- **Verificação**: Servidor sobe sem erros; collection `docusign_envelopes` aparece no MongoDB

### T-16: Atualizar test-docusign-recipients.js (DOC-SCR-01)

- **Descrição**: Em `src/scripts/test-docusign-recipients.js`, alterar:
  ```js
  import docusignService from '../modules/contract/services/docusignService.js';
  ```
  para:
  ```js
  import docusignService from '../modules/docusign/services/docusignService.js';
  ```
- **Critérios**:
  - Script executa sem erro de import
- **Verificação**: `node src/scripts/test-docusign-recipients.js` roda sem quebrar

---

## Fase 10: Limpeza e Verificação

### T-17: Remover dependências órfãs e imports mortos

- **Descrição**: Verificar e remover:
  - Imports de `docusignController`/`docusignService` em `src/modules/contract/` que não existem mais
  - Qualquer referência a `contract.docusign.*` nos controllers restantes
  - Atualizar `query-contracts.js` se referenciar `c.docusign`
- **Critérios**:
  - Servidor roda sem warnings de import
  - `node --test` passa em todos os testes
- **Verificação**: `npm test` passa limpo

### T-18: Data check + migração (se houver dados)

- **Descrição**: Verificar se existem contratos com `docusign.envelopeId` preenchido no banco de produção. Se sim, perguntar ao usuário antes de migrar.
- **Critérios**:
  - Script de verificação criado em `src/scripts/check-docusign-data.js`
  - Se houver dados: pausa e pergunta ao usuário antes de prosseguir
- **Verificação**: Script retorna contagem de documentos com/sem dados docusign

---

## Dependências entre tasks

```
T-01 ──> T-02
  │
  └────> T-03 ──> T-04 ──> T-05
                    │
                    └────> T-06 ──> T-07 ──> T-08
                                      │
                                      ├────> T-09 ──> T-12
                                      │
                                      ├────> T-10
                                      │
                                      └────> T-11
                                                     
T-06 ──> T-13 ──> T-14
          │
          └────> T-15

T-11 ──> T-16
T-12 ──> T-17 ──> T-18
```

- T-01, T-02: paralelo (modelos independentes)
- T-03, T-04, T-05: sequencial
- T-06 a T-10: sequencial (back → front → client-server)
- T-11, T-12: paralelo entre si, dependem de T-08 (back funcional)
- T-13, T-14: sequencial (endpoints app_gestor → client-server adaptado)
- T-15: depende de T-01 + T-04 (modelo + app montado)
- T-16: depende de T-11 (contract service adaptado antes de scripts)
- T-17, T-18: paralelo (limpeza final, dependem de T-12 + T-14 + T-16)
