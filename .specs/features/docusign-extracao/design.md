# Extração do Módulo DocuSign — Architecture & Design

## Visão Geral

```
antes:                                depois:
src/modules/contract/                 src/modules/contract/          src/modules/docusign/
├── models/Contract.js (com docusign)  ├── models/Contract.js       ├── models/DocusignEnvelope.js
├── controllers/                       ├── controllers/              ├── controllers/
│   ├── contractController.js          │   ├── contractController.js │   ├── docusignController.js
│   └── docusignController.js          │   └── (só contract)         │   └── (só docusign)
├── services/                          ├── services/                 ├── services/
│   ├── contractService.js             │   ├── contractService.js    │   └── docusignService.js
│   ├── docusignService.js             │   └── (sem docusign)        ├── routes.js
│   ├── storageService.js              ├── routes.js (sem /docusign) ├── index.js
│   └── watermarkService.js            └── index.js
├── routes.js (com /docusign/*)
└── index.js
```

## Schema DocusignEnvelope

```js
{
  contractId: { type: ObjectId, ref: "Contract", required: true },
  envelopeId: String,
  status: {
    type: String,
    enum: ["created", "sent", "delivered", "completed", "declined", "voided"],
  },
  signer: {
    nome: String,
    email: String,
    cpf: String,
  },
  sentAt: Date,
  completedAt: Date,
  webhookEvents: [{ event: String, timestamp: Date }],
  accessHash: String,
  signedDocPath: String,
  clientDocs: [{
    type: String,
    originalName: String,
    filePath: String,
    uploadedAt: { type: Date, default: Date.now },
  }],
}
```

## Contrato entre módulos

O módulo `docusign` DEPENDE do módulo `contract` apenas para:
1. **Ler** o contract (dados do cliente/signatário, documents[])
2. **Atualizar** `contract.status` quando o envelope muda de status

Isso é feito via import direto do model `Contract` em `docusignController.js` — mesma dependência que existe hoje.

## Rotas

### Novo módulo docusign — `/api/docusign/*`

| Método | Path | Auth | Função |
|--------|------|------|--------|
| GET | /consent-url | admin, suporte | getConsentUrl |
| POST | /send/:contractId | admin, suporte | sendContractToDocuSign |
| GET | /status/:contractId | admin, suporte, vendedor, coordenador, supervisor | getEnvelopeStatus |
| GET | /signing-url/:contractId | admin, suporte, vendedor, coordenador, supervisor | getSigningUrl |
| GET | /download/:contractId | admin, suporte | downloadSignedDocuments |
| POST | /webhook | pública (HMAC) | handleWebhook |

### Módulo contract atualizado — `/api/contracts/*`

| Método | Path | Auth | Função |
|--------|------|------|--------|
| GET | /uploads/inspect | admin, suporte | inspectUploads |
| POST | / | admin, suporte | createContract |
| GET | / | admin, suporte, vendedor, coordenador, supervisor | getContracts |
| GET | /:id | admin, suporte, vendedor, coordenador, supervisor | getContractById |
| PUT | /:id | admin, suporte | updateContract |
| DELETE | /:id | admin, suporte | deleteContract |
| GET | /:id/files/:fileType/:fileIndex/view | admin, suporte | viewAttachment |
| GET | /:id/files/:fileType/:fileIndex/download | admin | downloadAttachment |
| DELETE | /:id/files/:fileType/:fileIndex | admin | deleteAttachment |
| POST | /:id/files/clientDocs/:docType | admin, suporte | uploadClientAttachment |

## Fluxo de dados — Envio

```
Frontend                    Backend app_gestor                    DocuSign API
   │                            │                                    │
   │ POST /api/docusign         │                                    │
   │ /send/:contractId          │                                    │
   ├───────────────────────────>│                                    │
   │                            │ 1. Busca Contract por ID            │
   │                            │ 2. Cria DocusignEnvelope            │
   │                            │ 3. Gera accessHash                  │
   │                            │ 4. Chama docusignService            │
   │                            │    .sendEnvelope()                  │
   │                            ├───────────────────────────────────>│
   │                            │      envelopeId                     │
   │                            │<───────────────────────────────────┤
   │                            │ 5. Salva envelopeId em              │
   │                            │    DocusignEnvelope                 │
   │                            │ 6. Atualiza contract.status         │
   │                            │    = "enviado"                      │
   │      { envelopeId, status }│                                    │
   │<───────────────────────────┤                                    │
```

