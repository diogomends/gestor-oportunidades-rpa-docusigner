# CRUD de Anexos no Dashboard de Contratos — Specification

## Problem Statement

Atualmente, o Dashboard de Contratos DocuSign (`dashboard-contratos-docusigner.html`) renderiza apenas os anexos (`clientDocs`) que o cliente efetivamente já enviou através do portal público. Se um documento exigido está pendente, o operador do CRM não sabe visualmente o que falta (exceto acessando o portal) e não tem uma maneira direta de fazer o upload desse documento pelo CRM em nome do cliente. É necessário exibir de forma estruturada todos os documentos exigidos para o contrato com base no tipo de empresa (MEI, ME, LTDA, EIRELI, S.A., etc.), colorindo-os de verde (se presente) ou vermelho (se ausente) e fornecendo ações de CRUD completo (visualizar, baixar, excluir e fazer upload) diretamente da listagem de cards.

## Goals

- Mapear dinamicamente os documentos exigidos com base no tipo de empresa do contrato (`client.tipoEmpresa`).
- Exibir indicadores de status visual: **Verde** para documentos já enviados/presentes, **Vermelho** para documentos pendentes/ausentes.
- Exibir os botões de CRUD existentes (Visualizar, Download, Excluir) para os documentos presentes.
- Exibir um botão de **Upload** para documentos pendentes/ausentes que permita carregar o arquivo diretamente pela tela.
- Implementar uma nova rota no backend principal do CRM (`POST /api/contracts/:id/files/clientDocs/:docType`) para receber arquivos de anexo e atualizá-los com segurança no banco de dados e no storage físico.

## Naming Standards (Nomenclatura)

De acordo com o tipo de empresa selecionado (`client.tipoEmpresa`), os anexos exibidos e seus respectivos IDs lógicos devem ser:

| Tipo de Empresa | Nome Exibido (Label) | ID Lógico (`docType` ou `type`) |
|-----------------|----------------------|---------------------------------|
| **MEI**         | "CCMEI"              | `certificado_mei`               |
|                 | "Endereço"           | `comprovante_residencia`        |
|                 | "RG"                 | `documento_identidade`          |
| **ME**          | "Contrato"           | `contrato_social`               |
|                 | "Endereço"           | `comprovante_residencia`        |
|                 | "RG"                 | `documento_identidade`          |
| **LTDA** / **EIRELI** / **S.A.** | "Contrato" | `contrato_social`         |
|                 | "RG"                 | `documento_identidade`          |
| **Associação** / **Sindicato** / **Condomínio** | "Estatuto" | `estatuto_ata` |
|                 | "RG"                 | `documento_identidade`          |

*Nota: Se o tipo de empresa for desconhecido ou não mapeado, utilizaremos como padrão (fallback) os documentos de MEI.*

---

## User Stories

### P1: Exibição Dinâmica e Indicadores Coloridos (Verde/Vermelho)

**User Story:** Como usuário do CRM, quero que cada card de contrato no dashboard liste todos os anexos exigidos de acordo com o tipo de empresa, marcando-os em verde caso já tenham sido enviados ou vermelho caso estejam pendentes.

**Acceptance Criteria:**

1. **CONTR-ANEXO-01**: O frontend deve carregar o tipo de empresa do contrato (`client.tipoEmpresa`). Se ausente, usa "MEI" como padrão de fallback.
2. **CONTR-ANEXO-02**: A lista de anexos em cada card deve exibir todos os documentos exigidos para aquele tipo de empresa, respeitando a tabela de nomenclatura (ex: "CCMEI", "Endereço", "RG").
3. **CONTR-ANEXO-03**: Se o documento correspondente (identificado pelo ID lógico) já estiver no array `docusign.clientDocs` do contrato, seu item `.attachment-item` deve:
   - Ter uma indicação visual / estilo **Verde** (borda verde sutil ou badge correspondente).
   - Exibir os botões de ação de CRUD existentes (Visualizar, Baixar, Deletar) controlados pela ACL do cargo.
