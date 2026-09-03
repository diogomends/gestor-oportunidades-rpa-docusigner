# AGENTS.md — Gestor de Oportunidades RPA DocuSigner

Serviço Node.js que automatiza login e ações no DocuSign via Playwright (RPA). Expõe API REST para orquestração de jobs, gerenciamento de sessões do robô e monitoramento.

## Comandos

| Comando                                                                         | O que faz                                             |
| ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `npm start` / `make start`                                                      | Produção (`node backend/src/server.js`)               |
| `npm run dev` / `make dev`                                                      | Dev com nodemon (`backend/src/server.js`)             |
| `npm test` / `make test`                                                        | Testes nativos (`node --test` em `tests/**/*.test.js`) |
| `npm run test:backend`                                                          | Testes backend (`tests/backend/**`)                    |
| `npm run test:robot`                                                            | Testes robô (`tests/robot/**`)                         |
| `npm run build:robot` / `make build-robot`                                      | Gera executáveis dos robôs (`ROLE=query\|enviar\|all`)  |
| `npm run build:robot:query`                                                     | Gera executável exclusivo de consulta (`robot-query`)   |
| `npm run build:robot:enviar` / `npm run build:robot:update` (alias)            | Gera executável exclusivo de envio (`robot-enviar`)     |
| `npm run build:robot:all`                                                       | Gera todos os executáveis para todas as chaves e papéis  |
| `make execute-robot`                                                            | Executa os robôs de consulta e envio (query-1 e enviar-1) |
| `make execute-robot-query` / `make execute-robot-enviar` (`update` alias)      | Executa individualmente o robô de consulta ou envio |
| `npx playwright install chromium`                                               | Instala browser Chromium para o robô                  |
| `make install` / `make install-backend` / `make install-robot`                  | Instalação de dependências (raiz/backend/robô)        |
| `docker compose up --build` / `make up-dev`                                     | Sobe servidor em container Docker local               |
| `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` | Sobe servidor em produção via Docker (`make up-prod`)  |
| `make down` / `make logs` / `make reset`                                        | Gestão de containers Docker (parar/logs/reset)        |
| `make tunnel`                                                                   | Abre túnel SSH seguro com MongoDB remoto (27018)      |
| `make check-pending-jobs` / `make check-pending-jobs-prod`                      | Diagnóstico de jobs pendentes e contratos elegíveis   |
| `make db-and-collection`                                                        | Exibe árvore de bancos e coleções MongoDB local       |
| `make db-and-collection-prod`                                                   | Exibe árvore de bancos e coleções no container prod   |
| `make clean-contracts` / `make clean-contracts-prod`                            | Limpa com segurança coleções de contratos e envelopes (local/remoto) |
| `make mongosh-contracts` / `make mongosh-contracts-prod`                        | Conexão mongosh ao banco de contratos (local/remoto)  |
| `make mongosh-jobs` / `make mongosh-jobs-prod`                                  | Consulta jobs do robô no MongoDB (local/remoto)       |
| `make mongosh-instances` / `make mongosh-instances-prod`                        | Consulta instâncias do robô no MongoDB (local/remoto) |
| `make mongosh-config` / `make mongosh-config-prod`                              | Consulta config do robô no MongoDB (local/remoto)    |
| `make ssh-uploads-prod`                                                         | Abre sessão SSH interativa na pasta uploads de prod  |
| `make ls-uploads-prod`                                                          | Lista arquivos e pastas em uploads no servidor prod   |
| `make fetch-robot-debug-images`                                                 | Baixa screenshots de debug do container de produção   |
| `make routes-inventory`                                                         | Gera inventário de rotas HTTP em `.specs/`            |
| `make routes-inventory-check`                                                   | Valida integridade do inventário de rotas (CI)        |
| `make clean` / `make clean-test` / `make clean-all`                             | Limpeza de build, artefatos temporários e dependências |
| `make opencode-switcher` / `make opencode-conta1` / `make opencode-conta2`      | Alternador e seletor de contas do OpenCode CLI        |

Porta padrão: **3111** (configurável via `PORT`).

## Deploy & CI/CD

O projeto possui esteira automatizada via **GitHub Actions** (`.github/workflows/deploy.yml`):

- Disparo automático em `push` na branch `main` ou manual via `workflow_dispatch`.
- Conecta via SSH no `servidor-unity-rce` (`165.227.212.57`) e executa o build/restart dos containers Docker (`app_docusigner`).
- O arquivo `.env` de produção é mantido no servidor em `/home/appuser/servidor-unity-rce/gestor-oportunidades-rpa-docusigner/.env`.
- Limpeza periódica de runs via `.github/workflows/clean-workflows.yml`.

