# Gestor de Oportunidades RPA DocuSigner

Serviço Node.js que automatiza login e ações no DocuSign via Playwright (RPA). Expõe API REST para orquestração de jobs, gerenciamento de sessões do robô e monitoramento.

## Visão Geral da Arquitetura

O projeto é composto por **2 componentes independentes** que vivem no mesmo repositório:

| Componente                        | Onde roda                         | Função                                                                                            |
| --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Servidor Central** (`backend/`) | Servidor de produção (porta 3111) | API REST que orquestra jobs, gerencia sessões, autentica robôs e monitora instâncias              |
| **Robô** (`robot/`)               | Máquinas dos vendedores/agentes   | Executável `.exe` que faz polling na fila de jobs e executa automação Playwright de forma isolada |

```
┌─────────────────────────────────┐         ┌──────────────────────────────────┐
│   SERVIDOR CENTRAL (produção)   │         │       ROBÔ (.exe local)          │
│   backend/ → node server.js     │         │   robot/ → .exe                  │
│                                 │  HTTP   │                                  │
│  ┌───────────────────────────┐  │◄───────►│  ┌────────────────────────────┐  │
│  │ API REST (porta 3111)     │  │ polling │  │ Scheduler (polling fila)   │  │
│  │ - JWT auth + API Keys     │  │ +auth   │  │ - heartbeat com servidor   │  │
│  │ - Fila de jobs MongoDB    │  │         │  │ - execução Playwright       │  │
│  │ - Orquestração de jobs    │  │         │  │ - download de PDFs         │  │
│  │ - Monitoramento instâncias│  │         │  │ - obfuscação/bytecode      │  │
│  └───────────────────────────┘  │         │  └────────────────────────────┘  │
│                                 │         │                                  │
│  MongoDB: db_crm_funil          │         │  Zero dependências de servidor   │
│            crm_contracts        │         │  (apenas Playwright)             │
└─────────────────────────────────┘         └──────────────────────────────────┘
```

**Fluxo resumido:** O servidor expõe uma fila de jobs no MongoDB. O robô (`.exe` nas máquinas dos agentes) faz polling autenticado via HTTP, busca jobs pendentes, executa a automação Playwright no DocuSign e reporta progresso/status de volta ao servidor.

## Pré-requisitos

- Node.js 18+
- MongoDB (local ou remoto)
- Chromium (para automação via Playwright)

## Instalação

```bash
# Clonar o repositório
git clone <url-do-repositorio>
cd gestor-oportunidades-rpa-docusigner

# Instalar dependências de todos os componentes
npm run make install # ou make install

# Instalar navegador Chromium para o robô
npx playwright install chromium

# Copiar .env.example para .env e preencher as variáveis
cp .env.example .env
```

## Executando com Docker

O servidor pode ser executado em container Docker (com Chromium pré-instalado para automação Playwright):

```bash
# Modo desenvolvimento / local:
docker compose up --build

# Modo produção com arquivo override de produção:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## CI/CD e Deploy Automático

O repositório está integrado com **GitHub Actions**:

- Workflow `.github/workflows/deploy.yml`: a cada push em `main`, conecta via SSH no `servidor-unity-rce` e atualiza a aplicação via Docker Compose.
- O `.env` de produção permanece isolado no servidor em `/home/appuser/servidor-unity-rce/gestor-oportunidades-rpa-docusigner/.env`.

## Variáveis de Ambiente

| Variável                        | Obrigatória | Padrão                      | Descrição                                                           |
| ------------------------------- | ----------- | --------------------------- | ------------------------------------------------------------------- |
| `PORT`                          | Não         | 3111                        | Porta do servidor                                                   |
| `NODE_ENV`                      | Não         | development                 | Ambiente de execução                                                |
| `MONGO_URI`                     | Sim         | —                           | Conexão MongoDB (banco principal)                                   |
| `MONGO_CONTRACTS_URI`           | Sim         | —                           | Conexão MongoDB (banco de contratos)                                |
| `JWT_SECRET`                    | Sim         | —                           | Chave secreta para JWT                                              |
| `DOCUSIGN_INTEGRATION_KEY`      | Não         | —                           | Chave de integração DocuSign                                        |
| `DOCUSIGN_USER_ID`              | Não         | —                           | ID do usuário DocuSign                                              |
| `DOCUSIGN_ACCOUNT_ID`           | Não         | —                           | ID da conta DocuSign                                                |
| `DOCUSIGN_RSA_PRIVATE_KEY_PATH` | Não         | —                           | Caminho para chave privada RSA                                      |
| `DOCUSIGN_HMAC_KEY`             | Não         | —                           | Chave HMAC DocuSign                                                 |
| `DOCUSIGN_BASE_PATH`            | Não         | na.docusign.net             | Base URL da API DocuSign                                            |
| `USUARIO_DOCUSIGNER`            | Não         | —                           | Usuário para login no robô                                          |
| `SENHA_DOCUSIGNER`              | Não         | —                           | Senha para login no robô                                            |
| `DOCUSIGN_SESSION_PATH`         | Não         | `session-docusign.json`     | Caminho do arquivo storageState de persistência da sessão do robô   |
| `GESTOR_API_URL`                | Sim         | `http://localhost:3000/api` | URL da API do gestor-oportunidades                                  |
| `ROBOT_API_KEY`                 | Sim         | —                           | Chave de API do robô (validada no bootstrap)                        |
| `API_URL` / `URI_PROD`          | Não         | `http://localhost:3111`     | URL do backend central consumida pelo robô standalone               |
| `ROBOT_KEY`                     | Não         | —                           | Chave de API do robô standalone para autenticação na API            |
| `HEADLESS`                      | Não         | `true`                      | `true` para rodar em segundo plano, `false` para exibir o navegador |
| `POLL_INTERVAL_SECONDS`         | Não         | `15`                        | Intervalo em segundos para consulta de jobs na fila                 |
| `DEPLOY_HOST`                   | Não         | `root@165.227.212.57`       | Host SSH para deploy e comandos remotos em produção                 |
| `DEPLOY_KEY` / `DEPLOY_KEY_PATH`| Não         | —                           | Caminho da chave SSH privada para autenticação remota              |
| `REMOTE_PROJECT_PATH`           | Não         | —                           | Caminho do projeto no servidor remoto                               |

