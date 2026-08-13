# Dashboard de Contratos DocuSign — Specification

## Visão Geral
> Painel de visualização e gerenciamento de contratos enviados via DocuSign.

Exibe contratos em formato de cards com informações do cliente, status do envelope, planos vinculados e documentos anexos.

---

## Problem Statement

O CRM necessita de uma visualização centralizada de todos os contratos gerados e integrados com o DocuSign. Atualmente, os contratos e seus documentos anexados (tanto gerados pelo sistema quanto enviados pelos clientes) estão distribuídos em coleções do MongoDB e diretórios físicos de uploads sem uma interface amigável para gerenciamento. Além disso, é crucial aplicar restrições de permissões específicas para cada cargo (vendedor, suporte, admin) sobre os anexos para fins de conformidade e segurança da informação.

## Goals

- Criar uma interface web (`dashboard-contratos-docusigner.html`, CSS e JS) em formato de tabela/cards listando todos os contratos.
- Controlar a visibilidade de arquivos anexos por cargo (vendedor, suporte, admin).
- Fornecer botões de visualização, download e deleção para os anexos com base na ACL.
- Implementar endpoints seguros no backend para servir os arquivos aos usuários autorizados.
- Permitir a deleção física e lógica de anexos por administradores mediante confirmação em modal.

## Out of Scope

| Funcionalidade | Motivo |
| -------------- | ------ |
| Upload de novos arquivos direto pelo dashboard | O upload de anexos ocorre no fluxo de criação/assinatura do contrato |
| Edição de dados cadastrais do cliente no dashboard | Isso já é coberto pela tela de edição de contratos existente |

---

## Frontend & Estrutura do Layout

### Arquivos
- `public/modules/contratos/dashboard-contratos-docusigner.html`
- `public/modules/contratos/dashboard-contratos-docusigner.css`
- `public/modules/contratos/dashboard-contratos-docusigner.js`

### Layout dos Cards

#### Card Principal (`.contract-card`)
- Fundo cinza claro (`#f3f4f6`), bordas arredondadas (`12px`), sombra leve.

#### Seção Superior (`.card-top`)
Flexbox com 4 colunas:

| Coluna | Conteúdo |
|--------|----------|
| 1 | Nome da empresa, nº de linhas (`acessos`), CNPJ |
| 2 | Badge de status (Rascunho, Enviado, Assinado, Cancelado) |
| 3 | `.plan-box` com plano, oferta e acessos |
| 4 | Hash ID (`accessHash`), data/hora |

#### Seção Inferior (`.card-bottom`)
- Título "DOCUMENTOS GERADOS"
- `.documents-container`: flex row com itens de documento lado a lado.
- Itens (`.attachment-item`): borda fina, ícone PDF, ações (Visualizar, Baixar, Excluir).

---

## Schema de Dados (Contract Schema)

| Campo | Descrição |
|-------|-----------|
| `client.razaoSocial` | Nome da empresa |
| `client.cnpj` | CNPJ |
| `negotiation[].plano` | Nome do plano |
| `negotiation[].oferta` | Nome da oferta |
| `negotiation[].acessos` | Qtd de linhas |
| `docusign.status` | Status envelope |
| `docusign.accessHash` | Hash de acesso público |
| `documents[]` | Documentos gerados |
| `docusign.signedDocPath` | Contrato assinado |
| `docusign.clientDocs[]` | Docs do cliente |

---

## Manutenção e Extensibilidade
Novos tipos de anexos: adicionar no array `allItems` em `renderContracts()` em `dashboard-contratos-docusigner.js`, seguindo o padrão `renderAttachmentItem()`.

---

## User Stories

### P1: Visualização do Dashboard e Tabela

**User Story:** Como usuário autorizado (vendedor, suporte, admin), quero visualizar uma tabela/listagem com todos os contratos contendo Razão Social, CNPJ, Status do DocuSign, Criador e data, além dos arquivos anexos.

**Acceptance Criteria:**

1. **CONTR-DASH-01**: A página do dashboard deve estar localizada em `/modules/contratos/dashboard-contratos-docusigner.html`.
2. **CONTR-DASH-02**: A tabela deve listar: Razão Social, CNPJ, Status do Envelope (DocuSign), Criado Por, Data de Criação e as Negociações (plano, valor mensal, operadora, etc.).
3. **CONTR-DASH-03**: Cada contrato deve listar seus arquivos anexos agrupados ou identificados por tipo. Os tipos de anexo são:
   - Documentos gerados pelo sistema (`documents`: termo, proposta, permanência).
   - Documento assinado final (`docusign.signedDocPath`).
   - Documentos enviados pelo cliente (`docusign.clientDocs` — ex: RG, CPF, etc.).

### P1: Controle de Acesso por Cargo (ACL)

