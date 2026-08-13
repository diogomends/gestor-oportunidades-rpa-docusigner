# Feature Design: Isolamento do Sub-Módulo de Link de Documentação do Cliente

**Feature Name:** `isolamento-link-documentacao-cliente`  
**Status:** Designing  
**Date:** 2026-07-20  

---

## 1. Arquitetura e Componentes

O módulo `client-docs` será um módulo isolado em `src/modules/client-docs/`, responsável estritamente por gerenciar os tokens de acesso e URLs públicas para anexação de documentos pelo cliente.

```
src/modules/client-docs/
├── index.js                     # Exportação principal do módulo
├── routes.js                    # Rotas da API (/api/client-docs/*)
├── models/
│   └── ClientDocAccess.js       # Schema Mongoose para accessHash
├── services/
│   └── clientDocsService.js     # Geração de hash, montagem de URL, verificação ACL
└── controllers/
    └── clientDocsController.js # Handlers HTTP para consulta e geração do link
```

---

## 2. Modelo de Dados (Mongoose)

### `ClientDocAccess.js` (no database `crm_contracts`)
```javascript
import mongoose from 'mongoose';

const clientDocAccessSchema = new mongoose.Schema({
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true,
    unique: true
  },
  accessHash: {
    type: String,
    required: true
  },
  cnpj: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const getClientDocAccessModel = () => {
  const db = mongoose.connection.useDb("crm_contracts");
  return db.models.ClientDocAccess || db.model("ClientDocAccess", clientDocAccessSchema);
};
```

---

## 3. Endpoints da API

### `GET /api/client-docs/link/:contractId`
* **Autenticação:** Requer JWT de usuário autenticado (`authMiddleware.protect`).
* **ACL:** Vendedor só acessa contratos de sua carteira; Supervisor/Coordenador de sua equipe; Admin/Suporte total (conforme AD-004 e AD-020).
* **Resposta Sucesso (200 OK):**
```json
{
  "success": true,
  "linkUrl": "https://portal.exemplo.com/12345678000199_a1b2c3d4e5f6_docs",
  "accessHash": "a1b2c3d4e5f6..."
}
```

---

## 4. Alterações nos Módulos Existentes

### `src/modules/docusign/`
* `docusignService.js`: Remover parâmetro `linkUrl` e interpolação do `emailBlurb`.
* `docusignController.js`: Remover trecho que gerava `linkUrl` e alterava `DocusignEnvelope.accessHash`.

### `public/modules/contratos/`
* Adicionar chamadas das APIs em `api.js`:
  * `getClientDocLink(contractId)` -> `GET /api/client-docs/link/:contractId`
  * `getDocusignSigningUrl(contractId)` -> `GET /api/docusign/signing-url/:contractId`
* Na **Etapa 4: Assinatura DocuSign** (`contratos.js` / `dashboard-contratos-docusigner.js`):
  * Exibir card de **Links para Envio ao Cliente (WhatsApp / E-mail)**.
  * Botão 1: **"Copiar Link de Documentos"** (Link do portal do cliente).
  * Botão 2: **"Copiar Link DocuSign (WhatsApp)"** (Link de assinatura direta do envelope).
* Adicionar botão com ícone e manipulador `copyToClipboard` também na tabela de listagem de contratos.
