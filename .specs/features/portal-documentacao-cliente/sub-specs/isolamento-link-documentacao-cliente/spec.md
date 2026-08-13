# Feature Specification: Isolamento do Sub-Módulo de Link de Documentação do Cliente

**Feature Name:** `isolamento-link-documentacao-cliente`  
**Status:** Completed  
**Date:** 2026-07-20  

---

## 1. Visão Geral

Desacoplar a geração e o gerenciamento dos links de anexação de documentação do cliente (`linkUrl`) da integração com a DocuSign. Atualmente, o link de upload de documentos do cliente era gerado dentro do `docusignController` e injetado no e-mail do envelope DocuSign via `emailBlurb`.

Com esta alteração:
1. A lógica de geração e gerenciamento do link do cliente é isolada no sub-módulo dedicado `src/modules/client-docs/`.
2. A DocuSign deixa de incluir o link no e-mail (`emailBlurb` e `linkUrl` removidos do disparo DocuSign).
3. O backend disponibiliza endpoints próprios para consultar e gerar o link do cliente.
4. O frontend exibe o link gerado com um botão funcional de **"Copiar Link"** no Dashboard de Contratos (na tabela de contratos e na Etapa 4: Assinatura DocuSign).
5. O frontend na **Etapa 4: Assinatura DocuSign** exibe também o link da própria DocuSign (`signingUrl`) com botão de **"Copiar Link DocuSign"**, permitindo que o usuário reenvie por WhatsApp ao cliente.

---

## 2. Requisitos e Critérios de Aceite

### [REQ-001] Módulo Dedicado `client-docs`
* **Descrição:** O backend deve possuir um módulo isolado em `src/modules/client-docs` para gerenciar os links de upload de documentos do cliente.
* **Critérios de Aceite:**
  * [AC-001.1] Estrutura do módulo criada em `src/modules/client-docs/` contendo `index.js`, `routes.js`, `controllers/clientDocsController.js`, `services/clientDocsService.js` e `models/ClientDocAccess.js`.
  * [AC-001.2] O módulo deve ser registrado no `app.js` e `server.js` sob o prefixo `/api/client-docs`.

### [REQ-002] Persistência do Acesso do Cliente (`ClientDocAccess`)
* **Descrição:** O hash de acesso do cliente (`accessHash`) e metadados relacionados à anexação de documentos devem ser armazenados em schema próprio ou associado ao contrato.
* **Critérios de Aceite:**
  * [AC-002.1] Schema `ClientDocAccess` armazena `contractId`, `accessHash`, `cnpj`, `createdAt` e `expiresAt` (opcional).
  * [AC-002.2] `clientDocsService.getOrGenerateLink(contractId)` gera e retorna o link único do cliente no formato `${DOCUSIGN_EMAIL_LINK_BASE_URL}/cliente/${cnpjDigits}_${accessHash}_docs`.

### [REQ-003] Desacoplamento da DocuSign
* **Descrição:** A DocuSign não deve mais enviar o link de anexação de documentos no e-mail do envelope.
* **Critérios de Aceite:**
  * [AC-003.1] Remoção dos parâmetros `linkUrl` do método `docusignService.sendEnvelope`.
  * [AC-003.2] Remoção do `emailBlurb` contendo o link do cliente no disparo do envelope DocuSign.
  * [AC-003.3] O controller da DocuSign deixa de criar/armazenar o `accessHash` e foca exclusivamente no envio e gestão de envelopes.

### [REQ-004] Endpoints da API de Documentação do Cliente
* **Descrição:** API REST para consultar e obter o link de anexação do cliente.
* **Critérios de Aceite:**
  * [AC-004.1] `GET /api/client-docs/link/:contractId` (protegido por `authMiddleware.protect`) gera/obtémo link do cliente e o retorna em JSON `{ success: true, linkUrl, accessHash }`.
  * [AC-004.2] Erros de ACL (ex: usuário tentando acessar contrato de outro vendedor) retornam HTTP 403 com mensagem em pt-BR conforme AD-008.

### [REQ-005] Interface Frontend: Exibição e Copiar Link de Documentação do Cliente
* **Descrição:** O frontend em `public/modules/contratos/` deve exibir o botão de copiar o link do cliente para anexar documentação.
* **Critérios de Aceite:**
  * [AC-005.1] Adicionar botão "Copiar Link de Documentos" na tabela/ações dos contratos.
  * [AC-005.2] Na **Etapa 4 (Assinatura DocuSign)** do formulário/modal de contrato, exibir o card com o link de documentação do cliente e o botão de copiar.
  * [AC-005.3] Ao clicar em "Copiar Link", o link é copiado com sucesso para a área de transferência (`navigator.clipboard.writeText`) com feedback visual imediato.

### [REQ-006] Interface Frontend: Exibição e Copiar Link Direto da DocuSign
* **Descrição:** O frontend em `public/modules/contratos/` na **Etapa 4 (Assinatura DocuSign)** deve exibir o link de assinatura da DocuSign (`signingUrl`) com opção de copiar para envio via WhatsApp.
* **Critérios de Aceite:**
  * [AC-006.1] Na **Etapa 4 (Assinatura DocuSign)**, ao enviar o envelope ou consultar o status, obter o link de assinatura do cliente (`/api/docusign/signing-url/:contractId`).
  * [AC-006.2] Exibir botão "Copiar Link DocuSign (WhatsApp)" que copia a URL de assinatura direta do envelope.
  * [AC-006.3] O operador pode acionar o envio manual/reenvio via WhatsApp utilizando o link copiado.