**User Story:** Como administrador, suporte ou vendedor, quero ter permissões adequadas de visualização, download e exclusão de arquivos de acordo com o meu cargo para garantir a segurança dos dados.

**Acceptance Criteria:**

4. **CONTR-DASH-04 (Cargo Vendedor)**:
   - Pode ver os dados do contrato na tabela e os nomes/tipos de arquivos anexos.
   - **NÃO** pode visualizar o conteúdo, baixar ou deletar nenhum arquivo. Os botões de visualização, download e exclusão devem estar ausentes ou desabilitados no frontend.
5. **CONTR-DASH-05 (Cargo Suporte)**:
   - Pode ver todos os dados na tabela e nomes dos arquivos.
   - Pode visualizar/ler o conteúdo dos arquivos anexos (através de um visualizador seguro ou nova aba).
   - **NÃO** pode fazer o download nem deletar os arquivos. Os botões correspondentes devem estar ocultos ou desabilitados.
6. **CONTR-DASH-06 (Cargo Admin)**:
   - Tem acesso total: visualizar, baixar e deletar arquivos anexos.
   - A exclusão de um arquivo exige confirmação explícita através de um modal no frontend antes de enviar a requisição de deleção.

### P1: Proteção e Segurança de Arquivos (Anti-Cópia)

**User Story:** Como administrador do sistema, quero que os arquivos visualizados pelo suporte e admin tenham mecanismos de segurança (como bloqueio de download pelo visualizador de PDF, bloqueio de arrastar e de botão direito em imagens) para dificultar cópias não autorizadas.

**Acceptance Criteria:**

7. **CONTR-DASH-09 (Visualização Customizada com PDF.js)**:
   - O PDF não deve ser carregado diretamente em visualizadores nativos do navegador (iframe direto) que exponham botões de download e impressão.
   - Deve ser utilizada a biblioteca `PDF.js` da Mozilla para buscar o arquivo como Blob/ArrayBuffer de forma autenticada no backend, renderizando suas páginas em elementos `<canvas>` empilhados em uma div com rolagem.
8. **CONTR-DASH-10 (Proteção de Imagens e Overlay)**:
   - Para exibição de arquivos de imagem, deve ser criado um elemento wrapper contendo a imagem e uma `<div>` transparente sobreposta (overlay) de mesmo tamanho.
   - A tag `<img>` deve receber estilos CSS `user-select: none`, `-webkit-user-drag: none` e `pointer-events: none` para impedir que o usuário selecione ou arraste a imagem.
9. **CONTR-DASH-11 (Bloqueio de Menu de Contexto)**:
   - Deve ser bloqueado o menu de contexto (clique com o botão direito do mouse) dentro do modal de visualização de arquivos e em qualquer imagem protegida, evitando a opção de "Salvar imagem como".
