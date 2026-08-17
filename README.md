# Gestor de Oportunidades RPA DocuSigner

Serviço Node.js que automatiza login e ações no DocuSign via Playwright (RPA). Expõe API REST para orquestração de jobs, gerenciamento de sessões do robô e monitoramento.

## Visão Geral da Arquitetura

O projeto é composto por **2 componentes independentes** que vivem no mesmo repositório:

| Componente | Onde roda | Função |
|------------|-----------|--------|
| **Servidor Central** (`src/`) | Servidor de produção (porta 3111) | API REST que orquestra jobs, gerencia sessões, autentica robôs e monitora instâncias |
| **Robô Standalone** (`robot-standalone/`) | Máquinas dos vendedores/agentes | Executável `.exe` que faz polling na fila de jobs e executa automação Playwright de forma isolada |

```
┌─────────────────────────────────┐         ┌──────────────────────────────────┐
│   SERVIDOR CENTRAL (produção)   │         │   ROBÔ STANDALONE (.exe local)   │
│   src/ → node src/server.js     │         │   robot-standalone/ → .exe       │
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

**Fluxo resumido:** O servidor expõe uma fila de jobs no MongoDB. O robô standalone (`.exe` nas máquinas dos agentes) faz polling autenticado via HTTP, busca jobs pendentes, executa a automação Playwright no DocuSign e reporta progresso/status de volta ao servidor.

## Pré-requisitos

- Node.js 18+
- MongoDB (local ou remoto)
- Chromium (para automação via Playwright)

## Instalação

```bash
# Clonar o repositório
git clone <url-do-repositorio>
cd gestor-oportunidades-rpa-docusigner

# Instalar dependências
npm install

# Instalar navegador Chromium para o robô
npx playwright install chromium

# Copiar .env.example para .env e preencher as variáveis
cp .env.example .env
```

## Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `PORT` | Não | 3111 | Porta do servidor |
| `NODE_ENV` | Não | development | Ambiente de execução |
| `MONGO_URI` | Sim | — | Conexão MongoDB (banco principal) |
| `MONGO_CONTRACTS_URI` | Sim | — | Conexão MongoDB (banco de contratos) |
| `JWT_SECRET` | Sim | — | Chave secreta para JWT |
| `DOCUSIGN_INTEGRATION_KEY` | Não | — | Chave de integração DocuSign |
| `DOCUSIGN_USER_ID` | Não | — | ID do usuário DocuSign |
| `DOCUSIGN_ACCOUNT_ID` | Não | — | ID da conta DocuSign |
| `DOCUSIGN_RSA_PRIVATE_KEY_PATH` | Não | — | Caminho para chave privada RSA |
| `DOCUSIGN_HMAC_KEY` | Não | — | Chave HMAC DocuSign |
| `DOCUSIGN_BASE_PATH` | Não | na.docusign.net | Base URL da API DocuSign |
| `USUARIO_DOCUSIGNER` | Não | — | Usuário para login no robô |
| `SENHA_DOCUSIGNER` | Não | — | Senha para login no robô |

> As credenciais DocuSign e do robô podem vir do banco (`SystemConfig`) ou de variáveis de ambiente como fallback.

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia em produção (`node src/server.js`) |
| `npm run dev` | Inicia em desenvolvimento com nodemon |
| `npm test` | Executa testes nativos (`node --test`) |

### Makefile (via `make`)

| Comando | Descrição |
|---------|-----------|
| `make dev` | Inicia servidor em desenvolvimento |
| `make test` | Roda testes nativos |
| `make test-headed` | Roda o robô standalone com navegador visível (`HEADLESS=false`) |
| `make test-headed-ps` | Idem, mas via PowerShell (para Windows CMD) |
| `make build-robot` | Gera executável .exe. Use KEY="rf_sec_xxx" para chave específica e HEADLESS=false para modo headed |
| `make install` | Instala dependências de tudo (servidor + standalone) |
| `make clean` | Limpa pastas de build anteriores |

## Componentes do Projeto

| Diretório | Descrição | Gera Executável |
|-----------|-----------|-----------------|
| **`src/`** | Servidor central (Express + MongoDB). API REST para orquestração de jobs, autenticação JWT, agendamento de tarefas e monitoramento. O robô Playwright roda internamente via `robotOrchestrator.js` quando em modo "robot". | Não |
| **`robot-standalone/`** | Robô autônomo para instalar nas máquinas dos vendedores/agentes. Comunica com o servidor via HTTP, faz polling na fila de jobs do MongoDB e executa automação Playwright de forma isolada. Pode ser empacotado como `.exe`. | **Sim** — `robot-docusigner.exe` |

## Arquitetura

### `src/` — Servidor Central

```
src/
├── server.js          # Entrypoint: dotenv, models, connectDB, scheduler, listen
├── app.js             # Express: JSON 10mb, CORS, Helmet, morgan, rotas
├── config/
│   └── database.js    # 3 conexões: db_crm_funil, crm_contracts, crm_acl
├── models/            # User.js, Contract.js, SystemConfig.js
├── middlewares/       # authMiddleware.js, roleMiddleware.js
├── services/          # docusignService.js (API DocuSign)
├── utils/             # crypto.js, timeRestrictionService.js
└── modules/
    └── robot-docusign/  # Módulo de domínio
        ├── index.js
        ├── routes.js
        ├── controllers/
        ├── models/        # RobotJob, RobotSession, RobotInstance
        ├── services/      # robotOrchestrator, robotBrowser, robotScheduler
        ├── selectors/     # CSS selectors para automação
        └── routes/
