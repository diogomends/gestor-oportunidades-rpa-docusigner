# Inventario de Rotas HTTP (REST)

> **Gerado automaticamente** por `node tools/generate-routes-inventory.js`
> Nao edite manualmente — rode o script para atualizar.

## Registros

| Metodo | Path completo | Descricao curta | Auth | Arquivo:linha | Observacao |
|--------|---------------|-----------------|------|---------------|------------|
| GET | `/api/acl/matrix` | Obter matriz completa de permissoes | protect + authorize('admin') | `src/modules/acl/routes/aclRoutes.js:13` | — |
| GET | `/api/acl/me/permissions` | Obter permissoes do usuario logado | protect | `src/modules/acl/routes/aclRoutes.js:17` | — |
| GET | `/api/acl/permissions` | Obter permissoes do usuario logado (alias) | protect | `src/modules/acl/routes/aclRoutes.js:18` | — |
| GET | `/api/campaigns` | Listar campanhas | protect + perm commissions:view | `src/modules/commissions/routes.js:12` | — |
| GET | `/api/client-docs/link/:contractId` | Gerar link seguro para portal do cliente | protect + perm contracts:view | `src/modules/client-docs/routes.js:8` | — |
| GET | `/api/contracts` | Listar contratos | protect + perm contracts:view | `src/modules/contract/routes.js:108` | — |
| GET | `/api/contracts/:id` | Detalhar contrato | protect + perm contracts:view | `src/modules/contract/routes.js:114` | — |
| GET | `/api/contracts/:id/compatible-opportunities` | Listar oportunidades compativeis | protect + perm contracts:view | `src/modules/contract/routes.js:160` | — |
| GET | `/api/contracts/:id/files/:fileType/:fileIndex/download` | Baixar anexo do contrato | protect + perm contracts:download | `src/modules/contract/routes.js:137` | — |
| GET | `/api/contracts/:id/files/:fileType/:fileIndex/view` | Visualizar anexo do contrato | protect + authorize("admin", "suporte", "supervisor", "coordenador") | `src/modules/contract/routes.js:130` | — |
| GET | `/api/contracts/uploads/inspect` | Inspecionar uploads no disco | protect + authorize("admin", "suporte") | `src/modules/contract/routes.js:94` | — |
| GET | `/api/docusign/consent-url` | Obter URL de consentimento DocuSign | protect + authorize("admin", "suporte") | `src/modules/docusign/routes.js:26` | — |
| GET | `/api/docusign/download/:contractId` | Baixar documentos assinados | protect + authorize("admin", "suporte") | `src/modules/docusign/routes.js:31` | — |
| GET | `/api/docusign/portal/:hash` | Portal publico: dados do envelope | Publico | `src/modules/docusign/routes.js:22` | Publico por hash |
| GET | `/api/docusign/portal/:hash/download` | Portal publico: download doc assinado | Publico | `src/modules/docusign/routes.js:24` | Publico por hash |
| GET | `/api/docusign/signing-url/:contractId` | URL de assinatura para o signer | protect + authorize("admin", "suporte", "vendedor", "coordenador", "supervisor") | `src/modules/docusign/routes.js:30` | — |
| GET | `/api/docusign/status/:contractId` | Status do envelope DocuSign | protect + authorize("admin", "suporte", "vendedor", "coordenador", "supervisor") | `src/modules/docusign/routes.js:29` | — |
| GET | `/api/gestor-token` | Listar tokens | protect + perm gestor-token:manage | `src/modules/gestor-token/routes.js:18` | — |
| GET | `/api/gestor-token/supervisores` | Listar supervisores | protect | `src/modules/gestor-token/routes.js:13` | — |
| GET | `/api/gestor-token/ufs` | Listar UFs disponiveis | protect | `src/modules/gestor-token/routes.js:12` | — |
| GET | `/api/goals` | Listar metas | protect + perm goals:view | `src/routes/goalRoutes.js:19` | — |
| GET | `/api/import-profiles` | Listar perfis de importacao | protect + perm import_profiles:view | `src/routes/importProfileRoutes.js:26` | — |
| GET | `/api/import-profiles/:id` | Detalhar perfil de importacao | protect + perm import_profiles:view | `src/routes/importProfileRoutes.js:27` | — |
| GET | `/api/kpis` | Obter KPIs agregados do funil | protect + perm kpis:view | `src/modules/kpis/routes.js:13` | — |
| GET | `/api/offers` | Listar ofertas/produtos | protect + perm offers:view | `src/modules/produtos-precos/produtosPrecosRoutes.js:16` | — |
| GET | `/api/opportunities` | Listar oportunidades (paginado) | protect + perm opportunities:view | `src/routes/opportunityRoutes.js:50` | — |
| GET | `/api/opportunities/:id` | Detalhar oportunidade | protect + perm opportunities:view | `src/routes/opportunityRoutes.js:76` | — |
| GET | `/api/opportunities/filter-options` | Opcoes de filtro para Selects | protect + perm opportunities:view | `src/routes/opportunityRoutes.js:69` | — |
| GET | `/api/opportunities/reports/pos-smb` | Relatorio Pos-Venda SMB | protect + perm reports:view | `src/routes/opportunityRoutes.js:63` | — |
| GET | `/api/opportunities/watchlist` | Listar oportunidades da watchlist | protect + perm watchlist:manage | `src/routes/opportunityRoutes.js:33` | — |
| GET | `/api/opportunities/watchlist/config` | Obter config da watchlist | protect + perm watchlist:manage | `src/routes/opportunityRoutes.js:38` | — |
| GET | `/api/sales-ranking` | Ranking de vendas por vendedor | protect + perm sales_ranking:view | `src/modules/sales-ranking/routes.js:13` | — |
| GET | `/api/system-config` | Obter config global do sistema | protect + perm system_config:manage | `src/modules/config-sistema/routes.js:23` | — |
| GET | `/api/system-config/access-violations` | Listar violacoes de acesso | protect + perm system_config:manage | `src/modules/config-sistema/routes.js:27` | — |
| GET | `/api/system-config/ui-visibility` | Obter visibilidade de UI | protect | `src/modules/config-sistema/routes.js:34` | — |
| GET | `/api/teams` | Listar equipes com hierarquia | protect + perm teams:view | `src/routes/teamRoutes.js:19` | — |
| GET | `/api/users` | Listar usuarios | protect + perm users:view | `src/routes/userRoutes.js:23` | — |
| POST | `/api/auth/login` | Login do usuario (retorna JWT) | Publico | `src/routes/authRoutes.js:7` | — |
| POST | `/api/auth/register` | Registro de novo usuario | Publico | `src/routes/authRoutes.js:8` | — |
| POST | `/api/campaigns` | Criar campanha | protect + perm commissions:manage | `src/modules/commissions/routes.js:15` | — |
| POST | `/api/contracts` | Criar contrato (com PDFs) | protect + perm contracts:create | `src/modules/contract/routes.js:101` | — |
| POST | `/api/contracts/:id/files/clientDocs/:docType` | Upload doc do cliente | protect + authorize("admin", "suporte", "supervisor", "coordenador") | `src/modules/contract/routes.js:151` | — |
| POST | `/api/contracts/generate-pdf` | Gerar PDF via Playwright (alias) | protect + perm contracts:create | `src/modules/gerador-pdf-html/routes.js:9` | — |
| POST | `/api/contracts/generate-pdf-html` | Gerar PDF via Playwright (HTML -> PDF) | protect + perm contracts:create | `src/modules/gerador-pdf-html/routes.js:8` | — |
| POST | `/api/docusign/portal/:hash/upload` | Portal publico: upload de documento | Publico | `src/modules/docusign/routes.js:23` | Publico por hash |
| POST | `/api/docusign/resend/:contractId` | Reenviar envelope (novo signer) | protect + perm contracts:docusign_resend | `src/modules/docusign/routes.js:28` | — |
| POST | `/api/docusign/send/:contractId` | Enviar contrato para DocuSign | protect + perm contracts:docusign | `src/modules/docusign/routes.js:27` | — |
| POST | `/api/docusign/webhook` | Webhook de eventos DocuSign | Publico | `src/modules/docusign/routes.js:32` | Callback externo DocuSign |
| POST | `/api/gestor-token` | Criar token | protect + perm gestor-token:manage | `src/modules/gestor-token/routes.js:19` | — |
| POST | `/api/gestor-token/resolve` | Resolver token existente | protect | `src/modules/gestor-token/routes.js:14` | — |
| POST | `/api/goals` | Criar meta | protect + perm goals:manage | `src/routes/goalRoutes.js:20` | — |
| POST | `/api/import-profiles` | Criar perfil de importacao | protect + perm import_profiles:manage | `src/routes/importProfileRoutes.js:28` | — |
| POST | `/api/import-profiles/:id/process` | Processar importacao completa | protect + perm import_profiles:manage | `src/routes/importProfileRoutes.js:41` | — |
| POST | `/api/import-profiles/extract-headers` | Extrair cabecalhos de arquivo Excel/CSV | protect + perm import_profiles:manage | `src/routes/importProfileRoutes.js:33` | — |
| POST | `/api/offers` | Criar oferta/produto | protect + perm offers:manage | `src/modules/produtos-precos/produtosPrecosRoutes.js:17` | — |
| POST | `/api/opportunities` | Criar oportunidade | protect + perm opportunities:create | `src/routes/opportunityRoutes.js:51` | — |
| POST | `/api/opportunities/migrate-fields` | Migrar campos legados | protect + authorize("admin") | `src/routes/opportunityRoutes.js:59` | — |
| POST | `/api/opportunities/migrate-hierarchy` | Migrar hierarquia legada | protect + authorize("admin") | `src/routes/opportunityRoutes.js:60` | — |
| POST | `/api/opportunities/migrate-obs` | Migrar observacoes legadas | protect + authorize("admin") | `src/routes/opportunityRoutes.js:58` | — |
| POST | `/api/opportunities/migrate-probability` | Migrar probabilidade legada | protect + authorize("admin") | `src/routes/opportunityRoutes.js:61` | — |
| POST | `/api/teams/assign-supervisor` | Atribuir supervisor a coordenador | protect + perm teams:manage | `src/routes/teamRoutes.js:25` | — |
| POST | `/api/teams/assign-vendedor` | Atribuir vendedor a supervisor | protect + perm teams:manage | `src/routes/teamRoutes.js:31` | — |
| POST | `/api/users` | Criar usuario | protect + perm users:manage | `src/routes/userRoutes.js:27` | — |
| PUT | `/api/acl/roles/:role/permissions` | Atualizar permissoes de uma role | protect + authorize('admin') | `src/modules/acl/routes/aclRoutes.js:14` | — |
| PUT | `/api/campaigns/:id` | Atualizar campanha | protect + perm commissions:manage | `src/modules/commissions/routes.js:20` | — |
| PUT | `/api/contracts/:id` | Atualizar contrato | protect + perm contracts:upload | `src/modules/contract/routes.js:120` | — |
| PUT | `/api/contracts/:id/opportunity` | Vincular oportunidade ao contrato | protect + perm contracts:upload | `src/modules/contract/routes.js:167` | — |
| PUT | `/api/gestor-token` | — | protect + perm gestor-token:manage | `src/modules/gestor-token/routes.js:23` | — |
| PUT | `/api/goals` | — | protect + perm goals:manage | `src/routes/goalRoutes.js:24` | — |
| PUT | `/api/import-profiles/:id` | Atualizar perfil de importacao | protect + perm import_profiles:manage | `src/routes/importProfileRoutes.js:29` | — |
| PUT | `/api/offers` | — | protect + perm offers:manage | `src/modules/produtos-precos/produtosPrecosRoutes.js:21` | — |
| PUT | `/api/opportunities/:id` | Atualizar oportunidade | protect + perm opportunities:edit | `src/routes/opportunityRoutes.js:77` | — |
| PUT | `/api/opportunities/watchlist/config` | Atualizar config da watchlist | protect + perm watchlist:manage | `src/routes/opportunityRoutes.js:43` | — |
| PUT | `/api/system-config` | Atualizar config global do sistema | protect + perm system_config:manage | `src/modules/config-sistema/routes.js:24` | — |
| PUT | `/api/system-config/ui-visibility` | Atualizar visibilidade de UI | protect + perm system_config:manage | `src/modules/config-sistema/routes.js:35` | — |
| PUT | `/api/users` | — | protect + perm users:manage | `src/routes/userRoutes.js:31` | — |
| PATCH | `/api/campaigns/:id/status` | Ativar/desativar campanha | protect + perm commissions:manage | `src/modules/commissions/routes.js:30` | — |
| PATCH | `/api/opportunities/:id/status` | Atualizar status (mover no funil) | protect + perm opportunities:edit | `src/routes/opportunityRoutes.js:84` | — |
| PATCH | `/api/users/:id/reactivate` | Reativar usuario desativado | protect + perm users:manage | `src/routes/userRoutes.js:35` | — |
| DELETE | `/api/campaigns/:id` | Deletar campanha | protect + perm commissions:manage | `src/modules/commissions/routes.js:25` | — |
| DELETE | `/api/contracts/:id` | Deletar contrato | protect + perm contracts:delete | `src/modules/contract/routes.js:127` | — |
| DELETE | `/api/contracts/:id/files/:fileType/:fileIndex` | Deletar anexo especifico | protect + authorize("admin") | `src/modules/contract/routes.js:144` | — |
| DELETE | `/api/gestor-token` | — | protect + perm gestor-token:manage | `src/modules/gestor-token/routes.js:24` | — |
| DELETE | `/api/goals` | — | protect + perm goals:manage | `src/routes/goalRoutes.js:25` | — |
| DELETE | `/api/import-profiles/:id` | Deletar perfil de importacao | protect + perm import_profiles:manage | `src/routes/importProfileRoutes.js:30` | — |
| DELETE | `/api/offers` | — | protect + perm offers:manage | `src/modules/produtos-precos/produtosPrecosRoutes.js:22` | — |
| DELETE | `/api/opportunities/:id` | Deletar oportunidade | protect + perm opportunities:delete | `src/routes/opportunityRoutes.js:81` | — |
| DELETE | `/api/users` | — | protect + perm users:manage | `src/routes/userRoutes.js:32` | — |
| GET | `/:cnpj_company_docs (regex)` | SPA: pagina do portal do cliente | Publico | `client-server/server.js:70` | Client Server (porta 3001) |
| GET | `/contract/:hash` | Dados do contrato por hash (JSON) | Publico | `client-server/server.js:74` | Client Server (porta 3001) |
| GET | `/download/:hash/docusign` | Download do documento assinado | Publico | `client-server/server.js:156` | Client Server (porta 3001) |
| POST | `/upload/:hash` | Upload de documento do cliente | Publico | `client-server/server.js:104` | Client Server (porta 3001) |

