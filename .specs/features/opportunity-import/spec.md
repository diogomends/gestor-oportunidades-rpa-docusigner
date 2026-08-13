# Especificação: Módulo de Importação de Oportunidades (Import Profiles)

> Importação em massa e atualização de oportunidades via planilha Excel (.xlsx) com mapeamento dinâmico por perfil e controle de acesso via ACL.

---

## Visão Geral

O módulo `import-opportunities` permite a carga massiva de atualizações em oportunidades existentes no banco de dados MongoDB (`db_crm_funil`) a partir de arquivos `.xlsx`. 

A busca de oportunidade correspondente para cada linha da planilha é realizada via **CPF/CNPJ** sanitizado (apenas números). O sistema **não cria** novas oportunidades, limitando-se a atualizar exclusivamente um conjunto estrito de campos permitidos mais atributos genéricos em `imported_data.*`.

O fluxo envolve a seleção/criação de um **Perfil de Mapeamento** (relação coluna-Excel x campo-Banco), upload do arquivo de dados, processamento linha por linha com tolerância a falhas (execução parcial) e exibição de relatório detalhado (sucessos/erros) com auditoria registrada em `AuditLog`. A permissão de acesso é integrada ao módulo `controle-acesso-acl-rbac`.

---

## Requisitos Funcionais

### [REQ-001] Gerenciamento CRUD de Perfis de Importação
- **Endpoints**: `GET`, `POST`, `PUT`, `DELETE` em `/api/import-profiles/`
- **Descrição**: Permite listar, criar, editar e excluir perfis reutilizáveis de importação associados a uma equipe de vendas (`SMB` ou `ULTRA`).
- **Critérios de Aceite**:
  - Salva nome, descrição, equipe de vendas (`equipe_venda`), ID do criador (`createdBy`) e o mapeamento de colunas (`fileHeader` -> `dbField`).
  - Impede nomes duplicados por equipe de vendas.
  - A exclusão ou edição é restrita conforme permissão em `controle-acesso-acl-rbac`.

### [REQ-002] Extração e Preview de Cabeçalhos (.xlsx)
- **Endpoint**: `POST /api/import-profiles/extract-headers`
- **Descrição**: Recebe um arquivo Excel (.xlsx) temporário via upload (`multer`) e extrai os nomes dos cabeçalhos da primeira linha/aba para auxiliar no mapeamento.
- **Critérios de Aceite**:
  - Retorna JSON contendo a lista de strings dos cabeçalhos identificados na primeira linha da planilha.
  - Suporta arquivos até 50MB.
  - Retorna erro amigável em caso de arquivo corrompido ou formato inválido.

### [REQ-003] Processamento de Importação por CPF/CNPJ
- **Endpoint**: `POST /api/import-profiles/:id/process`
- **Descrição**: Processa um arquivo Excel `.xlsx` aplicando o mapeamento do perfil especificado (`:id`).
- **Critérios de Aceite**:
  - Sanitiza o documento de busca da linha da planilha (remover pontuações, traços e barras mantendo apenas dígitos).
  - Executa busca por CPF/CNPJ correspondente no modelo `Opportunity`.
  - Se a oportunidade **não for encontrada**, a linha é marcada com status de erro ("Oportunidade não encontrada para CPF/CNPJ [doc]") e o processamento prossegue para as linhas seguintes.
  - O sistema **nunca cria** novos documentos no MongoDB.

### [REQ-004] Restrição e Atualização de Campos Permitidos
- **Descrição**: Garante que o motor de atualização modifique estritamente os campos permitidos da oportunidade.
- **Campos Permitidos**:
  - `negociacao`
  - `tipo_negociacao`
  - `quantidade_acessos`
  - `receita`
  - `status_negociacao`
  - `quantidade_aparelhos`
  - `imported_data.*` (objeto/mapa dinâmico para armazenamento de dados legados/extras da planilha)
- **Critérios de Aceite**:
  - Mapeamentos informados no perfil que tentarem alterar campos protegidos (como `_id`, `created_at`, `cpf_cnpj`, `user_id`) devem ser rejeitados ou ignorados durante a importação.
  - Atualizações efetuadas registram timestamp de alteração no documento.

### [REQ-005] Relatório Parcial de Execução e Auditoria
- **Descrição**: Retorna o detalhamento linha por linha do resultado da operação e grava registro no `AuditLog`.
- **Critérios de Aceite**:
  - O relatório retornado via HTTP contém: `total_linhas`, `sucessos`, `erros` e array `detalhes` (número da linha, CPF/CNPJ, status `SUCCESS`/`ERROR`, mensagem).
  - O processamento é tolerante a falhas (execução parcial): falhas em linhas individuais não revertem linhas processadas com sucesso.
  - Cria entrada no modelo `AuditLog` registrando a ação `IMPORT_OPPORTUNITIES`, perfil utilizado, total de atualizações com sucesso, total de falhas e ID do usuário executor.

