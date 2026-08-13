# CRUD de Anexos no Dashboard de Contratos — Tasks

Lista de tarefas atômicas para a implementação da feature.

## Phase 1: Backend Implementation & Verification

### Task 1: Criar Endpoint de Upload de Anexo no CRM
- [x] **Description**: Adicionar a rota `POST /api/contracts/:id/files/clientDocs/:docType` em `src/modules/contract/routes.js` e implementar `uploadClientAttachment` em `src/modules/contract/controllers/contractController.js`. A rota deve usar o middleware do multer, tratar remoção de arquivos anteriores do mesmo tipo física e logicamente, e salvar o novo documento.
- [x] **Verification**: Executar checagem manual do código e preparar testes na Task 2.
- [x] **Commit Message**: `feat(backend): implement contract client attachment upload endpoint`

### Task 2: Implementar Testes Unitários para o Endpoint de Upload e ACL
- [x] **Description**: Criar o arquivo de teste `tests/contracts-upload-acl.test.js` validando:
  - Resposta HTTP 201 de sucesso para upload de admin/suporte.
  - Substituição lógica e física de anexo de mesmo tipo.
  - Resposta HTTP 403 para upload vindo de vendedor.
  - Resposta HTTP 400 para chamadas sem arquivos.
- [x] **Verification**: Rodar `npm test tests/contracts-upload-acl.test.js` e garantir que passe.
- [x] **Commit Message**: `test(backend): add integration tests for client attachment upload and ACL`

---

## Phase 2: Frontend Layout and Styling

### Task 3: Adicionar Estilos para Itens Presentes e Pendentes no CSS
- [x] **Description**: Modificar `public/modules/contratos/dashboard-contratos-docusigner.css` para incluir classes `.attachment-item.present` (borda verde/fundo verde claro sutil) e `.attachment-item.pending` (borda vermelha/fundo vermelho claro sutil).
- [x] **Verification**: Inspecionar visualmente depois ou validar sintaxe CSS.
- [x] **Commit Message**: `style(frontend): add green and red styles for present and pending attachments`

---

## Phase 3: Frontend Logic & Integration

### Task 4: Atualizar Renderização Dinâmica por Tipo de Empresa e Placeholders
- [x] **Description**: Alterar `public/modules/contratos/dashboard-contratos-docusigner.js` para usar o mapeamento de tipos de empresa ("CCMEI", "Endereço", "RG", etc.) de acordo com a resposta do usuário à Pergunta 3. Atualizar `renderAttachmentItem()` para exibir placeholders vermelhos com botão de upload caso o documento não tenha sido carregado.
- [x] **Verification**: Abrir o painel e checar se os placeholders adequados aparecem nos cards.
- [x] **Commit Message**: `feat(frontend): render dynamic client docs placeholders based on company type`

### Task 5: Implementar Fluxo de Upload no Dashboard
- [x] **Description**: Adicionar listener de clique para o botão `.btn-upload` em `dashboard-contratos-docusigner.js`. Ele deve criar um input de arquivo temporário, validar tamanho (10MB), extensão (PDF/JPG/PNG), e disparar o envio `POST /api/contracts/:id/files/clientDocs/:docType`. Em caso de sucesso, exibir toast e recarregar os contratos na tela.
- [x] **Verification**: Realizar upload de um arquivo fictício a partir do card e verificar se ele vira verde no dashboard com as ações de CRUD associadas.
- [x] **Commit Message**: `feat(frontend): implement file upload flow from dashboard client doc list`