## Projeto Relacionado

Este projeto interage com `gestor-oportunidades` em `C:\www\producao\servidor-unity-rce\gestor-oportunidades`. Consulte-o antes de alterar schemas ou fluxos que impactem dados compartilhados (usuários, contratos, configurações).

## Arquitetura

```
├── backend/
│   ├── package.json       # Dependências e scripts do servidor Express
│   └── src/
│       ├── server.js          # Entrypoint: dotenv, import models, connectDB, connectContractsDB, robotScheduler.start(), statusSyncScheduler.start(), listen
│       ├── app.js             # Express: JSON 10mb, CORS, Helmet, morgan, montagem de rotas
│       ├── config/
│       │   └── database.js    # 3 conexões: default (db_crm_funil), crm_contracts, crm_acl
│       ├── models/            # User.js, Contract.js, SystemConfig.js (3 modelos)
│       ├── middlewares/       # authMiddleware.js (protect), roleMiddleware.js (authorize)
│       ├── services/          # docusignService.js, gestorApiClient.js
│   ├── utils/             # crypto.js, timeRestrictionService.js
│       └── modules/
│           └── robot-docusign/  # Módulo de domínio
│               ├── index.js           # Exporta routes, orchestrator, session, scheduler, browserrobot, seletorApiRobot
│               ├── routes.js          # Rotas Express (prefixo /api/robot-docusign)
│               ├── controllers/       # robotDocusignController.js, robotInstanceController.js
│               ├── models/            # RobotJob.js, RobotSession.js, RobotInstance.js
│               ├── selectors/         # Selectors CSS para automação do DocuSign
│               ├── routes/            # robotInstanceRoutes.js
│               ├── browserrobot/      # Submódulo Playwright (index.js barrel, browserRobot.js [send+executeWithBrowser], robotSession.js, agreementsService.js, robotSelectors.js, steps/)
│               ├── seletorApiRobot/   # Submódulo de Seleção & Orquestração (index.js, orchestratorConfig.js, orchestratorEvents.js, apiActionService.js, contractSyncService.js, robotScheduler.js, statusSyncScheduler.js)
│               ├── utils/             # roleActions.js (ROLE_ENUM/ROLE_ACTIONS/getAllowedActions AD-054), normalizeString.js (NFD/acento AD-054), contractEligibility.js (GERADO_ELIGIBLE_FILTER / CONTRACT_ELIGIBLE_FILTER, isEligibleForSend/hasPdf/hasRecipientEmail — filtro não-rascunho + PDF + e-mail AD-038/AD-050), imapClient.js (MFA IMAP nativo UID SEARCH/FETCH/STORE + parseUidsFromSearch + clockDrift 60s AD-058/AD-059/AD-061)
│               └── services/          # Fachadas DIP (re-export seletorApiRobot/* — canônico seletorApiRobot, services é barrel estável para server.js AD-054)
├── robot/
│   ├── package.json       # Dependências e scripts do robô (Playwright, pkg, bytenode, esbuild)
│   ├── src/               # Código-fonte da automação (main, job-runner, scheduler)
│   │   ├── browser/       # docusign.js (facade), auth.js, envelopes.js, agreements.js, statusParser.js, imapClient.js, roundcube.js, selectors.js, steps/ (uploadStep, fillRecipientsStep, advancePrepareStep, submitEnvelopeStep, extractEnvelopeIdStep, stepUtils — pipeline 8 etapas AD-064)
│   │   └── utils/         # logger.js (logs coloridos ANSI) + roleActions.js (ROLE_ACTIONS espelho backend AD-054) + playwrightResolver.js (resolvePlaywright/getChromium/resolveChromiumExecutablePath/assertChromiumInstalled — fail-fast Chromium com hint setup.bat, fonte única main.js + job-runner.js AD-065)
│   ├── build/             # Pipeline de compilação/ofuscação/empacotamento (.exe)
│   ├── scripts/           # Scripts de instalação e inicialização do robô
│   ├── dist/              # Saída do build: subpastas por chave (robot-docusigner-1/, robot-docusigner-2/, ...)
│   ├── dist-bundle/       # Bundle temporário do esbuild (CJS)
│   ├── dist-obf/          # Código ofuscado temporário
│   └── dist-jsc/          # Bytecode V8 temporário (.jsc)
├── test/
│   ├── backend/               # Testes backend (controllers, models, services)
│   └── robot/                 # Testes robô (browser/)
```

- **ES Modules** puro. Use `import`/`export`.
- **Frontend**: nenhum neste projeto (serviço backend puro).
- `server.js` importa models diretamente para garantir registro de schemas antes do uso.
- `robotScheduler.start()` e `statusSyncScheduler.start()` são chamados automaticamente no boot do servidor.

