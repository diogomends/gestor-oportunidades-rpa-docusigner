# AGENTS.md — Gestor de Oportunidades RPA DocuSigner

Serviço Node.js que automatiza login e ações no DocuSign via Playwright (RPA). Expõe API REST para orquestração de jobs, gerenciamento de sessões do robô e monitoramento.

## Comandos

| Comando                          | O que faz                                        |
| -------------------------------- | ------------------------------------------------ |
| `npm start`                      | Produção (`node backend/src/server.js`)          |
| `npm run dev`                    | Dev com nodemon (`backend/src/server.js`)        |
| `npm test`                       | Testes nativos (`node --test`)                   |
| `npm run build:robot`            | Gera executáveis do robô                         |
| `npx playwright install chromium` | Instala browser Chromium para o robô             |
| `docker compose up --build`      | Sobe servidor em container Docker local          |
| `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` | Sobe servidor em produção via Docker |

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
│       ├── server.js          # Entrypoint: dotenv, import models, connectDB, connectContractsDB, robotScheduler.start(), listen
│       ├── app.js             # Express: JSON 10mb, CORS, Helmet, morgan, montagem de rotas
│       ├── config/
│       │   └── database.js    # 3 conexões: default (db_crm_funil), crm_contracts, crm_acl
│       ├── models/            # User.js, Contract.js, SystemConfig.js (3 modelos)
│       ├── middlewares/       # authMiddleware.js (protect), roleMiddleware.js (authorize)
│       ├── services/          # docusignService.js, gestorApiClient.js
│       ├── utils/             # crypto.js, timeRestrictionService.js
│       └── modules/
│           └── robot-docusign/  # Módulo de domínio
│               ├── index.js           # Exporta routes, orchestrator, session, scheduler
│               ├── routes.js          # Rotas Express (prefixo /api/robot-docusign)
│               ├── controllers/       # robotDocusignController.js, robotInstanceController.js
│               ├── models/            # RobotJob.js, RobotSession.js, RobotInstance.js
│               ├── services/          # robotOrchestrator.js, robotBrowser.js, robotScheduler.js, robotSession.js, robotSelectors.js
│               ├── selectors/         # Selectors CSS para automação do DocuSign
│               └── routes/            # robotInstanceRoutes.js
├── robot/
│   ├── package.json       # Dependências e scripts do robô (Playwright, pkg, bytenode, esbuild)
│   ├── src/               # Código-fonte da automação do robô (main, job-runner, browser)
│   ├── build/             # Pipeline de compilação/ofuscação/empacotamento (.exe)
│   ├── scripts/           # Scripts de instalação e inicialização do robô
│   ├── dist/              # Saída do build: subpastas por chave (robot-docusigner-1/, robot-docusigner-2/, ...)
│   ├── dist-bundle/       # Bundle temporário do esbuild (CJS)
│   ├── dist-obf/          # Código ofuscado temporário
│   └── dist-jsc/          # Bytecode V8 temporário (.jsc)
```

- **ES Modules** puro. Use `import`/`export`.
- **Frontend**: nenhum neste projeto (serviço backend puro).
- `server.js` importa models diretamente para garantir registro de schemas antes do uso.
- `robotScheduler.start()` é chamado automaticamente no boot do servidor.

## Rotas

Todas sob prefixo `/api/robot-docusign`:

| Método  | Rota                           | Auth     | Descrição                          |
| ------- | ------------------------------ | -------- | ---------------------------------- |
| POST    | `/trigger`                     | Bearer   | Dispara job individual             |
| POST    | `/trigger-batch`               | admin    | Dispara job em lote                |
| GET     | `/status/:jobId`               | Bearer   | Status de um job                   |
| GET     | `/jobs`                        | Bearer   | Lista jobs                         |
| GET     | `/jobs/:jobId/stream`          | Bearer   | SSE stream de progresso do job     |
| GET     | `/metrics`                     | Bearer   | Métricas                           |
| GET     | `/logs/:jobId`                 | Bearer   | Logs de um job                     |
| GET/PUT | `/config`                      | admin    | Configuração do robô               |
| POST    | `/test-login`                  | admin    | Testa login no DocuSign            |
| GET     | `/queue`                       | Bearer   | Fila de jobs                       |
| POST    | `/process-pending`             | Bearer   | Processa jobs pendentes            |
| `/instance/*`                     | público   | Sub-rotas de instâncias (ver `robotInstanceRoutes.js`) — `POST /auth` aceita API Key (`X-Robot-Key`) ou email/senha |
| GET     | `/health`                      | público  | Health check (rota raiz em `app.js`) |

## Banco de Dados

| Database       | Variável de conexão         | Quem usa          | Observação                              |
| -------------- | --------------------------- | ----------------- | --------------------------------------- |
| `db_crm_funil` | `MONGO_URI` (default)       | User, SystemConfig| Banco principal                         |
| `crm_contracts`| `MONGO_CONTRACTS_URI`       | Contract          | Conecta via `useDb("crm_contracts")`    |
| `crm_acl`      | (função `connectAclDB`)     | —                 | Disponível mas não chamada no boot      |

> `MONGO_CONTRACTS_URI` aponta para o **mesmo servidor** de `MONGO_URI`. O `database.js` faz `useDb("crm_contracts")` na mesma conexão mongoose.

## Variáveis de Ambiente

| Variável                | Obrigatória | Padrão      |
| ----------------------- | ----------- | ----------- |
| `PORT`                  | Não         | 3111        |
| `MONGO_URI`             | Sim         | —           |
| `MONGO_CONTRACTS_URI`   | Sim         | —           |
| `JWT_SECRET`            | Sim         | —           |
| `NODE_ENV`              | Não         | development |
| `DOCUSIGN_INTEGRATION_KEY` | Não      | —           |
| `DOCUSIGN_USER_ID`      | Não         | —           |
| `DOCUSIGN_ACCOUNT_ID`   | Não         | —           |
| `DOCUSIGN_RSA_PRIVATE_KEY_PATH` | Não | —           |
| `DOCUSIGN_HMAC_KEY`     | Não         | —           |
| `DOCUSIGN_BASE_PATH`    | Não         | na.docusign.net |
| `USUARIO_DOCUSIGNER`    | Não         | —           |
| `SENHA_DOCUSIGNER`      | Não         | —           |
| `GESTOR_API_URL`        | Sim         | `http://localhost:3000/api` |
| `ROBOT_API_KEY`         | Sim         | —           |

Credenciais DocuSign e do robô podem vir do banco (`SystemConfig`) ou de variáveis de ambiente como fallback.


## Convenções de Código

- **Validação**: Zod para request body/params em controllers.
- **Autorização**: `protect` (JWT Bearer) + `authorize("admin")` nas rotas.
- **Erros ACL**: HTTP 403 com mensagem em português.
- **Testes**: `node --test` nativo (sem Jest). Mocks via `node:test`. Supertest para integração. **Não rodar sem ser solicitado.**
- **Idioma**: pt-BR em mensagens, commits e documentação.
- **Commit**: sempre `--no-verify` em `git commit` e `git push`. Gerar comandos, nunca executar. Seguir `.agents/rules/commit.md`.

## .agents/rules

Consulte antes de commits, respostas Sim/Não e decisões gerais:
- `.agents/rules/commit.md` — regras de commit, PR e merge
- `.agents/rules/global.md` — formato de respostas, sub-agentes, PonyTail/SOLID

## .specs/

Antes de qualquer pergunta, ajuste ou refatoração, consulte `.specs/` para verificar especificações existentes. Atualizar `tasks.md`, `spec.md`, `validation.md` e `STATE.md` antes de commits.