10. **CONTR-DASH-12 (Marca D'água Dinâmica para Rastreamento)**:
    - Na rota de visualização de arquivos, o backend deve gerar dinamicamente no buffer (em memória) uma marca d'água transversal com Nome e Email do usuário logado antes de servir o arquivo.
    - Se for PDF, utilizar a biblioteca `pdf-lib` para desenhar o texto em cada página com opacidade reduzida.
    - Se for Imagem, utilizar a biblioteca `sharp` para compor o texto como um overlay SVG sobre a imagem.

### P1: Segurança no Backend (API controlada)

**User Story:** Como administrador do sistema, quero que as rotas de download, visualização e deleção validem as permissões de acesso no backend para evitar burlas de requisições no frontend.

**Acceptance Criteria:**

10. **CONTR-DASH-07 (Visualização e Download Seguros)**:
    - As rotas da API para servir arquivos devem ser protegidas por autenticação.
    - `GET /api/contracts/:id/files/:fileType/:fileIndex/view` deve retornar o arquivo usando `res.sendFile` ou redirecionamento seguro para visualização em tela apenas se o cargo do usuário logado for `admin` ou `suporte`. Retorna HTTP 403 para `vendedor`.
    - `GET /api/contracts/:id/files/:fileType/:fileIndex/download` deve forçar o download do arquivo apenas se o cargo for `admin`. Retorna HTTP 403 para `suporte` e `vendedor`.
11. **CONTR-DASH-08 (Remoção Segura de Arquivos)**:
    - `DELETE /api/contracts/:id/files/:fileType/:fileIndex` deve remover o arquivo físico no servidor usando o `storageService` e atualizar o banco de dados MongoDB removendo a respectiva entrada do array de documentos ou de clientDocs do contrato.
    - A rota de deleção de arquivos deve aceitar apenas requisições de usuários com cargo `admin`. Retorna HTTP 403 para `suporte` e `vendedor`.

---

## Edge Cases

| # | Caso | Comportamento Esperado |
| - | ---- | ---------------------- |
| 1 | O arquivo físico de um anexo não existe no disco | Ao tentar baixar/visualizar, a API retorna 404 informando que o arquivo físico não foi encontrado. Ao tentar deletar, o banco é atualizado e o arquivo no disco é ignorado se não existir. |
| 2 | O tipo de arquivo especificado na rota é inválido | A API retorna 400 (Bad Request) informando que o tipo de arquivo deve ser `documents`, `clientDocs` ou `signedDoc`. |
| 3 | Um vendedor tenta acessar a URL direta da API de visualização | O middleware e o controller bloqueiam retornando HTTP 403 com mensagem em português. |
| 4 | Contrato antigo sem `docusign` ou sem `clientDocs` | A listagem no frontend exibe "Sem anexos" para a respectiva seção do contrato sem quebrar o layout. |

---

## Requirement Traceability

| ID | História | AC | Implementado Em | Status |
| -- | -------- | -- | --------------- | ------ |
| CONTR-DASH-01 | Acesso | Arquivo em `/modules/contratos/...` | `dashboard-contratos-docusigner.html` | Verified |
| CONTR-DASH-02 | Tabela | Tabela com dados cadastrais e negócios | `dashboard-contratos-docusigner.js` | Verified |
| CONTR-DASH-03 | Listagem | Listagem de anexos por tipo | `dashboard-contratos-docusigner.js` | Verified |
| CONTR-DASH-04 | ACL Vendedor | Sem visualização, sem download, sem delete | `dashboard-contratos-docusigner.js` | Verified |
| CONTR-DASH-05 | ACL Suporte | Com visualização, sem download, sem delete | `dashboard-contratos-docusigner.js` | Verified |
| CONTR-DASH-06 | ACL Admin | Acesso total + modal de confirmação no delete | `dashboard-contratos-docusigner.js` | Verified |
| CONTR-DASH-07 | API Arquivos | Endpoints seguros de view/download com ACL | `routes.js` / `contractController.js` | Verified |
| CONTR-DASH-08 | API Deleção | Endpoint seguro de delete físico e no DB | `routes.js` / `contractController.js` | Verified |
| CONTR-DASH-09 | Segurança | Visualização customizada com PDF.js em canvas | `dashboard-contratos-docusigner.js` | Verified |
| CONTR-DASH-10 | Segurança | Proteção de imagens com div overlay transparente e CSS | `dashboard-contratos-docusigner.js` / `.css` | Verified |
| CONTR-DASH-11 | Segurança | Bloqueio de menu de contexto (botão direito) no visualizador | `dashboard-contratos-docusigner.js` | Verified |

## Success Criteria

- [x] A tabela exibe todos os dados estruturados de contratos e negociações (incluindo retrocompatibilidade).
- [x] Usuários com cargo Vendedor não conseguem abrir, baixar ou deletar nenhum arquivo no frontend nem backend.
- [x] Usuários com cargo Suporte conseguem visualizar anexos em tela, mas não têm botões de download/exclusão e são barrados no backend caso tentem.
- [x] Administradores conseguem ver, baixar e deletar (com confirmação em modal) os arquivos anexos.
- [x] Arquivos deletados são excluídos fisicamente do diretório `uploads/` do servidor.
- [x] O link para o painel de contratos está presente no menu `#submenuDashboard` com ID `#navContractsDashboardItem`.
- [x] A spec do `submenuDashboard` está registrada na especificação do `sidebar.md`.
- [x] PDFs de contratos são renderizados usando `PDF.js` em canvas sem expor a interface de download do visualizador nativo.
- [x] Imagens visualizadas contam com overlay transparente e bloqueio CSS de drag & drop e seleção.
- [x] O clique com o botão direito do mouse no visualizador é completamente bloqueado.

---

## Histórico de Ajustes e Correções

### Correção de CSP & Renderização do Visualizador (Julho/2026)

- **Correção da CSP (Helmet):** Atualizada a configuração de segurança no `src/app.js` para adicionar a CDN `https://cdnjs.cloudflare.com` à diretiva `scriptSrc` e adicionada a diretiva `workerSrc: ["'self'", "blob:", "https://cdnjs.cloudflare.com"]`. Isso viabilizou o carregamento e execução do motor do `PDF.js` da Mozilla em ambiente de produção sem ser bloqueado pela Content Security Policy do navegador.
- **Correção de Extensão de Arquivo:** Alterado o arquivo `public/modules/contratos/dashboard-contratos-docusigner.js` para adicionar a extensão `.pdf` no nome dos arquivos gerados pelo sistema (`documents`) durante a renderização (ex: `TERMO.pdf`). Isso corrigiu a falha onde o frontend tentava renderizar esses documentos como imagens (usando a tag `<img>` e gerando imagem quebrada), garantindo que sejam corretamente identificados e renderizados no visualizador de PDFs.