## Fluxo de dados — Webhook

```
DocuSign API                 Backend app_gestor                      MongoDB
   │                            │                                      │
   │ POST /api/docusign/webhook │                                      │
   ├───────────────────────────>│                                      │
   │                            │ 1. Verifica HMAC                     │
   │                            │ 2. Busca DocusignEnvelope            │
   │                            │    por envelopeId                    │
   │                            │ 3. Atualiza DocusignEnvelope.status  │
   │                            ├────────────────────────────────────>│
   │                            │ 4. Atualiza Contract.status          │
   │                            │    (import do model Contract)        │
   │                            ├────────────────────────────────────>│
   │                            │ 5. Se completed: baixa PDF assinado  │
   │                            │    salva signedDocPath               │
   │      200 OK                │                                      │
   │<───────────────────────────┤                                      │
```

## Fluxo de dados — Portal do cliente (client-server via API)

O client-server (porta 3001) conecta-se ao MongoDB na porta 27018, enquanto o app_gestor escreve DocusignEnvelope na porta 27017 (mesmo servidor, databases diferentes). Para evitar inconsistência de dados, o client-server acessa dados de envelope **via API do app_gestor**, não via MongoDB direto.

```
Cliente                client-server (3001)                    app_gestor (3000)              MongoDB (27017)
   │                        │                                        │                           │
   │ /cliente/{cnpj}_{hash} │                                        │                           │
   │  _docs                 │                                        │                           │
   ├───────────────────────>│                                        │                           │
   │                        │ 1. GET /api/docusign/portal/:hash      │                           │
   │                        ├───────────────────────────────────────>│                           │
   │                        │                                        │ 2. Busca DocusignEnvelope │
   │                        │                                        │    por accessHash          │
   │                        │                                        ├──────────────────────────>│
   │                        │                                        │  { contractId, clientDocs }│
   │                        │                                        │<──────────────────────────┤
   │                        │    { contractId, clientDocs,           │                           │
   │                        │      signedDocPath, tipoEmpresa }      │                           │
   │                        │<───────────────────────────────────────┤                           │
   │    página de upload    │                                        │                           │
   │<───────────────────────┤                                        │                           │
   │                        │                                        │                           │
   │ POST /api/client/upload│                                        │                           │
   │ /{hash}                │                                        │                           │
   ├───────────────────────>│                                        │                           │
   │                        │ 3. Salva arquivo em disco (local)      │                           │
   │                        │ 4. POST /api/docusign/portal/:hash/    │                           │
   │                        │       upload { file, filePath }        │                           │
   │                        ├───────────────────────────────────────>│                           │
   │                        │                                        │ 5. Adiciona em            │
   │                        │                                        │    DocusignEnvelope.      │
   │                        │                                        │    clientDocs[]           │
   │                        │                                        ├──────────────────────────>│
   │         200 OK          │             200 OK                     │                           │
   │<───────────────────────┤<───────────────────────────────────────┤                           │
```

## Mudanças no client-server

Atualmente o client-server acessa `contract.docusign.*` via MongoDB direto. Após a extração:

1. **Não** importa mais model DocusignEnvelope — acesso via HTTP
2. Rota `GET /:hash` do portal faz `fetch(http://app_gestor:3000/api/docusign/portal/:hash)` para obter dados do envelope
3. Rota `POST /upload/:hash` salva arquivo em disco local e depois chama `POST /api/docusign/portal/:hash/upload` no app_gestor para registrar em DocusignEnvelope.clientDocs[]
4. Rota `GET /download/:hash/docusign` faz proxy para `GET /api/docusign/portal/:hash/download` no app_gestor
5. Para dados do cliente (tipoEmpresa), app_gestor busca Contract pelo `envelope.contractId` e retorna junto

