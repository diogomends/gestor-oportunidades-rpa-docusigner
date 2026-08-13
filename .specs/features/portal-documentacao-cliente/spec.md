# Feature Specification: Portal de Documentação do Cliente

**Feature Name:** `portal-documentacao-cliente`  
**Status:** Completed  
**Date:** 2026-07-20  

---

## 1. Visão Geral

Garantir o perfeito funcionamento, exibição de dados e responsividade do portal público do cliente (`client-server`), responsável pelo preenchimento de informações e envio de anexos pelo cliente final sem necessidade de login.

Principais pilares contemplados nesta especificação:
1. **Roteamento & Assets Estáticos:** Garantir que o Nginx e o `client-server` sirvam corretamente as URLs `/cliente/{cnpj}_{hash}_docs` e seus assets estáticos (`/cliente/style.css` e `/cliente/app.js`) com o tipo MIME correto.
2. **Exibição de Dados (Data Binding):** Garantir o preenchimento automático do nome da empresa (`id="company-name"`) e CNPJ (`id="company-cnpj"`) com fallbacks adequados mesmo se o envelope DocuSign ainda não tiver sido criado.
3. **Interface Responsiva & Upload Controls:** Redesenhar a interface com container de até `960px`, grade de 2 colunas para computadores (15 polegadas), 1 coluna para celulares, botões de ação proeminentes e caixa de substituição/cancelamento de arquivos.

---

## 2. Requisitos e Critérios de Aceite

### [REQ-001] Roteamento Nginx e Servimento de Assets Estáticos
* **Descrição:** A rota pública `/cliente/{cnpj}_{hash}_docs` e seus assets estáticos devem ser roteados para o container `client-server:3001` no Nginx.
* **Critérios de Aceite:**
  * [AC-001.1] Nginx possui regra `location ~ /.*_docs$` e `location /cliente/` apontando para `http://client-server:3001`.
  * [AC-001.2] `client-server/public/index.html` carrega `<link rel="stylesheet" href="/cliente/style.css" />` e `<script src="/cliente/app.js"></script>`.
  * [AC-001.3] `client-server/server.js` possui middleware `app.use('/cliente', express.static(...))` servindo arquivos estáticos.

### [REQ-002] Preenchimento de Dados do Cliente (`id="company-name"`)
* **Descrição:** O nome da empresa e CNPJ devem ser sempre preenchidos na tela do cliente.
* **Critérios de Aceite:**
  * [AC-002.1] `docusignController.getPortalEnvelope` extrai `razaoSocial` com fallback em `nomeFantasia` e `nome` do cliente.
  * [AC-002.2] `client-server/server.js` mapeia `nomeEmpresa: data.razaoSocial || data.nomeEmpresa || data.signerName || '—'`.
  * [AC-002.3] `client-server/public/app.js` renderiza o nome no elemento `#company-name` sem deixar o campo vazio ou `'—'`.

### [REQ-003] Layout Responsivo e Botões de Upload (Computador 15" e Celulares)
* **Descrição:** A interface de envio de documentos deve ser perfeitamente utilizável e esteticamente atraente em telas de 15" e dispositivos móveis.
* **Critérios de Aceite:**
  * [AC-003.1] Em telas ≥ 768px (computadores 15"), a lista de documentos é exibida em 2 colunas paralelas (`grid-template-columns: repeat(2, 1fr)`).
  * [AC-003.2] Em telas < 768px (smartphones), a lista de documentos é exibida em 1 coluna vertical com botões ocupando 100% da largura.
  * [AC-003.3] Ao selecionar um arquivo, o dropzone oculta-se e exibe a caixa do arquivo com o nome, ícone do formato e botão `✕` para trocar/cancelar.
  * [AC-003.4] O botão de envio (`⬆️ Enviar Documento`) possui destaque visual em vermelho TIM `#E4003A` e feedback durante o upload.

---

## 3. Matriz de Rastreabilidade

| ID | Requisito | Critério de Aceite | Status | PR / Commit |
| -- | --------- | ------------------ | ------ | ----------- |
| PORTAL-01 | Roteamento | AC-001.1, AC-001.2, AC-001.3 | Completed | PR #71, PR #72 |
| PORTAL-02 | Data Binding | AC-002.1, AC-002.2, AC-002.3 | Completed | PR #74 |
| PORTAL-03 | UI Responsiva | AC-003.1, AC-003.2, AC-003.3, AC-003.4 | Completed | PR #73 |