## Rotas

Prefixo `/api/robot-docusign` (exceto `/health` na raiz):

| Método | Rota                                  | Auth                             | Descrição                                                    |
| ------ | ------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| POST   | `/trigger`                            | `protect`                        | Dispara job individual síncrono (body: `contractId`/`contract_id`) |
| POST   | `/trigger-batch`                      | `protect` + `authorize("admin")` | Dispara jobs em lote                                         |
| GET    | `/status/:jobId`                      | `protect`                        | Status de um job (busca por `_id` ou `contract_id`)          |
| GET    | `/jobs`                               | `protect`                        | Lista jobs (filtros + paginação)                             |
| GET    | `/jobs/:jobId/stream`                 | `protect`                        | SSE stream de progresso do job                               |
| GET    | `/metrics`                            | `protect`                        | Métricas agregadas                                           |
| GET    | `/logs/:jobId`                        | `protect`                        | Logs detalhados de um job                                    |
| GET    | `/config`                             | `protect`                        | Buscar config do robô                                        |
| PUT    | `/config`                             | `protect` + `authorize("admin")` | Atualizar config do robô                                     |
| POST   | `/test-login`                         | `protect` + `authorize("admin")` | Testa login no DocuSign (aceita `otpCode` opcional)          |
| GET    | `/queue`                              | `protect`                        | Fila de jobs pendentes/em processamento                      |
| POST   | `/process-pending`                    | `protect`                        | Processa até 1 contrato pendente (scheduler)                 |
| POST   | `/sync-status`                        | `protect`                        | Executa varredura de sincronização geral de status sob demanda |
| GET    | `/instances`                          | `protect` + `authorize("admin")` | Lista instâncias do robô (fleet monitoring)                  |
| POST   | `/instance/auth`                      | público                          | Autenticação da instância (`X-Robot-Key` ou `email`/`senha`) |
| GET    | `/instance/instances`                 | `protect` + `authorize("admin")` | Lista instâncias (via sub-router)                            |
| GET    | `/instance/config`                    | `protect`                        | Config da instância                                          |
| GET    | `/instance/next-job`                  | `protect`                        | Próximo job pendente (polling do robô `.exe`)                |
| PATCH  | `/instance/job/:jobId/status`         | `protect`                        | Atualiza status do job                                       |
| POST   | `/instance/heartbeat`                 | `protect`                        | Heartbeat da instância                                       |
| GET    | `/instance/contracts/:contractId/pdf` | `protect`                        | Download de PDF do contrato                                  |

Fora do prefixo:

| Método | Rota      | Auth    | Descrição                               |
| ------ | --------- | ------- | --------------------------------------- |
| GET    | `/health` | público | Health check (rota raiz em `app.js:15`) |

## Banco de Dados

| Database        | Variável de conexão     | Quem usa           | Observação                           |
| --------------- | ----------------------- | ------------------ | ------------------------------------ |
| `db_crm_funil`  | `MONGO_URI` (default)   | User, SystemConfig | Banco principal                      |
| `crm_contracts` | `MONGO_CONTRACTS_URI`   | Contract           | Conecta via `useDb("crm_contracts")` |
| `crm_acl`       | (função `connectAclDB`) | —                  | Disponível mas não chamada no boot   |

> `MONGO_CONTRACTS_URI` aponta para o **mesmo servidor** de `MONGO_URI`. O `database.js` faz `useDb("crm_contracts")` na mesma conexão mongoose.

## Variáveis de Ambiente

| Variável                        | Obrigatória | Padrão                      |
| ------------------------------- | ----------- | --------------------------- |
| `PORT`                          | Não         | 3111                        |
| `MONGO_URI`                     | Sim         | —                           |
| `MONGO_CONTRACTS_URI`           | Sim         | —                           |
| `JWT_SECRET`                    | Sim         | —                           |
| `NODE_ENV`                      | Não         | development                 |
| `DOCUSIGN_INTEGRATION_KEY`      | Não         | —                           |
| `DOCUSIGN_USER_ID`              | Não         | —                           |
| `DOCUSIGN_ACCOUNT_ID`           | Não         | —                           |
| `DOCUSIGN_RSA_PRIVATE_KEY_PATH` | Não         | —                           |
| `DOCUSIGN_HMAC_KEY`             | Não         | —                           |
| `DOCUSIGN_BASE_PATH`            | Não         | na.docusign.net             |
| `USUARIO_DOCUSIGNER`            | Não         | —                           |
| `SENHA_DOCUSIGNER`              | Não         | —                           |
| `DOCUSIGN_SESSION_PATH`         | Não         | `session-docusign.json`     |
| `GESTOR_API_URL`                | Sim         | `http://localhost:3000/api` |
| `ROBOT_API_KEY`                 | Sim         | —                           |
| `API_URL` / `URI_PROD`          | Não         | `http://localhost:3111`     |
| `ROBOT_KEY`                     | Não         | —                           |
| `ROBOT_ROLE`                    | Não         | `all`                       |
| `HEADLESS`                      | Não         | `true`                      |
| `POLL_INTERVAL_SECONDS`         | Não         | `15`                        |
| `DEPLOY_HOST`                   | Não         | `root@165.227.212.57`       |
| `DEPLOY_KEY` / `DEPLOY_KEY_PATH`| Não         | —                           |
| `REMOTE_PROJECT_PATH`           | Não         | —                           |