> As credenciais DocuSign e do robô podem vir do banco (`SystemConfig`) ou de variáveis de ambiente como fallback. O robô standalone carrega automaticamente o arquivo `.env` da raiz do projeto ou diretório local. A resolução de MFA (2FA) da DocuSign utiliza as credenciais de e-mail de notificação (`token_notification_email`: `email`, `password`, `host`, `port`, `tls`) configuradas no `SystemConfig` (`key: "robot_docusign"`), permitindo extração rápida em ~1s via protocolo IMAP direto com fallback para Roundcube Webmail. O robô detecta a tela de MFA pelo texto ("Get Code From Your Email"), por múltiplos seletores de formulário (`name="security_code"`, `pattern="[0-9]{6}"`, `placeholder="Enter code"`) e submete pelo botão de confirmação (`data-qa="verify-code"`, texto "Verify" ou tecla Enter).

## Comandos

| Comando                | Descrição                                                              |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm start`            | Inicia o backend em produção (`node backend/src/server.js`)            |
| `npm run dev`          | Inicia o backend em desenvolvimento com nodemon                        |
| `npm run build:robot`  | Compila o robô e gera o executável protegido `.exe`                    |
| `npm test`             | Executa todos os testes nativos (`node --test` em `test/**/*.test.js`) |
| `npm run test:backend` | Executa só testes do backend (`test/backend/**`)                       |
| `npm run test:robot`   | Executa só testes do robô (`test/robot/**`)                            |

### Makefile (via `make`)

| Comando                      | Descrição                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make start`                 | Inicia o backend em produção                                                                                                                                                    |
| `make dev`                   | Inicia servidor em desenvolvimento                                                                                                                                              |
| `make test`                  | Roda testes nativos                                                                                                                                                             |
| `make test-headed`           | Roda o robô com navegador visível (`HEADLESS=false`)                                                                                                                            |
| `make test-headed-ps`        | Idem, mas via PowerShell (para Windows CMD)                                                                                                                                     |
| `make build-robot`           | Gera executáveis .exe dos robôs standalone com chave(s) embutida(s). Use KEY="rf_sec_xxx" para chave específica, HEADLESS=false para modo headed e API_URL para URL customizada |
| `make install`               | Instala dependências de tudo (backend + robot)                                                                                                                                  |
| `make install-backend`       | Instala dependências do backend                                                                                                                                                 |
| `make install-robot`         | Instala dependências do robô                                                                                                                                                    |
| `make clean`                 | Limpa pastas de build anteriores                                                                                                                                                |
| `make clean-test`            | Limpa arquivos temporários de teste                                                                                                                                             |
| `make clean-all`             | Limpa builds, temporários e `node_modules`                                                                                                                                      |
| `make up-dev`                | Sobe servidor em container Docker local                                                                                                                                         |
| `make up-prod`               | Sobe servidor em produção via Docker Compose (`docker-compose.prod.yml`)                                                                                                        |
| `make down`                  | Para containers Docker da aplicação                                                                                                                                             |
| `make logs`                  | Exibe logs contínuos dos containers Docker                                                                                                                                      |
| `make reset`                 | Reinicia containers Docker com rebuild completo                                                                                                                                 |
| `make tunnel`                | Abre túnel SSH seguro com MongoDB remoto (porta 27018)                                                                                                                          |
| `make db-and-collection`     | Exibe árvore de bancos e coleções no MongoDB local                                                                                                                              |
| `make db-and-collection-prod`| Exibe árvore de bancos e coleções no container de produção                                                                                                                      |
| `make mongosh-contracts`     | Conecta via mongosh no banco local de contratos                                                                                                                                 |
| `make mongosh-contracts-prod`| Conecta via mongosh no banco de contratos remoto (via túnel)                                                                                                                    |
| `make ssh-uploads-prod`      | Abre sessão SSH interativa direto na pasta uploads/ em produção                                                                                                                 |
| `make ls-uploads-prod`       | Lista diretórios e arquivos da pasta uploads/ em produção (suporta `DIR=...`)                                                                                                   |
| `make fetch-robot-debug-images` | Baixa screenshots de debug do container de produção para `tmp/robot-debug/`                                                                                                  |
| `make routes-inventory`      | Gera inventário de rotas HTTP em `.specs/routes-inventory.md`                                                                                                                   |
| `make routes-inventory-check`| Valida integridade do inventário de rotas no CI                                                                                                                                 |

## Componentes do Projeto

| Diretório      | Descrição                                                                                                                                                                                                                   | Gera Executável                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **`backend/`** | Servidor central (Express + MongoDB). API REST para orquestração de jobs, autenticação JWT, agendamento de tarefas e monitoramento.                                                                                         | Não                              |
| **`robot/`**   | Robô autônomo para instalar nas máquinas dos vendedores/agentes. Comunica com o servidor via HTTP, faz polling na fila de jobs do MongoDB e executa automação Playwright de forma isolada. Pode ser empacotado como `.exe`. | **Sim** — `robot-docusigner.exe` |

## Arquitetura

### `backend/` — Servidor Central

```
backend/
├── package.json       # Dependências e scripts do backend
├── src/
│   ├── server.js          # Entrypoint: dotenv, models, connectDB, scheduler, listen
│   ├── app.js             # Express: JSON 10mb, CORS, Helmet, morgan, rotas
│   ├── config/
│   │   └── database.js    # 3 conexões: db_crm_funil, crm_contracts, crm_acl
│   ├── models/            # User.js, Contract.js, SystemConfig.js
│   ├── middlewares/       # authMiddleware.js, roleMiddleware.js
│   ├── services/          # docusignService.js (API DocuSign), gestorApiClient.js
│   ├── utils/             # crypto.js, timeRestrictionService.js
│   └── modules/
│       └── robot-docusign/  # Módulo de domínio
│           ├── index.js
│           ├── routes.js
│           ├── controllers/
│           ├── models/        # RobotJob, RobotSession, RobotInstance
│           ├── services/      # robotOrchestrator, robotBrowser, robotScheduler, robotSession, robotSelectors, agreementsService, contractSyncService, loginUrl, steps/
│           ├── selectors/     # CSS selectors para automação
│           └── routes/
├── test/              # Testes (raiz do projeto)
│   ├── backend/controllers|models|services
│   └── robot/browser/
```

### `robot/` — Robô Autônomo (Executável)

```
robot/
├── src/
│   ├── main.js         # Entrypoint: config, auth, scheduler
│   ├── config.js       # Leitura de env vars + config.json (dev only)
│   ├── api-client.js   # Cliente HTTP autenticado (JWT) para o servidor
│   ├── job-runner.js   # Executor isolado de jobs Playwright
│   ├── scheduler.js    # Loop de polling + heartbeat
│   ├── utils/
│   │   └── logger.js   # Sistema de logs coloridos ANSI (verde=sucesso, azul=etapa, vermelho=erro)
│   └── browser/
│       ├── docusign.js   # Automação DocuSign (login, detecção de MFA, envio, status)
│       ├── imapClient.js # Extração headless de código MFA via socket IMAP/TLS nativo
│       ├── roundcube.js  # Fallback de extração visual de MFA via Webmail Roundcube
│       └── selectors.js  # Seletores CSS
├── build/
│   └── build.js        # Pipeline: esbuild → obfuscator → bytenode → pkg
├── scripts/
│   └── setup.bat       # Instalador para máquina do agente
└── package.json
├── test/              # Testes (raiz, espelha backend/robot)
│   ├── backend/controllers|models|services
│   └── robot/browser/
```

### Gerar Executável (.exe)

O executável do robô é gerado via pipeline dentro de `robot/`:

```bash
# 1. Entrar no diretório do robot (ou usar make build-robot na raiz)
cd robot

# 2. Instalar dependências
npm install

# 3. Executar o pipeline de build
npm run build
```

O executável protegido será gerado em `robot/dist/robot-docusigner-X/robot-docusigner-X.exe` (onde X é o índice da chave).

#### Parâmetros de Build

| Parâmetro  | Obrigatório | Padrão                    | Descrição                                         |
| ---------- | ----------- | ------------------------- | ------------------------------------------------- |
| `KEY`      | Não\*       | (lê do `.env.dev`/`.env`) | Chave de API do robô (`ROBOT_KEY`)                |
| `HEADLESS` | Não         | `true`                    | `true` = sem janela, `false` = com janela visível |
| `API_URL`  | Não         | (lê do `.env.dev`/`.env`) | URL do servidor central                           |

> \*`KEY` é obrigatória se não houver `ROBOT_KEY` no `.env.dev` ou `.env`.

**Resultado:** Um `.exe` + `.jsc` com a chave, HEADLESS e API_URL embutidos no bytecode (sem `config.json` em texto plano). Cada chave gera uma subpasta em `robot/dist/` (ex: `robot-docusigner-1/`, `robot-docusigner-2/`).

**Pipeline de Build:**

| Etapa | Ferramenta                | O que faz                                 |
| ----- | ------------------------- | ----------------------------------------- |
| 1     | **esbuild**               | Bundling ESM → CJS, externo do Playwright |
| 2     | **javascript-obfuscator** | Ofuscação do código-fonte                 |
| 3     | **bytenode**              | Compilação para bytecode V8 (`.jsc`)      |
| 4     | **@yao-pkg/pkg**          | Empacotamento como binário Windows `.exe` |

**Distribuição:** Copie a pasta gerada em `dist/` (ex: `robot-docusigner-1/`) para a máquina alvo. Execute `setup.bat` para instalar o Chromium do Playwright e configurar automaticamente a inicialização do robô junto ao Windows (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).

## API REST

Prefixo `/api/robot-docusign` (exceto `/health` na raiz em `app.js:15`):

| Método | Rota                                  | Auth                             | Descrição                                                    |
| ------ | ------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| POST   | `/trigger`                            | `protect`                        | Dispara job individual (body: `contractId`/`contract_id`)    |
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
| GET    | `/instances`                          | `protect` + `authorize("admin")` | Lista instâncias do robô (fleet monitoring)                  |
| POST   | `/instance/auth`                      | público                          | Autenticação da instância (`X-Robot-Key` ou `email`/`senha`) |
| GET    | `/instance/instances`                 | `protect` + `authorize("admin")` | Lista instâncias (via sub-router)                            |
| GET    | `/instance/config`                    | `protect`                        | Config da instância                                          |
| GET    | `/instance/next-job`                  | `protect`                        | Próximo job pendente (polling do robô `.exe`)                |
| PATCH  | `/instance/job/:jobId/status`         | `protect`                        | Atualiza status do job                                       |
| POST   | `/instance/heartbeat`                 | `protect`                        | Heartbeat da instância                                       |
| GET    | `/instance/contracts/:contractId/pdf` | `protect`                        | Download de PDF do contrato                                  |

Fora do prefixo:

| Método | Rota      | Auth    | Descrição                  |
| ------ | --------- | ------- | -------------------------- |
| GET    | `/health` | público | Health check (`app.js:15`) |

## Banco de Dados

| Database        | Variável de Conexão                                  | Quem Usa                         | Observação                                |
| --------------- | ---------------------------------------------------- | -------------------------------- | ----------------------------------------- |
| `db_crm_funil`  | `MONGO_URI` (default)                                | User, SystemConfig               | Banco principal                           |
| `crm_contracts` | `MONGO_CONTRACTS_URI`                                | Contract, RobotJob, RobotSession | Conecta via `useDb("crm_contracts")`      |
| `crm_acl`       | (mesma conexão, `useDb("crm_acl")` via `getAclDb()`) | RobotInstance, robot_api_keys    | Disponível mas não chamada no boot — lazy |

> `MONGO_CONTRACTS_URI` e `crm_acl` usam a mesma conexão mongoose via `useDb()` — não precisam de URI separada.

## Projeto Relacionado

Este projeto interage com `gestor-oportunidades`. Consulte-o antes de alterar schemas ou fluxos que impactem dados compartilhados (usuários, contratos, configurações).

## Convenções

- **ES Modules** puro: use `import`/`export`
- **Validação**: Zod para request body/params
- **Autorização**: `protect` (JWT Bearer) + `authorize("admin")`
- **Testes**: `node --env-file=.env.dev --test` nativo (sem Jest) em `test/**/*.test.js` (`test/backend` + `test/robot`), carrega variáveis diretamente de `.env.dev`, mocks via `node:test`, Supertest
- **Idioma**: pt-BR em mensagens e documentação
- **JSDoc obrigatório**: Toda função, método ou classe criada/alterada DEVE ter JSDoc (`@param`, `@returns`, `@throws`/`@async` quando aplicável; `@class` no constructor; `@typedef`+`@type` em Models; `@param {import('express').Request}` em middlewares)