### [REQ-006] Interface Frontend SPA e Modais
- **Arquivos Frontend**:
  - `public/import-profiles.html`
  - `public/css/import-profiles.css`
  - `public/js/pages/import-profiles.js`
  - `public/modules/import-profile/index.js`
  - `public/modules/import-profile/api.js`
  - `public/modules/import-profile/ui.js`
  - `public/modules/import-profile/mapping-ui.js`
  - `public/modules/import-profile/constants.js`
  - `public/modules/import-profile/auto-mapper.js`
- **Estrutura da UI**:
  1. **Tabela Principal**: Lista perfis cadastrados com ações: *Executar*, *Editar*, *Excluir*.
  2. **Modal Perfil (Stepper 3 Passos)**:
     - Passo 1: Upload (seleção de planilha modelo para ler cabeçalhos)
     - Passo 2: Mapeamento (associação dinâmica coluna-Excel -> campo-Banco com auto-mapper)
     - Passo 3: Dados Básicos (Nome do Perfil, Descrição, Equipe de Vendas)
     - Modo Criação: Fluxo passo 1 -> 2 -> 3.
     - Modo Edição: Fluxo passo 3 -> 2 -> 1.
  3. **Modal Executar**:
     - Upload da planilha de dados real (.xlsx)
     - Indicador de progresso/carregamento durante processamento
     - Dashboard de Resultados com estatísticas (total, sucessos, erros) e tabela de detalhes filtrável por linha.

### [REQ-007] Integração com Controle de Acesso (ACL) e Sidebar
- **Descrição**: O menu lateral e as rotas de API devem ser protegidos pela permissão de controle de acesso (`controle-acesso-acl-rbac`).
- **Critérios de Aceite**:
  - Item "Perfis de Importação" exibido na Sidebar na seção "Configurações Técnicas".
  - O acesso à tela `import-profiles.html` e a todas as rotas `/api/import-profiles/*` exige autorização validada via middleware de ACL.

---

## Estrutura de Arquivos

```
src/
├── models/
│   └── ImportProfile.js                  # Model Mongoose do Perfil de Importação
├── modules/
│   └── import-opportunities/
│       ├── controllers/
│       │   ├── process-import.js         # POST /api/import-profiles/:id/process
│       │   ├── extract-headers.js        # POST /api/import-profiles/extract-headers
│       │   └── profile-crud.js           # GET, POST, PUT, DELETE /api/import-profiles
│       └── services/
│           ├── find-opportunity-by-document.js # Busca oportunidade sanitizando CPF/CNPJ
│           ├── update-opportunity-fields.js    # Filtra e aplica campos permitidos
│           └── read-excel-file.js              # Leitura de planilha via library xlsx
└── routes/
    └── importProfileRoutes.js            # Montagem das rotas com middlewares de auth/ACL

public/
├── import-profiles.html                  # HTML da página de perfis
├── css/
│   └── import-profiles.css               # Estilos da página e modais
├── js/
│   └── pages/
│       └── import-profiles.js            # Entrypoint JS da página
└── modules/
    └── import-profile/
        ├── index.js                      # Inicializador do módulo frontend
        ├── api.js                        # Requisições HTTP para /api/import-profiles
        ├── ui.js                         # Renderização de tabela e controle de modais
        ├── mapping-ui.js                 # Renderização da interface de mapeamento
        ├── constants.js                  # Constantes e dicionário de campos permitidos
        └── auto-mapper.js                # Sugestão automática de mapeamento por semelhança
```

---

## Restrições & Preservação (Impact Protector)

- **Módulos Legados Preservados**: `src/modules/opportunities/` (controllers e aggregations de Kanban/Filtros/Métricas), `src/modules/contract/`, `src/modules/commissions/`, `src/modules/watchlist/`.
- **Model Opportunity**: O schema em `src/models/Opportunity.js` permanece intocado. Nenhuma propriedade de busca/estrutura de indices é removida.
- **Proibição de Criação**: Nenhuma nova oportunidade é criada pela importação.
- **Frontend Preservado**: Nenhuma alteração em páginas existentes (`index.html`, `kanban.html`, `dashboard.html`). Inclusão do link do menu é realizada estritamente via injeção/módulo dinamico da Sidebar.