```

### `robot-standalone/` — Robô Autônomo (Executável)

```
robot-standalone/
├── src/
│   ├── main.js         # Entrypoint: config, auth, scheduler
│   ├── config.js       # Leitura de config.json / env vars
│   ├── api-client.js   # Cliente HTTP autenticado (JWT) para o servidor
│   ├── job-runner.js   # Executor isolado de jobs Playwright
│   ├── scheduler.js    # Loop de polling + heartbeat
│   └── browser/
│       ├── docusign.js  # Automação DocuSign (login, envio, status)
│       └── selectors.js # Seletores CSS
├── build/
│   ├── build.js        # Pipeline: esbuild → obfuscator → bytenode → pkg
│   └── pkg.config.json
├── scripts/
│   └── setup.bat       # Instalador para máquina do agente
├── config.json.example # Modelo de configuração
└── package.json
```

### Gerar Executável (.exe)

O executável do robô standalone é gerado via pipeline de 4 etapas dentro de `robot-standalone/`:

```bash
# 1. Entrar no diretório do standalone
cd robot-standalone

# 2. Instalar dependências
npm install

# 3. Executar o pipeline de build
npm run build
```

O executável protegido será gerado em `robot-standalone/dist/robot-docusigner.exe`.

#### Parâmetros de Build

| Parâmetro | Obrigatório | Padrão | Descrição |
|-----------|-------------|--------|-----------|
| `KEY` | Não* | (lê do `.env.dev`/`.env`) | Chave de API do robô (`ROBOT_KEY`) |
| `HEADLESS` | Não | `true` | `true` = sem janela, `false` = com janela visível |
| `API_URL` | Não | (lê do `.env.dev`/`.env`) | URL do servidor central |

> *`KEY` é obrigatória se não houver `ROBOT_KEY` no `.env.dev` ou `.env`.

**Resultado:** Um `.exe` + `.jsc` com a chave, HEADLESS e API_URL embutidos no bytecode (sem `config.json` em texto plano).

**Pipeline de Build:**

| Etapa | Ferramenta | O que faz |
|-------|------------|-----------|
| 1 | **esbuild** | Bundling ESM → CJS, externo do Playwright |
| 2 | **javascript-obfuscator** | Ofuscação do código-fonte |
| 3 | **bytenode** | Compilação para bytecode V8 (`.jsc`) |
| 4 | **@yao-pkg/pkg** | Empacotamento como binário Windows `.exe` |

**Distribuição:** Copie `dist/robot-docusigner.exe` e `dist/main-robot-docusigner.jsc` para a máquina alvo — os dois arquivos devem ficar na mesma pasta, pois o `.exe` é um loader que carrega o `.jsc`. Execute `setup.bat` apenas para instalar o Chromium.

## API REST

Todas as rotas estão sob o prefixo `/api/robot-docusign`:

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/trigger` | Bearer | Dispara job individual |
| POST | `/trigger-batch` | admin | Dispara job em lote |
| GET | `/status/:jobId` | Bearer | Status de um job |
| GET | `/jobs` | Bearer | Lista jobs |
| GET | `/jobs/:jobId/stream` | Bearer | SSE stream de progresso |
| GET | `/metrics` | Bearer | Métricas |
| GET | `/logs/:jobId` | Bearer | Logs de um job |
| GET/PUT | `/config` | admin | Configuração do robô |
| POST | `/test-login` | admin | Testa login no DocuSign |
| GET | `/queue` | Bearer | Fila de jobs |
| POST | `/process-pending` | Bearer | Processa jobs pendentes |
| `/instance/*` | público | Sub-rotas de instâncias |
| GET | `/health` | público | Health check |

## Banco de Dados

| Database | Variável de Conexão | Quem Usa |
|----------|---------------------|----------|
| `db_crm_funil` | `MONGO_URI` | User, SystemConfig |
| `crm_contracts` | `MONGO_CONTRACTS_URI` | Contract |

> `MONGO_CONTRACTS_URI` aponta para o mesmo servidor de `MONGO_URI`. O `database.js` faz `useDb("crm_contracts")` na mesma conexão mongoose.

## Projeto Relacionado

Este projeto interage com `gestor-oportunidades`. Consulte-o antes de alterar schemas ou fluxos que impactem dados compartilhados (usuários, contratos, configurações).

## Convenções

- **ES Modules** puro: use `import`/`export`
- **Validação**: Zod para request body/params
- **Autorização**: `protect` (JWT Bearer) + `authorize("admin")`
- **Testes**: `node --test` nativo (sem Jest)
- **Idioma**: pt-BR em mensagens e documentação
