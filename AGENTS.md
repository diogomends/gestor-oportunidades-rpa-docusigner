# AGENTS.md — Gestor de Oportunidades (CRM Funil de Vendas)

## Projeto Relacionado

Este projeto (`gestor-oportunidades-rpa-docusigner`) **interage com** o projeto `gestor-oportunidades` localizado em `C:\www\producao\servidor-unity-rce\gestor-oportunidades`. Essa referência é obrigatória em todas as decisões:

- Dados compartilhados (usuários, oportunidades, contratos, configurações) vivem em ambos os projetos — sempre consulte o repositório `gestor-oportunidades` antes de alterar schemas, models ou fluxos que impactem dados cruzados.
- APIs, rotas ou módulos consumidos pelo `gestor-oportunidades` devem ser considerados contratos públicos neste projeto.
- Antes de criar ou modificar funcionalidades que envolvam dados exportados/importados entre os dois sistemas, verifique a estrutura vigente no projeto irmão.

---

Antes de qualquer ação, faça **no máximo 10 perguntas** para esclarecer o contexto, escopo, restrições e preferências do usuário. Só depois comece a executar.

## Regras Obrigatórias

- **SOLID**: toda resposta, análise e implementação deve seguir rigorosamente os princípios SOLID. Nada de classes/módulos gigantes que acumulam responsabilidades.
- **PonyTail**: aplique sempre a prática e mentalidade do PonyTail em todas as interações e tarefas para eliminar sobre-engenharia, reduzir complexidade e revisar código.
- **Sub-agentes**: distribua TUDO que for possível em sub-agentes paralelos via `task` tool em todas as tarefas, garantindo a divisão de carga de trabalho e evitando execuções sequenciais.
- **Branch**: antes de qualquer commit, siga a regra `.agents/rules/commit.md` (gerar comandos `git add` sempre em linha única; gerar texto dos comandos, nunca executar; só arquivos da conversa; nova branch; fluxo `gh pr create` + `gh pr merge`; sempre usar `--no-verify`).
- **Planejamento**: use a skill `tlc-spec-driven` para especificação, design e criação de tarefas. Use **PonyTail** para perguntas diretas e segunda verificação (revisão independente do que foi feito).
- **Idioma**: português (pt-BR) em mensagens, comentários e documentação.
- **Perguntas**: sempre de múltipla escolha, feitas de forma interativa (nunca usar a `question` tool).
- **Respostas Sim/Não**: use "Sim" ou "Não". Se a resposta for "Não", explique conforme a complexidade (Baixa: até 25 palavras, Média: até 50 palavras, Alta: até 150 palavras).
- **Especificações (.specs/)**: antes de responder a qualquer pergunta, solicitação de ajuste, verificação de erro ou refatoração (bem como planejamento, fix ou nova feature), consulte obrigatoriamente o diretório `.specs/` para verificar se existe alguma especificação relacionada.
- **Atualização de .specs/ antes do commit**: antes de gerar comandos de commit, o agente DEVE atualizar todos os arquivos `.specs/` relacionados à tarefa:
  1. `tasks.md` — marcar tarefa como `[x]` (Done)
  2. `spec.md` — atualizar status de requisitos (se IDs de rastreabilidade existirem)
  3. `validation.md` — criar/atualizar com evidências (se aplicável)
  4. `STATE.md` Handoff — atualizar snapshot se houve pausa/início de sessão
  5. `STATE.md` Changelog — adicionar entrada para features novas (versão + data + descrição)
  Esses arquivos DEVEM ser incluídos nos comandos `git add` do commit.

## Stack & Comandos