> Credenciais DocuSign e do robô podem vir do banco (`SystemConfig`) ou de variáveis de ambiente como fallback. O robô standalone (`robot/src/config.js`) carrega automaticamente o arquivo `.env` da raiz e aceita `URI_PROD` como fallback para `API_URL`. A resolução de MFA (2FA) DocuSign consome as credenciais de `token_notification_email` (`email`, `password`, `host`, `port`, `tls`) configuradas no `SystemConfig` (`key: "robot_docusign"`), operando via socket IMAP direto (`UID SEARCH`/`UID FETCH`/`UID STORE` + `clockDrift 60s`) tanto no robô standalone quanto no backend Playwright (`backend/src/modules/robot-docusign/utils/imapClient.js` — AD-058/AD-059/AD-061), com fallback para Roundcube Webmail no executável. O robô detecta a tela de MFA pelo texto ("Get Code From Your Email"), por seletores de input (`name="security_code"`, `pattern="[0-9]{6}"`, `placeholder="Enter code"`) e submete pelo botão de confirmação (`data-qa="verify-code"`, texto "Verify" ou tecla Enter). A propriedade `mode` (`"robot"` ou `"api"`) é a fonte única da verdade para ativação (`enabled: mode === "robot"`), e o bloco `operations` (`send`, `statusCheck`, `download`, `reports`, `resend`) define de forma granular quais ações o robô tem permissão para processar. Respostas de erro da API contêm simultaneamente `error` e `message` para compatibilidade (AD-057). O download de PDFs do contrato (`GET /instance/contracts/:contractId/pdf`) opera com resolução multi-caminho via volume Docker compartilhado (`/app/uploads:ro`) com fallback resiliente para stream HTTP direto do Gestor de Oportunidades (AD-062).

## Convenções de Código

- **Validação**: Zod para request body/params em controllers.
- **Autorização**: `protect` (JWT Bearer) + `authorize("admin")` nas rotas.
- **Erros ACL**: HTTP 403 com mensagem em português.
- **Testes**: `node --env-file=.env.dev --test` nativo (sem Jest) em `tests/**/*.test.js` (`tests/backend` + `tests/robot`). Mocks via `node:test`. Supertest para integração. Carrega variáveis de ambiente diretamente de `.env.dev`. **Não rodar sem ser solicitado.**
- **Idioma**: pt-BR em mensagens, commits e documentação.
- **Commit**: sempre `--no-verify` em `git commit` e `git push`. Gerar comandos, nunca executar. Seguir `.agents/rules/commit.md`.
- **JSDoc obrigatório**: Toda função, método ou classe criada/alterada DEVE ter JSDoc. Sem exceção.
  - **Funções/métodos**: `@param {Tipo} nome - descrição`, `@returns {Tipo} descrição`, `@throws {Erro}` quando aplicável, `@async` se async.
  - **Classes**: `@class Nome` + `@param` no `constructor`.
  - **Models Mongoose**: `@typedef` para schema + `@type {import('mongoose').Model<Doc>}` no export.
  - **Middlewares Express**: `@param {import('express').Request} req` / `@param {import('express').Response} res` / `@param {import('express').NextFunction} next`.
  - **Constantes/config**: `@constant` + `@type {Tipo}`.

## .agents/rules

Consulte antes de commits, respostas Sim/Não e decisões gerais:

- `.agents/rules/commit.md` — regras de commit, PR e merge
- `.agents/rules/global.md` — formato de respostas, sub-agentes, PonyTail/SOLID

## .specs/

Antes de qualquer pergunta, ajuste ou refatoração, consulte `.specs/` para verificar especificações existentes. Atualizar `tasks.md`, `spec.md`, `validation.md` e `STATE.md` antes de commits.