### Novos endpoints no app_gestor (públicos, sem JWT, autenticados via accessHash)

| Método | Path | Função |
|--------|------|--------|
| GET | /api/docusign/portal/:hash | Retorna envelope + dados do contrato para o portal |
| POST | /api/docusign/portal/:hash/upload | Registra upload de documento do cliente |
| GET | /api/docusign/portal/:hash/download | Serve o PDF assinado |

## Adaptação do contractService.js

Após remover `docusign` do schema Contract, os métodos em `contractService.js` que acessam `contract.docusign.*` precisam ser adaptados para usar `DocusignEnvelope`:

| Método | Uso atual | Novo comportamento |
| ------ | --------- | ----------------- |
| `deleteContract(id)` | `contract.docusign.signedDocPath` e `clientDocs[].filePath` | Busca `DocusignEnvelope.findOne({ contractId: id })`, deleta arquivos do disco |
| `getAttachmentInfo(id, fileType, index)` | `fileType=clientDocs`: lê de `contract.docusign.clientDocs[index]`; `fileType=signedDoc`: lê `contract.docusign.signedDocPath` | Busca `DocusignEnvelope.findOne({ contractId: id })`, lê do envelope |
| `deleteAttachment(id, fileType, index)` | Dá splice em `contract.docusign.clientDocs` ou limpa `signedDocPath` | Remove de `DocusignEnvelope.clientDocs` ou limpa `signedDocPath`, salva envelope |
| `uploadClientAttachment(id, docType, file)` | Cria/atualiza `contract.docusign.clientDocs[]` | Busca/cria `DocusignEnvelope.findOne({ contractId: id })`, gerencia `clientDocs[]`, salva envelope |

**Nota**: Os métodos de `fileType=documents` (arquivos do contrato) permanecem inalterados — operam em `contract.documents`.

## Arquivos afetados

### Removidos do módulo contract
- `Contract.js` — campo `docusign` removido do schema
- `controllers/docusignController.js` — removido inteiro
- `services/docusignService.js` — removido inteiro
- `routes.js` — linhas 164-195 removidas

### Criados no módulo docusign
- `src/modules/docusign/index.js` — entrypoint, exporta { routes }
- `src/modules/docusign/routes.js` — rotas `/api/docusign/*`
- `src/modules/docusign/controllers/docusignController.js` — funções de docusign
- `src/modules/docusign/services/docusignService.js` — classe DocuSignService
- `src/modules/docusign/models/DocusignEnvelope.js` — schema Mongoose

### Modificados
- `src/modules/contract/models/Contract.js` — remover campo docusign
- `src/modules/contract/routes.js` — remover imports de docusignController + rotas /docusign/*
- `src/modules/contract/controllers/contractController.js` — remover dependências de docusign
- `src/modules/contract/services/contractService.js` — adaptar 4 métodos para usar DocusignEnvelope
- `src/app.js` — adicionar `app.use("/api/docusign", docusignModule.routes)`
- `src/server.js` — adicionar import de DocusignEnvelope
- `public/modules/contratos/api.js` — trocar endpoints `/api/contracts/docusign/*` por `/api/docusign/*`
- `public/modules/contratos/dashboard-contratos-docusigner.js` — ler de DocusignEnvelope via API
- `public/modules/contratos/dashboard-contratos-docusigner.html` — ajustar se necessário
- `client-server/server.js` — trocar acesso direto MongoDB por chamadas HTTP ao app_gestor
- `client-server/public/app.js` — ajustar se necessário
- `src/scripts/test-docusign-recipients.js` — atualizar import path

### Dependências preservadas
- `src/modules/contract/services/storageService.js` — continua no módulo contract (usado para ler PDFs dos documents[])
- `src/modules/contract/services/watermarkService.js` — continua no módulo contract (marca d'água em attachments)
- `src/modules/contract/validation/` — continua no módulo contract
