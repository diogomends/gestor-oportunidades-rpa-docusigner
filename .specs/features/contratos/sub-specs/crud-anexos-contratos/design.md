# CRUD de Anexos no Dashboard de Contratos — Design

Este documento detalha o desenho técnico e de arquitetura para a feature de exibição dinâmica e CRUD completo dos anexos de clientes no dashboard.

## Componentes Afetados

```mermaid
graph TD
    subgraph Frontend (public/)
        DSH_HTML[dashboard-contratos-docusigner.html]
        DSH_JS[dashboard-contratos-docusigner.js]
        DSH_CSS[dashboard-contratos-docusigner.css]
    end

    subgraph Backend (src/modules/contract/)
        ROUTES[routes.js]
        CTRL[controllers/contractController.js]
        MODEL[models/Contract.js]
    end

    DSH_JS -- POST /api/contracts/:id/files/clientDocs/:docType --> ROUTES
    ROUTES --> CTRL
    CTRL --> MODEL
```

---

## 1. Backend Design

### Rota e Middleware (`src/modules/contract/routes.js`)

Adicionaremos o novo endpoint de upload protegido pelo middleware de autenticação e autorização por cargo:

```javascript
router.post(
  "/:id/files/clientDocs/:docType",
  protect,
  authorize("admin", "suporte"),
  upload.single("file"), // Middleware do multer existente
  uploadClientAttachment
);
```

### Controller (`src/modules/contract/controllers/contractController.js`)

Implementaremos a função `uploadClientAttachment`:

```javascript
const uploadClientAttachment = async (req, res) => {
  try {
    const { id, docType } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ error: "Contrato não encontrado" });
    }

    // Usar o foldername e o path gerados pelo multer storage
    const folderName = req._folderName || "temp";
    const relativePath = `uploads/${folderName}/${req.file.filename}`;

    if (!contract.docusign) {
      contract.docusign = { clientDocs: [] };
    }
    if (!contract.docusign.clientDocs) {
      contract.docusign.clientDocs = [];
    }

    // Monta o novo anexo
    const docEntry = {
      type: docType,
      originalName: req.file.originalname,
      filePath: relativePath,
      uploadedAt: new Date()
    };

    // Se já existia um documento desse tipo, atualizamos in-place para preservar a ordem
    const existingIdx = contract.docusign.clientDocs.findIndex(d => d.type === docType);
    if (existingIdx !== -1) {
      const oldDoc = contract.docusign.clientDocs[existingIdx];
      const storageService = await import("../services/storageService.js").then(m => m.default || m);
      try {
        await storageService.deleteFile(oldDoc.filePath);
      } catch (err) {
        console.warn("Falha ao deletar arquivo físico antigo:", err.message);
      }
      contract.docusign.clientDocs[existingIdx] = docEntry;
    } else {
      contract.docusign.clientDocs.push(docEntry);
    }
    await contract.save();

    return res.status(201).json({
      message: "Anexo enviado com sucesso",
      file: docEntry
    });
  } catch (error) {
    console.error("Erro no upload de anexo do cliente:", error);
    return res.status(500).json({ error: "Erro interno ao processar o upload" });
  }
};
```

---

## 2. Frontend Design

### Nomenclatura Dinâmica e Placeholders (`public/modules/contratos/dashboard-contratos-docusigner.js`)

Mapeamento estruturado de acordo com `client.tipoEmpresa`:

```javascript
const REQUIRED_DOCS_BY_TYPE = {
  'MEI': [
    { id: 'certificado_mei', label: 'CCMEI' },
    { id: 'comprovante_residencia', label: 'Endereço' },
    { id: 'documento_identidade', label: 'RG' }
  ],
  'ME': [
    { id: 'contrato_social', label: 'Contrato' },
    { id: 'comprovante_residencia', label: 'Endereço' },
    { id: 'documento_identidade', label: 'RG' }
  ],
  'LTDA': [
    { id: 'contrato_social', label: 'Contrato' },
    { id: 'documento_identidade', label: 'RG' }
  ],
  'EIRELI': [
    { id: 'contrato_social', label: 'Contrato' },
    { id: 'documento_identidade', label: 'RG' }
  ],
  'S.A.': [
    { id: 'contrato_social', label: 'Contrato' },
    { id: 'documento_identidade', label: 'RG' }
  ],
  'Associação': [
    { id: 'estatuto_ata', label: 'Estatuto' },
    { id: 'documento_identidade', label: 'RG' }
  ],
  'Sindicato': [
    { id: 'estatuto_ata', label: 'Estatuto' },
    { id: 'documento_identidade', label: 'RG' }
  ],
  'Condomínio': [
    { id: 'estatuto_ata', label: 'Estatuto' },
    { id: 'documento_identidade', label: 'RG' }
  ]
};
```