4. **CONTR-ANEXO-04**: Se o documento correspondente estiver ausente no array `docusign.clientDocs` do contrato, seu item `.attachment-item` deve:
   - Ter uma indicação visual / estilo **Vermelho** (borda vermelha ou estilo correspondente indicando pendência).
   - Exibir um botão de **Upload** (ícone `ph-upload` ou similar) para permitir o envio do documento.

---

### P1: Upload Direto no CRM (Novo Endpoint e Integração Frontend)

**User Story:** Como operador do CRM (admin/suporte), quero clicar no botão de upload de um documento pendente no dashboard, selecionar o arquivo físico e fazer o envio diretamente para o servidor.

**Acceptance Criteria:**

5. **CONTR-ANEXO-05**: Ao clicar no botão de upload de um anexo pendente (vermelho), o sistema deve abrir um seletor de arquivos. Apenas tipos de arquivo permitidos (`PDF`, `JPG`, `PNG`) com tamanho máximo de `10 MB` devem ser aceitos.
6. **CONTR-ANEXO-06**: O frontend deve enviar uma requisição `POST` com `FormData` contendo o arquivo para o endpoint `/api/contracts/:id/files/clientDocs/:docType`.
7. **CONTR-ANEXO-07**: O backend do CRM deve implementar a rota `POST /api/contracts/:id/files/clientDocs/:docType` protegida por autenticação.
8. **CONTR-ANEXO-08 (ACL do Upload)**: Apenas usuários com cargos `admin` e `suporte` podem efetuar o upload do arquivo no backend do CRM. Vendedores e outros cargos recebem HTTP 403.
9. **CONTR-ANEXO-09 (Processamento do Upload)**: O backend deve:
   - Salvar o arquivo no disco sob o diretório do contrato (`uploads/{CNPJ}_{RazaoSocial}/`).
   - Se já houver um anexo antigo com o mesmo `type` (ou `docType`), remover o arquivo físico antigo e atualizar a entrada existente no mesmo índice do array `docusign.clientDocs` (*in-place*), preservando a ordenação do array.
   - Se for um novo documento, adicionar com os metadados corretos (`type`, `originalName`, `filePath`, `uploadedAt`) no array `docusign.clientDocs` do contrato no MongoDB.
   - Permitir a busca e manipulação de `clientDocs` tanto por `docType` (string) quanto por índice numérico (com suporte a retrocompatibilidade nas rotas de visualização, download e deleção).
   - Retornar sucesso HTTP 200/201.

---

## Edge Cases

- **Tipo de empresa desconhecido ou nulo**: Fallback para as regras de MEI ("CCMEI", "Endereço", "RG").
- **Carregamento de arquivo com caracteres especiais no nome**: Sanitizar o nome do arquivo ao salvar.
- **Exclusão de um arquivo que não existe fisicamente**: O banco de dados deve ser limpo normalmente, e o erro do storage físico deve ser tratado sem quebrar a requisição.
- **Usuário com cargo Vendedor tenta burlar chamando a API de upload**: O middleware de backend `authorize("admin", "suporte")` deve retornar HTTP 403 (Proibido).

---

## Success Criteria

- [ ] Todos os cards de contrato no dashboard exibem as listas de anexos adequadas ao tipo de empresa.
- [ ] Documentos presentes ficam com borda/fundo verde e exibem Visualizar/Baixar/Deletar.
- [ ] Documentos ausentes ficam com borda/fundo vermelho e exibem um botão de Upload.
- [ ] O upload de arquivos pelo dashboard envia os arquivos corretamente para a pasta de uploads do respectivo contrato, substituindo anteriores se necessário.
- [ ] Testes unitários ou de integração comprovam que a rota de upload do backend responde HTTP 200/201 para admins/suporte e HTTP 403 para vendedores.