| Comando                                 | O que faz                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `npm start`                             | Inicia produção (`node src/server.js`)                                      |
| `npm run dev`                           | Inicia dev com nodemon                                                      |
| `npm test`                              | Roda testes nativos do Node (`node --test`)                                 |
| `node src/scripts/test-date-filters.js` | Teste manual de filtros de data                                             |
| `make up-dev`                           | Sobe Docker dev (`docker compose --env-file .env.dev up -d --build`)        |
| `make down`                             | Para containers                                                             |
| `make logs`                             | Logs em tempo real                                                          |
| `make reset`                            | down + clean + up-dev                                                       |
| `make test-e2e-headed`                  | Playwright E2E headed (visual) com chromium                                 |
| `make test-e2e-headless`                | Playwright E2E headless (CI)                                                |
| `make test-contracts`                   | Playwright E2E só contratos headed                                          |
| `make test-pdf-html-generation`         | Gera 3 PDFs (termo/proposta/permanencia) via Playwright em `tmp/test-pdfs/` |
| `make test-pdf-generation`              | Gera PDFs via pdf-lib legado em `tmp/test-pdfs/`                            |
| `make install-deps`                     | `npm ci && npx playwright install chromium`                                 |

Package manager: **npm** (lockfileVersion 3, `package-lock.json` presente).

## Arquitetura

```
src/
├── server.js          # Entrypoint: load dotenv, import models (registro de schema), connectDB, listen
├── app.js             # Express: JSON 50mb, CORS, Helmet CSP, morgan, static (public/), montagem de rotas
├── config/            # database.js (mongoose.connect)
├── controllers/       # Controladores globais (auth, user, team, goal, offer, opportunity barrel)
├── routes/            # Rotas Express (authRoutes, userRoutes, ...) — 7 arquivos
├── middlewares/       # authMiddleware.js (protect), roleMiddleware.js (authorize)
├── models/            # Mongoose schemas — 8 modelos (User, Opportunity, Team, Goal, ImportProfile, Offer, AuditLog, WatchlistConfig)
├── modules/           # 14 módulos de domínio (acl, client-docs, commissions, config-sistema, contract, criador-contratos-pdf, docusign, gerador-pdf-html, import-opportunities, notificacoes, opportunities, relatorio-pos-smb, watchlist, watermark)
└── scripts/           # Scripts avulsos (test-date-filters.js)
```

- **ES Modules** puro (`"type": "module"` no package.json). Sempre use `import`/`export`.
- **Frontend**: HTML + CSS + JS vanilla (ESM modules), servido estaticamente de `public/`. Sidebar carregada como módulo ES6 dinâmico.
- Models precisam ser importados em `server.js` para registrar schemas antes do uso (linhas 7-16).
- **Geração de PDF**: 2 abordagens. `gerador-pdf-html/` (Playwright, HTML → PDF no servidor, submódulos `termo`, `proposta`, `permanencia`, endpoint `POST /api/contracts/generate-pdf-html`). `criador-contratos-pdf/` (pdf-lib legado, frontend-based, sendo substituído). Ambos requerem `npx playwright install chromium`.
- **Rotas modulares montadas em `app.js`**:

  | Prefixo                       | Módulo(s)                                           |
  | ----------------------------- | --------------------------------------------------- |
  | `/api/auth`, `/api/users` ... | Rotas CRUD clássicas (7 arquivos)                   |
  | `/api/campaigns`              | commissions                                         |
  | `/api/contracts`              | contract + criador-contratos-pdf + gerador-pdf-html |
  | `/api/criador-contratos-pdf`  | criador-contratos-pdf                               |
  | `/api/docusign`               | docusign                                            |
  | `/api/client-docs`            | client-docs                                         |
  | `/api/internal/notifications` | notificacoes                                        |
  | `/api/acl`, `/api/me`         | acl                                                 |
  | `/api/system-config`          | config-sistema                                      |

## Convenções de Código

