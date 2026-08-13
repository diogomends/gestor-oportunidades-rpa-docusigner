# Tasks: Exclusão de Card de Contrato

## Task 1: Endpoint Backend `DELETE /api/contracts/:id`

- **Description**: Implementar a rota `DELETE /api/contracts/:id` protegida por `protect` e `authorize("admin")`. A rota deve:
  - Encontrar o contrato em `Contract`.
  - Excluir o documento de `DocusignEnvelope` onde `contractId` coincide (se houver).
  - Excluir do disco todos os arquivos físicos apontados em `contract.documents[].path`, `contract.docusign.signedDocPath` e `contract.docusign.clientDocs[].filePath` usando `storageService.deleteFile`.
  - Excluir o registro de `Contract`.
  - Manter a `Opportunity` intacta.
- **Verification**: Testes de integração em `tests/contract-delete-card.test.js` ou manual via API.

---

## Task 2: Modal de Confirmação `#deleteCardConfirmModal` e Validação de CNPJ

- **Description**:
  - Adicionar o HTML do modal `#deleteCardConfirmModal` em `public/modules/contratos/contratos.html`.
  - Adicionar o botão de exclusão (`.btn-delete-card`) em `renderContracts()`, visível apenas se `currentUser.cargo === 'admin'`.
  - Adicionar a função `openDeleteCardModal(contractId, cnpj)` em `public/modules/contratos/dashboard/modals.js`.
  - Validar a digitação do CNPJ no campo `#deleteCardCnpjInput` para habilitar o botão de confirmação `#btnConfirmDeleteCard`.
- **Verification**: Ao clicar na lixeira do card como admin, o modal abre; digitar CNPJ correto habilita o botão.

---

## Task 3: Integração Frontend e Atualização do DOM

- **Description**:
  - Implementar `executeCardDeletion()` em `public/modules/contratos/dashboard/file-actions/execute-card-deletion.js` chamando `DELETE /api/contracts/:id`.
  - Ao receber HTTP 200, fechar o modal, exibir um toast de sucesso e remover o `.contract-card` correspondente do DOM.
  - Recarregar silenciosamente com `loadContracts()`.
- **Verification**: Confirmar exclusão visual e recarregamento sem erros no console.