### Modificação do Renderizador do Card (`dashboard-contratos-docusigner.js`)

Modificaremos a listagem de `clientDocs` para iterar sobre a lista de documentos necessários baseados em `tipoEmpresa` (com fallback para `MEI` caso vazio ou inválido):

```javascript
const tipoEmpresa = client.tipoEmpresa || "MEI";
const requiredDocs = REQUIRED_DOCS_BY_TYPE[tipoEmpresa] || REQUIRED_DOCS_BY_TYPE['MEI'];

requiredDocs.forEach((reqDoc) => {
  // Achar se existe o arquivo já enviado no contract.docusign.clientDocs
  const originalIdx = clientDocs.findIndex(d => d.type === reqDoc.id);
  const isPresent = originalIdx !== -1;

  allItems.push(renderAttachmentItem(
    contract._id,
    "clientDocs",
    originalIdx, // Índice original no array para download/delete
    reqDoc.label,
    "ph ph-identification-card",
    cargo,
    isPresent,
    reqDoc.id
  ));
});
```

### Adaptação de `renderAttachmentItem`

```javascript
function renderAttachmentItem(contractId, fileType, index, name, iconClass, role, isPresent = true, docType = '') {
  const isVendedor = role === "vendedor" || role === "supervisor" || role === "coordenador";
  const isAdmin = role === "admin";
  const isSuporte = role === "suporte";

  // Se o documento estiver ausente/pendente
  if (!isPresent) {
    // Vendedor não pode fazer upload
    const uploadDisabled = isVendedor ? "disabled" : "";
    const hideUpload = isVendedor ? 'style="display:none"' : '';

    return `
      <div class="attachment-item pending">
        <span class="attachment-info" title="${name} (Pendente)">
          <i class="${iconClass}" style="color: var(--danger-color)"></i>
          <span style="color: var(--text-secondary)">${name}</span>
        </span>
        <div class="attachment-actions" ${hideUpload}>
          <button class="action-btn btn-upload" title="Fazer Upload" ${uploadDisabled}
                  data-id="${contractId}" data-doctype="${docType}" data-name="${name}">
            <i class="ph ph-upload"></i>
          </button>
        </div>
      </div>
    `;
  }

  // Se o documento estiver presente (fluxo original adaptado)
  const viewDisabled = isVendedor ? "disabled" : "";
  const downloadDisabled = !isAdmin ? "disabled" : "";
  const deleteDisabled = !isAdmin ? "disabled" : "";
  const hideAction = isVendedor ? 'style="display:none"' : '';

  return `
    <div class="attachment-item present">
      <span class="attachment-info" title="${name}">
        <i class="${iconClass}" style="color: var(--success-color)"></i>
        <span>${name}</span>
      </span>
      <div class="attachment-actions" ${hideAction}>
        <button class="action-btn btn-view" title="Visualizar" ${viewDisabled} 
                data-id="${contractId}" data-type="${fileType}" data-index="${index}" data-name="${name}">
          <i class="ph ph-eye"></i>
        </button>
        <button class="action-btn btn-download" title="Download" ${downloadDisabled} 
                data-id="${contractId}" data-type="${fileType}" data-index="${index}" data-name="${name}">
          <i class="ph ph-download"></i>
        </button>
        <button class="action-btn btn-delete" title="Excluir" ${deleteDisabled} 
                data-id="${contractId}" data-type="${fileType}" data-index="${index}" data-name="${name}">
          <i class="ph ph-trash"></i>
        </button>
      </div>
    </div>
  `;
}
```

### CSS Styling (`dashboard-contratos-docusigner.css`)

Estilização verde/vermelho sutil:

```css
.attachment-item.present {
  border-color: rgba(34, 197, 94, 0.3);
  background-color: rgba(34, 197, 94, 0.04);
}
.attachment-item.present:hover {
  border-color: rgba(34, 197, 94, 0.6);
}

.attachment-item.pending {
  border-color: rgba(239, 68, 68, 0.3);
  background-color: rgba(239, 68, 68, 0.04);
}
.attachment-item.pending:hover {
  border-color: rgba(239, 68, 68, 0.6);
}
```

---

## 3. Test Coverage Strategy

Adicionaremos um arquivo de teste de integração `tests/contracts-upload-acl.test.js` usando o test runner nativo do Node.js:
- Deve mockar as permissões e validar que:
  - Admin/Suporte conseguem fazer o upload com sucesso.
  - Vendedores recebem HTTP 403.
  - Requisição sem arquivo retorna HTTP 400.
  - Arquivo enviado substitui o anterior com sucesso fisicamente e no MongoDB.