- **Validação**: Zod para validar request body/params em controllers.
- **Autorização**: `authMiddleware.protect` + `roleMiddleware.authorize("admin", "supervisor")` nas rotas. Controllers fazem **role-based queries** (não confiam só no middleware).
- **Erros de ACL**: retornam HTTP 403 com mensagem em português (AD-008).
- **Supervisor ACL**: validada inline no controller, não como middleware (AD-007).
- **Frontend**: `addEventListener` em vez de `onchange` em módulos ES6 (AD-010).
- **Datas**: parse manual com `new Date(year, month-1, day)` para evitar discrepância UTC (AD-011).
- **Filtro de equipe no frontend**: client-side via `supervisor_id._id === currentUser._id` (AD-009).
- **Documentação de funções**: toda função JavaScript deve ter JSDoc (`/** @param ... @returns ... */`); toda função Python deve ter docstrings. Parâmetros, retorno e **para que serve** (em pt-BR) documentados.
- **Upload**: limite de 50mb tanto no Express quanto no Nginx.
- **Restrição de horário**: middleware global `timeRestriction` em `src/middlewares/timeRestrictionMiddleware.js`. Bloqueia não-admins com 403 fora do horário configurado. Se receber 403 inesperado, verificar `SystemConfig.access_restriction.enabled`.

## Testes

- **Runner**: `node --test` (nativo do Node 18+, sem Jest).
- **Framework de asserção**: `node:assert`.
- **Mocking**: `mock.method()` e `mock.restoreAll()` de `node:test`.
- **DB em testes**: `mongodb-memory-server` disponível, mas o teste atual mocka os models diretamente.
- **Supertest**: disponível para testes de integração.
- não rodar testes sem ser solicitado
- verificar se há comando de teste em makefile
- autorizado rodar testes se for de skill instaladas
- **E2E (Playwright)**: `tests/e2e/` com `playwright.config.js`. Requer servidor rodando. `make test-e2e-headed` para debug visual. Headless padrão (override via `HEADLESS=true`). Auth state compartilhado via global-setup/teardown.

Padrão do teste existente (`get-opportunities.test.js`):

```js
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
// mock.request/response, mock.method(Model, 'find', ...), assert nos calls
```

## Docker & Ambiente

| Variável                  | Obrigatória | Usado por              | Padrão      |
| ------------------------- | ----------- | ---------------------- | ----------- |
| `PORT`                    | Sim         | `app_gestor`           | 3000        |
| `MONGO_URI`               | Sim         | `app_gestor`           | —           |
| `JWT_SECRET`              | Sim         | `app_gestor`           | —           |
| `NODE_ENV`                | Não         | todos                  | development |
| `MONGO_URI_CLIENT_SERVER` | Sim (prod)  | `client_server_gestor` | —           |

### ⚠️ Mapa de Bancos MongoDB — LEIA ANTES DE APAGAR DADOS

| Database        | Porta     | Variável de conexão                    | Quem usa               | Collections principais                                |
| --------------- | --------- | -------------------------------------- | ---------------------- | ----------------------------------------------------- |
| `db_crm_funil`  | 27017     | `MONGO_URI`                            | `app_gestor`           | users, opportunities, teams, goals, offers, auditlogs |
| `crm_contracts` | **27017** | `MONGO_URI` + `useDb("crm_contracts")` | `app_gestor`           | **contracts**                                         |
| `crm_contracts` | 27018     | `MONGO_URI_CLIENT_SERVER`              | `client_server_gestor` | (leitura do mesmo database em servidor separado)      |

> **ATENÇÃO**: A collection `contracts` vive no database `crm_contracts` no **mesmo servidor** da `MONGO_URI` (porta 27017), não no servidor separado da porta 27018. Para inspecionar ou limpar dados de contratos em produção, conecte em `127.0.0.1:27017` e use `use crm_contracts`.

- Dev: `docker compose --env-file .env.dev up -d --build`
- Prod: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
- Nginx na porta 8000, API na 3000.
- `host.docker.internal` para conectar ao MongoDB host (configurado no override).
- Containers: `app_gestor` (Node), `nginx_gestor` (nginx:alpine), `client_server_gestor` (Node 3001).

## Arquivos de Referência

#### Documentação ativa (mantida e atualizada)

- `.specs/` — Fonte da verdade. Tudo aqui é documentação viva: `STATE.md` (ADRs + Changelog + Manual), `features/` (specs de features), `database/` (modelagem), `LESSONS.md` (lições aprendidas). **É o que deve ser consultado e atualizado.**
- `STATE.md` — Histórico de versões (seção `## Changelog`).