## Legenda

| Notacao | Significado |
|---------|-------------|
| Publico | Sem autenticacao JWT |
| protect | Requer JWT valido via authMiddleware.protect |
| protect + admin | JWT + authorize("admin") |
| protect + perm X:Y | JWT + authorizePermission("X:Y") via ACL |
| Publico (por hash) | Acesso via hash opaco (sem JWT) |

## Proxy Nginx (acesso externo)

| Location | Destino | Arquivo |
|----------|---------|---------|
| `/` | `rpa_docusigner_stream` | `nginx/default.conf:9` |
| `~ /api/robot-docusign/jobs/.*/stream` | `rpa_docusigner_stream` | `nginx/default.conf:13` |
| `/api/robot-docusign/` | `rpa_docusigner_api` | `nginx/default.conf:24` |
| `@robot_fallback` | `http` | `nginx/default.conf:39` |
| `/api` | `http` | `nginx/default.conf:46` |
| `/cliente/` | `http` | `nginx/default.conf:57` |
| `~ /.*_docs$` | `http` | `nginx/default.conf:63` |
| `/api/client/` | `http` | `nginx/default.conf:70` |

## Observacoes de Seguranca

1. `/api/robot-docusign/**` e interceptado pelo Nginx e vai direto para `rpa_docusigner:3111` (fora do Node).
2. O backend Node nao aplica auth nessas rotas; a seguranca depende do que o servico 3111 valida internamente.
3. `/api/docusign/portal/*` e `/api/docusign/webhook` sao publicos por design.
4. Rotas duplicadas em `/api/me/*` espelham `/api/acl/*` (alias de conveniencia).

## Resumo

- **App Principal:** 88 endpoints
- **Client Server:** 4 endpoints
- **Total:** 92 endpoints
