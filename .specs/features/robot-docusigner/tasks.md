# Robot-DocuSigner — Tasks de Implementação

> **Arquitetura de 2 Componentes**: Este projeto possui o **Servidor Central** (`backend/src/`) e o **Robô** (`robot/`). As tasks abaixo cobrem ambos — Fases 1-5 e 8 referem-se ao servidor; a sub-spec `build-executor/` cobre o robô e seu pipeline de build.

## Execution Protocol

> **Testes centralizados em `test/backend/**` + `test/robot/**`, carregando variáveis diretamente de `.env.dev` via `--env-file=.env.dev`.**

- **Runner**: `node --env-file=.env.dev --test` (nativo do Node.js)
- **Framework**: `node:assert` + `node:test` (mock.method, mock.restoreAll)
- **DB em testes**: `mongodb-memory-server` (quando necessário)
- **Playwright**: `npx playwright install chromium` (já no projeto)
- **Branch**: Criar branch `feat/robot-docusigner` antes de iniciar
- **Commits**: Atômicos por task, seguindo `.agents/rules/commit.md`
- **Lint**: `npm run lint` antes de cada commit
- **Idioma**: pt-BR em mensagens, comentários e documentação
- **Testes**: centralizados em `test/backend/**` + `test/robot/**`, execução com `node --env-file=.env.dev --test`

## Gate Check Commands

```bash
npm run lint                                                    # Lint antes de commit
npm test                                                        # Todos os testes (backend + robot)
node --env-file=.env.dev --test test/**/*.test.js              # Todos os testes nativos
node --env-file=.env.dev --test test/backend/**/*.test.js      # Apenas backend
node --env-file=.env.dev --test test/robot/**/*.test.js        # Apenas robô
```

## Test Coverage Matrix

| Req ID | Task | Testes Unitários | Testes Integração | Testes E2E |
|--------|------|-------------------|-------------------|------------|
| REQ-001 | T01 | ✅ RobotJob schema | — | — |
| REQ-002 | T02 | ✅ SystemConfig robot_docusign | ✅ Controller config | — |
| REQ-003 | T03 | ✅ robotSession | ✅ Login flow | — |
| REQ-004 | T04 | ✅ robotBrowser | ✅ Playwright actions | — |
| REQ-005 | T05 | ✅ robotOrchestrator | ✅ Decisão API/Robot | — |
| REQ-006 | T06 | ✅ Controller endpoints | ✅ Rotas | — |
| REQ-007 | T06 | — | ✅ Route mounting | — |
| REQ-008 | T07 | ✅ robotSelectors | — | — |
| REQ-009 | T08 | — | — | ✅ Step 6 toggle |
| REQ-010 | T09 | — | — | ✅ Config card |
| REQ-011 | T10 | ✅ Agendamento | ✅ DO Function mock | — |
| REQ-012 | T04 | ✅ Download flow | ✅ Save to disk | — |
| REQ-ROBOT-KEY-01 | T13 | ✅ gestorApiClient (validateApiKey) | ✅ Robot API Key auth | — |
| REQ-ROBOT-KEY-02 | T13 | ✅ gestorApiClient (contracts CRUD) | ✅ Contracts HTTP bypass | — |
| REQ-ROBOT-KEY-03 | T14 | ✅ server bootstrap guard | ✅ Process exit on invalid | — |
| REQ-OTP-01 | T15 | ✅ robotSession (passo MFA) | ✅ Controller test-login (otpCode) | — |
| REQ-OTP-02 | T15 | ✅ Erros MFA_REQUIRED / OTP_INVALID | ✅ Timeouts estendidos MFA | — |
| REQ-MFA-AUTO-01 | T16 | ✅ roundcube.js | ✅ docusign.js ensureAuth | — |
| REQ-MFA-IMAP-01 | T17 | ✅ imapClient.test.js | ✅ IMAP integration | — |
| REQ-MFA-IMAP-02 | T18 | ✅ imapClient.test.js | ✅ IMAP Hardening & Resilience | — |
| REQ-MFA-IMAP-02 | T20 | ✅ imapClient.test.js (M1-M4) | ✅ Roundtrip reduction & reuso socket | — |
| REQ-MFA-IMAP-06 | T24 | ✅ imapClient.test.js | ✅ Filtro Subject & mfaTriggerTime | — |
| REQ-MFA-IMAP-07 | T25 | ✅ job-runner.js / docusign.js | ✅ Persistência storageState | — |
| REQ-MFA-IMAP-08 | T26 | ✅ docusign.test.js | ✅ Hardening & Resiliência storageState | — |
| REQ-SCHED-01 | T27 | ✅ statusSyncScheduler.test.js | ✅ statusSyncScheduler (isRunning) | — |
| REQ-SCHED-02 | T28 | ✅ statusSyncScheduler.test.js | ✅ Anti-Phantom Success (null mapping) | — |
| REQ-REGR-01 | T29 | ✅ 195 testes em 13 arquivos | ✅ npm test / make test (100% pass) | — |
| REQ-CONTRACT-01 | T30 | ✅ Contract.test.js | ✅ Schema envelopeId & docusign_envelope_id | — |

---

## Fase 1 — Fundação (Paralela)

### T01: Modelo RobotJob

- **Req**: REQ-001
- **Status**: [x] Done (2026-08-11)
- **Esforço**: 1h | Paralelável: Sim
- **Depende de**: Nenhuma

**O quê**: Criar `src/modules/robot-docusign/models/RobotJob.js` com schema Mongoose completo.

**Onde**:
- `src/modules/robot-docusign/models/RobotJob.js` (novo)
- `src/server.js` (importar model para registro de schema)

**Reutiliza**: `getContractsConnection()` de `src/config/database.js`

**Schema**:
- `contract_id`: ObjectId (ref Contract, obrigatório)
- `action`: String enum ['send', 'status', 'download', 'resend', 'reports']
- `status`: String enum ['pending', 'processing', 'completed', 'failed', 'retrying']
- `robot_mode`: Boolean (default: false)
- `attempts`: Number (default: 0)
- `max_attempts`: Number (default: 3)
- `next_retry_at`: Date
- `error`: String
- `result`: Mixed
- `created_by`: ObjectId (ref User)
- Timestamps (createdAt, updatedAt)
- Índices em: `status`, `contract_id`, `next_retry_at`

**Tests**: `test/backend/models/RobotJob.test.js`
- Criação com campos obrigatórios, validação de enum, defaults, índices, campos opcionais

**Feito quando**: Schema criado, exportado, importado em `server.js`, testes passam, lint OK.

---

### T02: Extensão SystemConfig

- **Req**: REQ-002
- **Status**: ✅ Completed (2026-08-11)
- **Esforço**: 1.5h | Paralelável: Sim
- **Depende de**: Nenhuma

**O quê**: Adicionar key `robot_docusign` no SystemConfig com schema Zod e defaults.

**Onde**:
- `src/modules/config-sistema/controllers/systemConfigController.js` (adicionar seção)
- `src/modules/config-sistema/routes.js` (adicionar rotas GET/PUT)

**Estrutura**:
```js
{
  enabled: Boolean (default: false),
  mode: 'api' | 'robot' (default: 'api'),
  credentials: { email: String, password: String (encrypted) },
  schedule: { enabled: Boolean, interval_minutes: Number (5), working_hours: { start: Number, end: Number } },
  limits: { max_concurrent: Number (1), timeout_seconds: Number (30) }
}
```

**Endpoints**: `GET/PUT /api/system-config/robot-docusign`

**Tests**: Schema Zod + controller (GET padrão, PUT atualiza, upsert)

**Feito quando**: GET/PUT funciona, Zod rejeita inválidos, testes passam, lint OK.

---

### T03: Serviço de Sessão

- **Req**: REQ-003
- **Status**: [x] Done (2026-08-11)
- **Esforço**: 2h | Paralelável: Sim
- **Depende de**: Nenhuma

**O quê**: Criar `robotSession.js` com login, persistência cookies MongoDB, reuso de sessão.

**Onde**:
- `src/modules/robot-docusign/services/robotSession.js` (novo)
- `src/modules/robot-docusign/models/RobotSession.js` (novo — collection `robot_sessions`)

**Funcionalidades**: Login via Playwright, persistir cookies/localStorage no MongoDB, reuso de sessão, detecção de expiração + re-login.

**Schema RobotSession**: `{ email (unique), cookies, localStorage, user_agent, expires_at, last_used_at }`

**Tests**: Mock Playwright + MongoDB in-memory (login, cookies, reuso, expiração)

**Feito quando**: Login funciona, cookies salvos, sessão reutilizada, expiração triggers re-login.

---

### T04: Serviço de Automação (Browser Core)

- **Req**: REQ-004, REQ-008, REQ-012
- **Status**: [x] Done (2026-08-11)
- **Esforço**: 4h | Paralelável: Não (depende de T03)
- **Depende de**: T03

**O quê**: Criar `robotBrowser.js` com operações Playwright (send, status, download, resend, reports).

**Onde**:
- `src/modules/robot-docusign/services/robotBrowser.js` (novo)
- `src/modules/robot-docusign/selectors/docusign-ui.json` (novo)
- `src/modules/robot-docusign/services/robotSelectors.js` (novo)

**Operações**:
1. **Send**: navegar → preencher destinatário → enviar → retornar envelope ID
2. **Status**: buscar envelope por ID → retornar status
3. **Download**: buscar completado → download → salvar PDF → retornar path
4. **Resend**: reenviar lembrete
5. **Reports**: extrair métricas da UI

**Seletores** (JSON separado): login, dashboard, send — com fallback defaults

**Tests**: Mock Playwright (cada operação, erros, retry, seletores)

**Feito quando**: Cada operação funciona isoladamente, seletores no JSON, erros tratados.

---

## Fase 2 — Orquestração (Sequencial)

### T05: Orquestrador

- **Req**: REQ-005
- **Status**: [x] Done (2026-08-11)
- **Esforço**: 2h | Paralelável: Não
- **Depende de**: T01, T03, T04

**O quê**: Criar `robotOrchestrator.js` — decide Robot vs API, retry exponencial, coordena execução.

**Onde**: `src/modules/robot-docusign/services/robotOrchestrator.js` (novo)

**Funcionalidades**:
1. **Decisão**: verifica config `enabled`, `mode`, concorrência (`max_concurrent`)
2. **Retry**: 3 tentativas, delay exponencial (1s → 2s → 4s)
3. **Coordenação**: criar RobotJob → executar → atualizar status → logging

**Fluxo**: `trigger(contract_id, action)` → `shouldUseRobot()` → robot/api → atualizar RobotJob → resultado

**Tests**: Mock browser + API (decisão, retry, RobotJob, edge cases)

**Feito quando**: Decisão funciona, retry 3x exponencial, 1 contrato/vez, RobotJob OK.

---

## Fase 3 — API (Sequencial)

### T06: Controller + Rotas

- **Req**: REQ-006, REQ-007
- **Status**: ✅ Completed (2026-08-11)
- **Esforço**: 2h | Paralelável: Não
- **Depende de**: T05

**O quê**: Controller com endpoints + rotas para robot-docusign.

**Onde**:
- `src/modules/robot-docusign/controllers/robotDocusignController.js` (novo)
- `src/modules/robot-docusign/routes.js` (novo)
- `src/modules/robot-docusign/index.js` (novo — barrel export)
- `src/app.js` (montar rotas)

**Endpoints** (`backend/src/modules/robot-docusign/routes.js` + `routes/robotInstanceRoutes.js`):

| Método | Rota | Auth |
|--------|------|------|
| POST | `/trigger` | protect |
| POST | `/trigger-batch` | protect, admin |
| GET | `/status/:jobId` | protect |
| GET | `/jobs` | protect |
| GET | `/jobs/:jobId/stream` | protect |
| GET | `/metrics` | protect |
| GET | `/logs/:jobId` | protect |
| GET | `/config` | protect |
| PUT | `/config` | protect, admin |
| POST | `/test-login` | protect, admin |
| GET | `/queue` | protect |
| POST | `/process-pending` | protect |
| GET | `/instances` | protect, admin |
| POST | `/instance/auth` | público |
| GET | `/instance/instances` | protect, admin |
| GET | `/instance/config` | protect |
| GET | `/instance/next-job` | protect |
| PATCH | `/instance/job/:jobId/status` | protect |
| POST | `/instance/heartbeat` | protect |
| GET | `/instance/contracts/:contractId/pdf` | protect |

**Tests**: supertest (cada endpoint, auth, validação, erros)

**Feito quando**: Todos endpoints funcionam, auth OK, rotas em app.js, testes passam.

---

## Fase 4 — Frontend (Paralela)

### T07: Indicador de Modo no Step 6

- **Req**: REQ-009
- **Status**: [x] Done (2026-08-14)
- **Esforço**: 1.5h | Paralelável: Sim (com T08)
- **Depende de**: T06

**O quê**: Badge indicador (Robot/API) + lógica botão "Enviar" conforme modo.

**Onde**:
- `public/modules/contratos/contratos.html` (badge + indicator)
- `public/modules/contratos/contratos.js` (lógica toggle)
- `public/modules/contratos/services/docusignService.js` (wrapper robot)

**Comportamento**: Badge verde "🤖 Robot" / azul "📡 API" / amarelo "⏳ Processando..."; botão alterna conforme config; toast de status.

**Tests**: E2E Playwright (badge, click, toast)

**Feito quando**: Badge aparece, botão alterna, toast exibe status.

---

### T08: Card Config-Sistema

- **Req**: REQ-010
- **Status**: [x] Done (2026-08-14)
- **Esforço**: 1.5h | Paralelável: Sim (com T07)
- **Depende de**: T02, T06

**O quê**: Card dedicado no config-sistema.html com controles do robot.

**Onde**:
- `public/modules/config-sistema/config-sistema.html` (card)
- `public/modules/config-sistema/config-sistema.js` (handlers)

**Componentes**: Toggle principal, modo (API/Robot), credenciais, agendamento (intervalo/horário), limites, status.

**Tests**: E2E Playwright (card, toggle, save, test-login)

**Feito quando**: Card exibe controles, toggles funcionam, credenciais salvas, E2E passa.

---

## Fase 5 — Agendamento (Sequencial)

### T09: Scheduler Interno + Rota process-pending

- **Req**: REQ-011
- **Status**: [x] Done (2026-08-11)
- **Esforço**: 1h | Paralelável: Não
- **Depende de**: T06

**O quê**: Scheduler interno (`robotScheduler.start()`/`stop()` + `processPendingJobs()`) + rota `POST /process-pending` para trigger manual/cron externo.

**Onde**: `backend/src/modules/robot-docusign/services/robotScheduler.js`, `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`, `backend/src/server.js` (bootstrap)

**Fluxo**: a cada intervalo → verificar habilitado → horário válido + concorrência → pegar 1 contrato `gerado` → orchestrator.trigger() → resultado

**Restrições**: máx 1 contrato/execução, respeitar horário, skip se desabilitado

**Tests**: Mock orchestrator + simulação de cron (execução, horário, skip)

**Feito quando**: Scheduler executa periodicamente, 1 contrato/vez, respeita horário, testes passam.

---

## Fase 6 — Validação

### T10: Testes E2E Completos

- **Req**: Todos
- **Status**: [x] Done (2026-08-14)
- **Esforço**: 2h | Paralelável: Não
- **Depende de**: T07, T08, T11

**O quê**: Cenários E2E completos — config, auto-save, test-login, instâncias e Step 6.

**Onde**: `tests/e2e/robot-docusign.spec.js` (novo)

**Cenários**:
1. Configuração inicial e validação de visibilidade de controles.
2. Auto-save de configurações.
3. Teste de login e conectividade com feedback visual e badge.
4. Renderização da lista de instâncias conectadas.
5. Indicador de modo Robot/API no Step 6 de Contratos.

**Tests**: Playwright headed/headless

**Feito quando**: Arquivo de teste E2E criado e cobrindo os cenários em desktop no ambiente de produção.

---

## Fase 7 — Refatoração e Otimização Frontend

### T11: Refatoração Frontend Robot-DocuSign (SOLID + PonyTail)

- **Req**: REQ-010 (Interface de Configuração do Robô)
- **Status**: [x] Done (2026-08-14)
- **Esforço**: 1h | Paralelável: Sim
- **Depende de**: Nenhuma

**O quê**:
Refatorar o frontend de configuração do robô DocuSign adotando a Abordagem 2 (Equilibrada — 2 arquivos JS):
1. **Camada de Serviço (`robotDocusignService.js`)**: Encapsular todas as chamadas de API (`fetchConfig`, `saveConfig`, `testLogin`, `fetchStatusMetrics`, `fetchInstances`), corrigindo a chamada inválida `window.api.getRobotInstances()`.
2. **Camada de UI (`robot-docusign.js`)**: Centralizar ciclo de vida, preenchimento/coleta de formulário, auto-save e renderização limpa de cards sem vazar timers para o escopo global.
3. **Limpeza de Estilos (`robot-docusign.css`)**: Expurgar ~216 linhas de classes utilitárias e regras duplicadas do design system global.

**Onde**:
- `public/modules/config-sistema/robot-docusign/robotDocusignService.js` (novo - ~75 linhas)
- `public/modules/config-sistema/robot-docusign/robot-docusign.js` (refatorado - ~140 linhas)
- `public/modules/config-sistema/robot-docusign/robot-docusign.css` (refatorado - ~280 linhas)
- `public/modules/config-sistema/robot-docusign/robot-docusign.html` (100% preservado)

**Proteção de Legado (impact-protector)**:
- Preservar todos os IDs, seletores e tags de `robot-docusign.html`.
- Preservar rotas de backend e schemas Zod em `src/modules/config-sistema/`.

**Feito quando**:
- [x] Módulo `robotDocusignService.js` criado e exportando as 5 funções de serviço.
- [x] `robot-docusign.js` refatorado sem erros no console durante o polling.
- [x] Auto-save e teste de login funcionando com feedback visual no `#toastContainer`.

---

### T12: Correção de Segurança, Concorrência de Polling, Proxy Nginx e RBAC do Robot-DocuSigner

- **Req**: REQ-006, REQ-010, REQ-INST-01
- **Status**: [x] Done (2026-08-14)
- **Esforço**: 1h | Paralelável: Sim
- **Depende de**: T11

**O quê**:
1. **Padronização de Rota & Nginx**: Remover barra final em `nginx/default.conf` (`set $rpa_docusigner_api "http://rpa_docusigner:3111"`) e padronizar chamada de instâncias para `GET /api/robot-docusign/instances` no `robotDocusignService.js` e `robotInstanceRoutes.js`.
2. **Mitigação de XSS**: Sanitizar `instance_id`, `hostname` e `platform` com helper `escapeHtml` na renderização de cards em `robot-docusign.js`.
3. **Prevenção de Acúmulo de Polling**: Substituir `setInterval` por polling recursivo assíncrono controlado com `setTimeout` no bloco `finally` e guard `document.hidden` em `robot-docusign.js`.
4. **Aplicação de RBAC/ACL e Desambiguação de Rota**: Remover mount genérico de `instanceRoutes` em `routes.js` que colidia com `GET /config`, adicionando `router.get("/instances", authorize("admin"), getAllInstances)`.

**Onde**:
- `nginx/default.conf`
- `public/modules/config-sistema/robot-docusign/robot-docusign.js`
- `public/modules/config-sistema/robot-docusign/robotDocusignService.js`
- `gestor-oportunidades-rpa-docusigner/src/modules/robot-docusign/routes/robotInstanceRoutes.js`
- `gestor-oportunidades-rpa-docusigner/src/modules/robot-docusign/routes.js`

**Proteção de Legado (impact-protector)**:
- Preservar integralmente `robot-docusign.html`, IDs do DOM, classes CSS e rotas legadas.

---

## Diagrama de Dependências

```
T01 ─────┐
T02 ─────┤
T03 ─────┤──→ T05 ──→ T06 ──┬──→ T07 (Frontend Step6)
T04 ─────┘                   ├──→ T08 (Frontend Config)
                             └──→ T09 (Agendamento)
                                    │
                                    v
                                   T10 (E2E)
```

## Estimates

| Task | Esforço | Paralelável |
|------|---------|-------------|
| T01 | 1h | Sim (Fase 1) |
| T02 | 1.5h | Sim (Fase 1) |
| T03 | 2h | Sim (Fase 1) |
| T04 | 4h | Não (Fase 1) |
| T05 | 2h | Não (Fase 2) |
| T06 | 2h | Não (Fase 3) |
| T07 | 1.5h | Sim (Fase 4) |
| T08 | 1.5h | Sim (Fase 4) |
| T09 | 1h | Não (Fase 5) |
| T10 | 2h | Não (Fase 6) |
| **Total** | **18.5h** | **6h em paralelo** |

## Correções de Regressão

### [x] Correção E — ensureAuthenticated com networkidle + guard pós-fill

- **Status**: Done (2026-08-12)
- **Arquivo**: `src/modules/robot-docusign/services/robotBrowser.js`
- **Problema**: `page.goto(targetUrl)` resolvia na conclusão HTTP, mas o DocuSign é uma SPA que faz redirect client-side para `/oauth/auth` após o JS carregar. `page.url()` retornava a URL correta por uma fração de segundo antes do redirect, fazendo `ensureAuthenticated` passar sem detectar nada.
- **Solução**:
  1. `page.goto` substituído por `page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 })` nas duas ocorrências de `ensureAuthenticated`.
  2. Nova função interna `guardedAction` envolve todos os `page.fill`/`page.click`/`page.setInputFiles` em `send`, detectando redirect OAuth mid-interaction e invalidando sessão automaticamente.
- **Intocados**: `robotSession.js`, `robotOrchestrator.js`, `robotSelectors.js`, `robotScheduler.js`, modelos, controllers, rotas, frontend, testes existentes.

---

---

## Fase 8 — Integração com Gestor de Oportunidades (Robot Profile)

### T13: Criação do Cliente HTTP do Gestor (`gestorApiClient.js`)

- **Req**: REQ-ROBOT-KEY-01, REQ-ROBOT-KEY-02
- **Status**: [x] Done (2026-08-17)
- **Esforço**: 1h | Paralelável: Sim
- **Depende de**: Nenhuma

**O quê**:
Criar `src/services/gestorApiClient.js` para comunicar com o Gestor de Oportunidades através do header `x-robot-key`.
- `validateApiKey()`: Chama `POST /api/internal/robot-keys/validate` para checar validade da chave configurada e obter dados do perfil (cargo, nome, active).
- `fetchPendingContracts()`: Chama `GET /api/contracts` com query params (ex: `status: "pending_signature"`).
- `updateContractStatus(contractId, payload)`: Chama `PUT /api/contracts/:id` atualizando envelope_id e status pós-processamento no DocuSign.

**Onde**:
- `src/services/gestorApiClient.js` (novo)
- `.env.example` (adicionar `GESTOR_API_URL` e `ROBOT_API_KEY`)

**Tests**: `test/backend/services/gestorApiClient.test.js`

**Feito quando**:
- [x] `gestorApiClient.js` criado com suporte a `baseURL` e header `x-robot-key: process.env.ROBOT_API_KEY`.
- [x] Funções `validateApiKey`, `fetchPendingContracts` e `updateContractStatus` exportadas.
- [x] Falhas de validação de rede tratadas retornando `{ valid: false }` graciosamente.

---

### T14: Guard de Validação de Chave no Bootstrap

- **Req**: REQ-ROBOT-KEY-03
- **Status**: [x] Done (2026-08-17)
- **Esforço**: 0.5h | Paralelável: Não
- **Depende de**: T13

**O quê**:
Adicionar guard no bootstrap do servidor (`src/server.js`) para verificar a validade da `ROBOT_API_KEY` antes de iniciar workers, o scheduler e o listener HTTP. Se inválida ou revogada, aborta a inicialização com mensagem informativa.

**Onde**:
- `src/server.js` (modificar)

**Feito quando**:
- [x] `validateApiKey()` chamada durante o bootstrap da aplicação.
- [x] Se `valid === true`: prossegue com inicialização do scheduler e `app.listen()`.
- [x] Se `valid === false`: log de erro "Chave de API do robô inválida ou revogada. Verifique o painel do Gestor." e encerra com `process.exit(1)`.

---

## Fase 9 - Suporte a Código OTP/MFA no test-login

### T15: Código de Acesso Temporário (OTP) no Login DocuSign

- **Req**: REQ-OTP-01, REQ-OTP-02
- **Status**: [x] Done (2026-08-25)
- **Esforço**: 2h | Paralelizável: Não
- **Depende de**: Nenhuma

**Contexto**:
O frontend do `gestor-oportunidades` (PR #461, commit `986e358`, já mergeado) adicionou o input `id="docusignOtpCode"` na tela de configuração do Robô DocuSign. No evento `blur`, com 6 dígitos válidos, ele dispara `testLogin({ email, password, otpCode })` → `POST /api/robot-docusign/test-login`. Este serviço ainda **não suporta** `otpCode`: o schema Zod descarta o campo e o fluxo de login Playwright não preenche a tela de MFA/2FA do DocuSign.

**O quê**:
1. Aceitar `otpCode` opcional em `POST /test-login` e propagá-lo até o fluxo de login Playwright.
2. Detectar a tela MFA/2FA do DocuSign após a submissão da senha e:
   - Com `otpCode` presente → preencher o código e submeter.
   - Sem `otpCode` → retornar erro específico **401 `{ "error": "MFA_REQUIRED", "message": "Login DocuSign exige código de segurança (MFA). Informe o código temporário." }`**.
3. Se o `otpCode` for informado mas estiver inválido/expirado → erro distinto **401 `{ "error": "OTP_INVALID", "message": "Código temporário inválido ou expirado. Gere um novo código." }`**.
4. **Prazo maior de espera quando a tela MFA aparecer**: usar constante `MFA_TIMEOUT` (90s) no lugar dos timeouts padrão — tanto na detecção do input MFA (`waitForSelector`) quanto na navegação pós-submissão do código (`waitForURL`). Fluxo sem MFA permanece com os timeouts atuais (10s/30s), sem breaking change.

**Onde**:
- `backend/src/modules/robot-docusign/controllers/robotDocusignController.js` — `testLoginSchema`: adicionar `otpCode: z.string().regex(/^\d{6}$/).optional()`; propagar nas credenciais; mapear erros `MFA_REQUIRED`/`OTP_INVALID` para HTTP 401 com corpo JSON específico.
- `backend/src/modules/robot-docusign/services/robotSession.js` — `loginAndSaveSession`: passo opcional pós-senha com detecção da tela MFA, preenchimento do código e submissão; constantes `MFA_TIMEOUT`; seletores de MFA (ex.: `input[type='tel'], input[data-testid='mfa-code'], input[autocomplete='one-time-code']`) aceitos via `selectors.mfa`.
- `test/backend/services/robotSession.test.js` — testes unitários: MFA sem código → erro `MFA_REQUIRED`; MFA com código → preenche/submente com timeout estendido; OTP inválido → erro `OTP_INVALID`; sem tela MFA → fluxo inalterado.
- `test/backend/controllers/robotDocusignController.test.js` — integração: payload com `otpCode` válido/inválido (Zod → 400) e mapeamento dos erros 401.

**Feito quando**:
- [x] Schema Zod aceita `otpCode` de exatamente 6 dígitos numéricos (opcional).
- [x] Controller propaga `otpCode` para `robotSession.getOrRefreshSession`/`loginAndSaveSession`.
- [x] Erro `MFA_REQUIRED` (401) retornado quando a tela MFA aparece sem código.
- [x] Erro `OTP_INVALID` (401) retornado quando o código é rejeitado/expira.
- [x] Timeouts da etapa MFA estendidos via constante `MFA_TIMEOUT` (90s); fluxo normal inalterado.
- [x] Testes unitários e de integração passando (`npm test` — 87 testes, 0 falhas).
- [ ] Deploy: merge na `main` dispara `.github/workflows/deploy.yml` (comandos git gerados, não executados — ver `.agents/rules/commit.md`).

---

## Fase 10 — Resolução Automática de MFA/OTP via Webmail Roundcube

### T16: Extração Automática de Código MFA no Webmail Roundcube

- **Req**: REQ-MFA-AUTO-01
- **Status**: [x] Done (2026-08-27)
- **Esforço**: 2.5h | Paralelizável: Não
- **Depende de**: T15

**Contexto**:
Ao autenticar na DocuSign pelo robô, quando um novo dispositivo ou sessão exige verificação MFA ("Get Code From Your Email"), a DocuSign envia um e-mail para a conta configurada com o assunto `"Verificar um novo dispositivo"` contendo um código numérico de 6 dígitos dentro de um card com o texto `"Seu código de verificação da Docusign é:"`.

**O quê**:
1. Obter credenciais do webmail (`token_notification_email: { email, password }`) via pull do `SystemConfig` (`/api/system-config/robot-docusign` e `/api/robot-docusign/instance/config`).
2. Criar utilitário `fetchMfaCodeFromRoundcube(context, mailCredentials)` em `robot/src/browser/roundcube.js`:
   - Abre uma aba e acessa `https://unitynordeste.com.br:2096/`.
   - Realiza login no cPanel Webmail com `#user` e `#pass`.
   - Na Caixa de entrada do Roundcube, localiza a mensagem mais recente de `"Docusign Account"` com assunto `"Verificar um novo dispositivo"`.
   - Abre o e-mail, lê o texto e extrai o código de 6 dígitos via regex `/Seu c[oó]digo de verifica[cç][aã]o da Docusign [eé]:\s*(\d{6})/i`.
   - Fecha a aba do webmail e retorna o código.
3. Integrar com o fluxo de autenticação DocuSign (`robot/src/browser/docusign.js` e `backend/src/modules/robot-docusign/services/robotSession.js`):
   - Ao detectar a tela de MFA pós-senha, chama a extração automática.
   - Preenche o código de verificação no input da DocuSign e clica em `"Verify"`.
   - Aguarda o redirecionamento com `MFA_TIMEOUT` (90s).

**Onde**:
- `robot/src/browser/roundcube.js` (novo)
- `robot/src/browser/docusign.js` (modificar `ensureAuthenticated`)
- `robot/src/browser/selectors.js` (seletores Roundcube e MFA DocuSign)
- `backend/src/modules/robot-docusign/services/robotOrchestrator.js` (incluir decifragem de `token_notification_email`)
- `backend/src/modules/robot-docusign/controllers/robotInstanceController.js` (expor `token_notification_email` em `getInstanceConfig`)

**Feito quando**:
- [x] `roundcube.js` acessa o webmail, autentica e localiza o e-mail de verificação.
- [x] Código de 6 dígitos extraído com precisão a partir do padrão visual do e-mail.
- [x] Tela de MFA da DocuSign preenchida automaticamente e login concluído.
- [x] `token_notification_email` integrado via pull nas configurações.

---

## Fase 11 — Extração Headless de MFA via Protocolo IMAP

### T17: Leitura Headless de Código MFA via Protocolo IMAP/POP3
 
 - **Req**: REQ-MFA-IMAP-01, REQ-MFA-IMAP-02, REQ-MFA-IMAP-03
 - **Status**: [x] Done (2026-08-27)
 - **Esforço**: 2h | Paralelizável: Não
 - **Depende de**: T16
 
 **Contexto**:
 O sistema `gestor-oportunidades` já persiste as configurações completas de conexão com o servidor de e-mail de segurança (`token_notification_email: { email, password, host, port, tls }`) em `SystemConfig`. A extração via Roundcube Webmail (Playwright) abre abas adicionais no navegador e consome ~15-20s. A leitura direta via protocolo IMAP/TLS obtém o código em ~1s com zero overhead de renderização visual.
 
 **O quê**:
 1. Criar utilitário `fetchMfaCodeViaImap(mailCredentials, options)` em `robot/src/browser/imapClient.js` usando sockets TLS nativos (`node:tls`) sem dependências pesadas extras (100% compatível com build/bytecode).
 2. Realizar handshake com `host:port` (TLS direto na 993 ou STARTTLS na 143 com `{ rejectUnauthorized: false }`), autenticar via `LOGIN`, acessar `INBOX`, buscar e-mails mais recentes via UID, decodificar `quoted-printable`/`base64` e extrair o código de 6 dígitos via regex.
 3. Marcar e-mail processado como lido (`\Seen`) e encerrar conexão.
 4. No backend central (`robotDocusignController.js`):
    - Atualizar `updateConfigSchema` no Zod para validar `token_notification_email`.
    - Garantir criptografia de `password` com `encryptText` no salvamento.
 5. Integrar com `docusign.js` (`ensureAuthenticated`) chamando `fetchMfaCodeViaImap` com fallback defensivo para `roundcube.js` em caso de instabilidade do servidor IMAP.
 
 **Onde**:
 - `robot/src/browser/imapClient.js` (novo)
 - `robot/src/browser/docusign.js` (modificar chamada de MFA)
 - `backend/src/modules/robot-docusign/controllers/robotDocusignController.js` (atualizar schema Zod e encryptText)
 - `backend/src/modules/robot-docusign/services/robotOrchestrator.js` (propagação de host/port/tls)
  - `test/robot/browser/imapClient.test.js` (fonte da verdade) e `test/backend/services/imapClient.test.js` (reexport ponytail M3)
 
 **Feito quando**:
 - [x] Conexão TLS com servidor IMAP autentica e extrai o código de 6 dígitos em < 3 segundos.
 - [x] Suporte a decodificação MIME (Quoted-Printable e Base64) testado e validado.
 - [x] `updateConfig` persiste `token_notification_email` com senha cifrada sem perda de dados.
 - [x] Fluxo Playwright preenche o código na DocuSign sem abrir abas de webmail.
 - [x] Testes unitários com mock IMAP passam com 100% de sucesso.

---

## Fase 12 — Refinamento e Resiliência do Cliente IMAP

### T18: Hardening, Resiliência e Otimização do Cliente IMAP Nativo

- **Req**: REQ-MFA-IMAP-02, REQ-MFA-IMAP-04, REQ-MFA-IMAP-05
- **Status**: [x] Complete (2026-08-27)
- **Esforço**: 1.5h | Paralelizável: Sim
- **Depende de**: T17

**Contexto**:
A Task T17 implementou com sucesso a extração headless via protocolo IMAP direto. Para elevar a resiliência e estabilidade em ambientes corporativos adversos (com limites de autenticações por minuto ou caixas postais densas), esta task introduz tratamento instantâneo de erros de conexão no socket, mitigação de rate-limit com backoff e filtro temporal (`SINCE`).

**O quê**:
1. **Tratamento Imediato de Queda de Conexão no `sendCommand`**:
   - Anexar listeners temporários de `error` e `close` durante a execução de comandos IMAP para rejeitar a Promise imediatamente se o socket for encerrado/cair, sem reter o processo até o timeout de 15s.
2. **Mitigação de Rate-Limit e Backoff no Polling**:
   - Ajustar o intervalo padrão de polling para 3s e implementar reuso de sessão / backoff linear adaptativo para proteger contra limites rígidos de login por minuto (ex: Dovecot/cPanel).
3. **Filtro Temporal IMAP (`SINCE`)**:
   - Adicionar critério temporal (`SINCE <DD-Mon-YYYY>`) na consulta `UID SEARCH` para limitar o escopo de busca a mensagens recebidas no dia corrente, evitando processamento de mensagens legadas antigas em caixas densas.
4. **Testes Unitários de Resiliência**:
   - Atualizar a suíte de testes unitários para cobrir desconexões forçadas durante `sendCommand`, filtro `SINCE` e tratamento de erros do socket.

**Onde**:
- `robot/src/browser/imapClient.js` (adicionar listeners de socket no sendCommand, filtro temporal e opções de polling)
- `test/robot/browser/imapClient.test.js` (fonte da verdade) e `test/backend/services/imapClient.test.js` (reexport ponytail M3 — testes de resiliência e socket drops)

**Feito quando**:
- [x] Quedas de socket durante `sendCommand` rejeitam a operação imediatamente com erro descritivo.
- [x] Busca `UID SEARCH` inclui critério temporal `SINCE` sem quebrar compatibilidade com servidores IMAP padrão.
- [x] Estratégia de polling com backoff previne esgotamento de conexões simultâneas/limites de autenticação.
- [x] 100% dos testes unitários novos e existentes passam com sucesso via `node --test`.

---

### T20: Otimização PonyTail e Redução de Roundtrips IMAP

- **Req**: REQ-MFA-IMAP-01, REQ-MFA-IMAP-02
- **Status**: [x] Complete (2026-08-27)
- **Esforço**: 1h | Paralelizável: Sim
- **Depende de**: T18, T19

**Contexto**:
Aplicação dos princípios PonyTail para simplificação, remoção de overhead de roundtrips, eliminação de duplicação de testes e contenção de rate-limits no IMAP.

**O quê**:
1. **M1 (Redução de UID SEARCH)**: Redução de 8 consultas IMAP sequenciais para 2 padrões (`SINCE <data>` com fallback `ALL`), delegando a filtragem por regex para o cliente.
2. **M2 (Reuso de Conexão IMAP)**: Manutenção do mesmo socket/sessão autenticada durante o loop de polling em `fetchMfaCodeViaImap`.
3. **M3 (Eliminação de Duplicação de Testes)**: Manter `test/robot/browser/imapClient.test.js` como fonte da verdade e referenciar diretamente em `test/backend/services/imapClient.test.js` (reexport ponytail M3).
4. **M4 (Alinhamento de Constantes)**: `pollIntervalMs: 3000`, `backoffFactor: 1.2`, `maxPollIntervalMs: 6000`.

**Onde**:
- `robot/src/browser/imapClient.js` (M1/M2/M4 — `fetchMfaCodeViaImap`, `formatImapDate`, `SINCE`, `pollIntervalMs/backoff`)
- `test/robot/browser/imapClient.test.js` (fonte da verdade, M3)

**Feito quando**:
- [x] 8 → 2 `UID SEARCH` (M1), reuso de socket no polling (M2), teste único (M3) e constantes `3000/1.2/6000` (M4) — `CHANGELOG 5.51.0` migrado
- [x] `validation.md § T20` criado com cenários M1-M4

---

## Fase 13 — Filtro de Título e Timestamp no Cliente IMAP

### T24: Filtro IMAP por Título ("Verificar um novo dispositivo") e Timestamp de Disparo (`mfaTriggerTime`)

- **Req**: REQ-MFA-IMAP-06
- **Status**: [x] Complete (2026-08-28)
- **Esforço**: 1h | Paralelizável: Sim
- **Depende de**: T17, T18, T20, T23

**Contexto**:
Garantir que mensagens legadas ou com assuntos não relacionados a MFA não sejam processadas indevidamente pelo cliente IMAP, e remover regex permissiva genérica de 6 dígitos que causava falsos positivos.

**O quê**:
1. **Timestamp de Disparo (`mfaTriggerTime`)**: Registrar timestamp no robô (`docusign.js`) no instante em que a tela de MFA é detectada e repassar para `fetchMfaCodeViaImap`.
2. **Extração de Metadados IMAP (`parseEmailMetadata`, `decodeMimeHeader`)**: Extrair cabeçalhos `Subject` (com decodificação RFC 2047 Base64 e Quoted-Printable) e `Date` (via `INTERNALDATE` ou cabeçalho `Date`).
3. **Filtro de Assunto e Data**: Rejeitar e-mails cujo assunto não contenha `"Verificar um novo dispositivo"` ou cuja data seja anterior ao `mfaTriggerTime` (com margem defensiva de 30s de tolerância de relógio).
4. **Remoção de Regex Genérica**: Remover `\b(\d{6})\b` em `extractMfaCodeFromText`, restringindo a busca aos padrões textuais de verificação DocuSign.

**Onde**:
- `robot/src/browser/imapClient.js`
- `robot/src/browser/docusign.js`
- `test/robot/browser/imapClient.test.js` (fonte da verdade) + `test/backend/services/imapClient.test.js` (reexport)

**Feito quando**:
- [x] `mfaTriggerTime` registrado e propagado até a rotina IMAP.
- [x] Filtro estrito de assunto e timestamp ignora mensagens legadas e divergentes.
- [x] Regex genérica `\b(\d{6})\b` expurgada.
---

## Fase 14 — Hardening, Isolamento e Resiliência da Sessão Playwright

### T26: Proteção de Sessão, Criação Recursiva de Diretórios, Permissão 0o600 e Duplo Redirect

- **Req**: REQ-MFA-IMAP-08
- **Status**: [x] Complete (2026-08-28)
- **Esforço**: 1.5h | Paralelizável: Sim
- **Depende de**: T25

**Contexto**:
Garantir que arquivos de sessão com cookies (`session-docusign.json`) nunca vazem em commits ou builds Docker, tratar criação de diretórios pai de caminhos customizados, restringir permissões em sistemas UNIX (0o600), persistir rotações de cookies pós-envio/consulta, prevenir loops infinitos em telas de login OAuth e repassar caminho customizado ao `JobRunner`.

**O quê**:
1. **P0 (Isolamento de Segredos)**: Adicionar `session-docusign.json` e `**/session-docusign.json` no `.gitignore` e `.dockerignore`.
2. **P0 (Diretório Recursivo)**: Criar diretório pai via `fs.mkdirSync(path.dirname(sessionPath), { recursive: true })` antes de carregar e salvar storageState.
3. **P1 (Permissão Restrita 0o600)**: Aplicar `fs.chmodSync(sessionPath, 0o600)` com fallback best-effort.
4. **P1 (Persistência Pós-Operação)**: Invocar `saveSessionState(page, sessionPath)` ao término de `sendEnvelope` e `checkEnvelopeStatus`.
5. **P1 (Proteção contra Duplo Redirect)**: Em `sendEnvelope` e `checkEnvelopeStatus`, validar a URL após reautenticação e lançar erro explícito se permanecer em rotas OAuth/login.
6. **P1 (Propagação de Configuração)**: Expor `DOCUSIGN_SESSION_PATH` em `config.js` e repassar a `JobRunner` no `main.js`.
7. **P2 (Testes e Documentação)**: Criar suíte de testes unitários `test/robot/browser/docusign.test.js` e documentar `DOCUSIGN_SESSION_PATH` em `.env.example`, `README.md` e `AGENTS.md`.

**Onde**:
- `.gitignore`
- `.dockerignore`
- `robot/src/browser/docusign.js`
- `robot/src/job-runner.js`
- `robot/src/config.js`
- `robot/src/main.js`
- `test/robot/browser/docusign.test.js`
- `.env.example`
- `README.md`
- `AGENTS.md`

**Feito quando**:
- [x] Arquivo de sessão protegido contra commits acidentais e inclusão em containers.
- [x] Caminhos customizados com subpastas inexistentes criados sem erro ENOENT.
- [x] Permissão 0o600 aplicada.
- [x] Cookies atualizados pós-envio e consulta gravados em disco.
- [x] Duplo redirect detectado com falha rápida (fail-fast).
- [x] 100% dos testes unitários e de regressão passando (160/160 testes).

### T27: Correção de Paridade MFA Roundcube e Limpeza de Charset (5.56.1)

- **Req**: REQ-MFA-IMAP-02, REQ-MFA-IMAP-06
- **Status**: [x] Done (2026-08-28) — patch pós-T26, `CHANGELOG 5.56.1` migrado
- **Esforço**: 0.5h | Paralelizável: Sim
- **Depende de**: T24, T26

**O quê**:
1. **Paridade `roundcube.js:19` ↔ `imapClient.js:438`**: `parseRoundcubeDate` em `:19` (após `import logger`) descarta mensagens sem data reconhecível quando `mfaTriggerTime` definido (`toleranceMs=30000`), alinhado a `imapClient.js:445-451`.
2. **Limpeza `imapClient.js:81`**: removido `decodeQuotedPrintable` redundante em `decodeMimeHeader` — já decodifica blocos `Q`/`B` via `getBufferEncoding` (`:11` preserva encoding).
3. **Resiliência `job-runner.js`**: `mkdirSync` com `logger.warn` em falha de criação de diretório de sessão.

**Onde**:
- `robot/src/browser/roundcube.js:19`
- `robot/src/browser/imapClient.js:11,81,438`
- `robot/src/job-runner.js`

**Feito quando**:
- [x] `parseRoundcubeDate` + `toleranceMs` com paridade total com `imapClient.js`
- [x] `decodeQuotedPrintable` extra removido, `encoding` preservado
- [x] `logger.warn` em falha de `mkdirSync`
- [x] `validation.md § 5.56.1` cobre os 3 cenários com 160 testes passando

---

## Fase 15 — Parametrização e Conectividade de Produção

### T29: Registro e Parametrização de Conectividade de Produção (MongoDB & Chaves de Robô)

- **Req**: REQ-001, REQ-002, REQ-ROBOT-KEY-01, REQ-INST-01
- **Status**: [ ] Pending
- **Esforço**: 1h | Paralelizável: Sim
- **Depende de**: T01, T02, T06, T13, T14

**Contexto**:
O robô RPA possui arquitetura desacoplada onde o Servidor Central Docker (`backend/src/server.js`, porta 3111) conecta-se diretamente aos bancos MongoDB (`db_crm_funil` e `crm_contracts`) e valida sua chave no Gestor (`GESTOR_API_URL`), enquanto os robôs clientes autônomos (`robot/` compilados como `.exe`) comunicam-se via HTTP com a API Central utilizando a chave de acesso única de cada instância (`X-Robot-Key` / `ROBOT_KEY`).

**O quê**:
1. **Configuração de Ambiente do Servidor Central (`.env`)**:
   - Parametrizar no `.env` do droplet de produção (`/home/appuser/servidor-unity-rce/gestor-oportunidades-rpa-docusigner/.env`):
     - `MONGO_URI`: `mongodb://.../db_crm_funil`
     - `MONGO_CONTRACTS_URI`: `mongodb://.../crm_contracts`
     - `JWT_SECRET`: segredo compatível com o Gestor
     - `GESTOR_API_URL`: endpoint do Gestor em produção
     - `ROBOT_API_KEY`: chave do robô cadastrada no `crm_acl`
2. **Provisionamento de Chaves de Acesso de Instâncias**:
   - Cadastrar as chaves no Gestor de Oportunidades (`GET/POST /api/system-config/robot-docusign/api-keys`), gravando no banco `crm_acl.robot_api_keys`.
3. **Compilação de Robôs com Chave Embutida para Produção**:
   - Gerar os binários executáveis `.exe` via `npm run build:robot` passando `--api-url` de produção e a chave correspondente da máquina.
4. **Validação de Conectividade e Heartbeat**:
   - Validar startup do container `app_docusigner` e autenticação com polling ativo dos robôs conectados (`POST /api/robot-docusign/instance/auth` e `POST /instance/heartbeat`).

**Onde**:
- `.specs/features/robot-docusigner/tasks.md`
- `.specs/STATE.md`
- `/home/appuser/servidor-unity-rce/gestor-oportunidades-rpa-docusigner/.env` (produção)

**Feito quando**:
- [ ] Servidor central conecta com sucesso aos bancos MongoDB (`db_crm_funil` e `crm_contracts`) no boot.
- [ ] Chaves de acesso emitidas no `crm_acl` autenticam robôs locais com geração de JWT de 30 dias.
- [ ] Executável do robô `.exe` consome fila de jobs e reporta status/heartbeat para a API de produção.

---

## Fase 16 — Hardening Pós-AD-031: Correções CRÍTICAS dos Steps Modulares

> **Origem**: Code review pós-AD-031 (`backend/src/modules/robot-docusign/services/steps/*` + `robotBrowser.js`) com 4 sub-agentes (infra/fluxo/pós-envio/orquestrador). Total: 6 CRÍTICOS + 8 ALTO + 10 MÉDIO. Referência: `.specs/STATE.md AD-031`.
> **Princípio**: Ponytail full — menor diff que corrige raiz, sem nova dependência; 1 helper centralizado corrige N callers.
> **Branch**: `fix/steps-hardening-ad031` (a partir de `main`)
> **Gate**: `npm run lint && node --env-file=.env.dev --test test/**/*.test.js` — 100% passando antes de cada commit

### T31: Eliminar Sucesso Fantasma — extractEnvelopeId, submit, status, download, resend

- **Status**: [x] Done (2026-08-31)
- **Esforço**: 2h | Paralelável: Não
- **Depende de**: AD-031
- **Severidade**: CRÍTICO (5 achados)

**O quê**:
1. `steps/extractEnvelopeIdStep.js:24` — remover `return generatedId || env-${Date.now()}`; lançar `throw new Error("Não foi possível extrair envelopeId após envio — verifique se o envelope foi criado")` quando `!generatedId`; validar `fallbackEnvelopeId` com `typeof === "string" && trim()` no topo; regex Frouxa `([a-zA-Z0-9-]+)` → `([0-9a-fA-F-]{20,})` ou `([0-9a-fA-F-]{36})` com teste contra URLs reais; remover dead-code `page.getAttribute(... data-envelope-id)` (atributo inexistente em `robotSelectors.js:33`) ou implementar intercept `POST /restapi/.../envelopes`; checar redirect `isLoginUrl(url)` antes de extrair.
2. `steps/submitEnvelopeStep.js:11` — `if (!sendSel.send_button) throw new Error("send_button selector missing")`; `if (typeof page.click !== "function") throw`; aguardar navegação antes de extrair: `await Promise.all([page.waitForURL("**/envelopes/**",{timeout:15000}).catch(()=>{}), guardedAction(()=>page.click(sel),page,email)])` ou `waitForLoadState("networkidle")`; validar botão habilitado `waitForSelector(sel+":not([disabled])",{state:"visible"})`; usar `page.locator(sel).first().click()` para seletor composto com vírgula.
3. `steps/statusStep.js:33` — `return normalizedStatus || "sent"` → `return normalizedStatus || "unknown"` ou `throw new Error("status não encontrado")`; validar contra enum `['sent','delivered','completed','voided',...]`; adicionar `waitUntil:"networkidle"` + `waitForSelector` antes de `textContent`; remover duck-type `typeof page.textContent`.
4. `steps/downloadStep.js:33` — só `return targetPath` após `downloadEvent.saveAs` com sucesso; senão `throw new Error("download não capturado — verifique acceptDownloads:true e seletor")`; remover 2º `page.click` duplicado; unificar em `guardedAction` com `Promise.race` + timeout.
5. `steps/resendStep.js:25` — após `page.click`, aguardar `waitForSelector("[data-testid='resend-success'], .toast-success",{timeout:8000})` ou `waitForResponse`; só então `return {success:true}`; senão `throw`.

**Onde**:
- `backend/src/modules/robot-docusign/services/steps/extractEnvelopeIdStep.js`
- `backend/src/modules/robot-docusign/services/steps/submitEnvelopeStep.js`
- `backend/src/modules/robot-docusign/services/steps/statusStep.js`
- `backend/src/modules/robot-docusign/services/steps/downloadStep.js`
- `backend/src/modules/robot-docusign/services/steps/resendStep.js`

**Feito quando**:
- [x] `extractEnvelopeId` nunca sintetiza ID; falha com erro descritivo quando URL não contém envelope
- [x] `submit` falha ruidosamente se seletor ausente e aguarda navegação antes de extrair
- [x] `status` retorna `"unknown"` ou throw em vez de `"sent"` falso-positivo
- [x] `download` só retorna path após `saveAs` confirmado; sem clique duplicado
- [x] `resend` só retorna `success:true` após confirmação visual/rede

---

### T32: Centralizar Detecção de Redirect e Endurecer guardedAction

- **Status**: [x] Done (2026-08-31)
- **Esforço**: 1h | Paralelável: Sim (com T31)
- **Depende de**: T31
- **Severidade**: CRÍTICO/ALTO

**O quê**:
1. `steps/stepUtils.js:26` — `guardedAction` passa a checar URL também no caminho feliz (hoje só no `catch`): `try{await action()} finally{ url=page.url(); if(isLoginUrl(url)) invalidate+throw }`; validar `page` com `page && typeof page.url==="function"` para evitar `TypeError` quando `page=null`; usar `throw new Error(msg,{cause:err})` para preservar stack; `invalidateSession.catch(e=>logger.warn(...))` em vez de `catch(()=>{})` silencioso.
2. Centralizar `isLoginUrl` — criar `export const isLoginUrl=(u)=>/account\.docusign\.com|apps\.docusign\.com|\/oauth\/|\/login|\/password|\/auth\?/.test(String(u))` em `stepUtils.js` (ou re-exportar de `robotSession.js:140`) e substituir 4 cópias divergentes em `stepUtils.js:31`, `authStep.js:19+28`, `robotBrowser.js:52`, `robotSession.js:140`.
3. `steps/authStep.js:14` — `page.goto(targetUrl,{waitUntil:"networkidle",timeout:30000})` envolver em `try/catch` com `captureDebugScreenshot`; trocar `networkidle` por `domcontentloaded`+`waitForSelector` sentinela; validar `page?.goto` e `targetUrl` com allowlist `https://*.docusign.com|*.docusign.net` + `startsWith("https://")`; `page.context()` com guard `typeof page.context==="function"`; normalizar `String(page.url?.() ?? "")`.
4. `robotBrowser.js:49` — remover checagem duplicada `postAuthUrl.includes(...)` (já feita em `authStep` e `guardedAction`); usar `isLoginUrl` centralizado.

**Onde**:
- `backend/src/modules/robot-docusign/services/steps/stepUtils.js`
- `backend/src/modules/robot-docusign/services/steps/authStep.js`
- `backend/src/modules/robot-docusign/services/robotBrowser.js`

**Feito quando**:
- [x] `guardedAction` invalida sessão tanto em throw quanto em sucesso com redirect silencioso
- [x] `isLoginUrl` único consumido em 4 lugares, sem divergência `/password`
- [x] `page=null` não mascara erro original; `cause` preservado; falha de `invalidateSession` logada
- [x] `ensureAuthenticated` com validação de URL e screenshot em falha

---

### T33: Corrigir resolveSelectors, Seletores e IO Síncrono

- **Status**: [x] Done (2026-08-31)
- **Esforço**: 1h | Paralelável: Sim
- **Depende de**: T32
- **Severidade**: ALTO/MÉDIO

**O quê**:
1. `steps/stepUtils.js:9` — `resolveSelectors()` hoje `if(typeof robotSelectors==="object") return robotSelectors` sempre true (dead-code `getSelectors()`). Fix: `export function resolveSelectors(){ return getSelectors(); }` (fresh read) ou cache com `fs.watch`/`mtime`. Decidir cache vs fresh e documentar.
2. `robotSelectors.js:68` — shallow merge `{...defaultSelectors,...parsed}` perde chaves aninhadas se JSON parcial. Fix: deepMerge 1 nível (`{send:{...default.send,...parsed.send}}`) ou `lodash.merge` (já instalado) ou exigir JSON completo com validação.
3. `robotSelectors.js:63` + `steps/statusStep.js:22` etc — `fs.existsSync+readFileSync` síncrono per-request (4× por job). Fix: resolver 1× em `robotBrowser.send` e injetar `selectors` nos steps `status/download/resend/reports` (já faz para `send`); ou memoize com `mtime`.
4. `robotSelectors.js:51` — seletores MFA duplicados com `robotSession.js:12` (`DEFAULT_MFA_SELECTOR` vs `selectors.mfa.input`). Unificar em `robotSelectors.mfa` como fonte única.

**Onde**:
- `backend/src/modules/robot-docusign/services/steps/stepUtils.js`
- `backend/src/modules/robot-docusign/services/robotSelectors.js`
- `backend/src/modules/robot-docusign/services/steps/statusStep.js`
- `backend/src/modules/robot-docusign/services/steps/downloadStep.js`
- `backend/src/modules/robot-docusign/services/steps/resendStep.js`
- `backend/src/modules/robot-docusign/services/steps/reportsStep.js`
- `backend/src/modules/robot-docusign/services/robotBrowser.js`

**Feito quando**:
- [x] `resolveSelectors` relê `docusign-ui.json` após alteração sem restart (cache mtime ativo)
- [x] Override parcial de `docusign-ui.json` não apaga defaults de `send`
- [x] Máximo 1 IO síncrono por operação (injetado e cacheado)
- [x] Seletores MFA com fonte única

---

### T34: Validação, Segurança e Path Traversal

- **Status**: [x] Done (2026-08-31)
- **Esforço**: 1.5h | Paralelável: Sim
- **Depende de**: T33
- **Severidade**: ALTO/MÉDIO

**O quê**:
1. **Validação `page`** — padronizar `assertPage(page)` helper (`if(!page?.goto || !page?.url) throw TypeError`) e remover duck-type `typeof page.fill==="function"` que mascara page corrompida; `stepUtils` deve validar `action` como função. Aplicar em todos os 12 steps.
2. **`envelopeId`** — validar com `if(!/^[a-z0-9-]{10,}$/i.test(envelopeId.trim())) throw` antes de interpolar em URL em `statusStep.js:20`, `downloadStep.js:27`, `resendStep.js:19`; trim + tipo `string` não-vazio.
3. **`downloadStep.js:33` — path traversal** — sanitizar `fileName` com `path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g,"_")` e verificar `targetPath.startsWith(path.resolve(downloadDir))`; validar `downloadDir` com `typeof==="string" && trim()` + allowlist `ALLOWED_ROOT`; trocar `fs.existsSync+mkdirSync` síncronos por `await fs.promises.mkdir(downloadDir,{recursive:true})`.
4. **`uploadDocumentStep.js:13` — path traversal + validação** — `documentPath` com `fs.existsSync` + `path.extname===".pdf"` + `path.resolve(downloadDir).startsWith(ALLOWED_ROOT)` antes de `setInputFiles`; erro explícito `Documento não encontrado`.
5. **`recipientEmail`/`subject`/`message`** — `recipientEmail.trim().toLowerCase()` + `z.string().email()` (Zod já no projeto); `subject?.slice(0,200)` e `message` sanitizado antes de logar em `RobotJob` (evita HTML persistido); `fillRecipientStep.js:17` falhar se `!sendSel.recipient_name` quando `recipientName` presente.
6. **Allowlist `targetUrl`/`baseUrl`** — JSON em disco writable → SSRF interno; validar `new URL(targetUrl).hostname.endsWith("docusign.com")||endsWith("docusign.net")`.

**Onde**:
- `backend/src/modules/robot-docusign/services/steps/stepUtils.js`
- `backend/src/modules/robot-docusign/services/steps/uploadDocumentStep.js`
- `backend/src/modules/robot-docusign/services/steps/fillRecipientStep.js`
- `backend/src/modules/robot-docusign/services/steps/fillMessageStep.js`
- `backend/src/modules/robot-docusign/services/steps/downloadStep.js`
- `backend/src/modules/robot-docusign/services/steps/statusStep.js`
- `backend/src/modules/robot-docusign/services/steps/resendStep.js`

**Feito quando**:
- [x] `page` inválido falha rápido com `TypeError` descritivo
- [x] `envelopeId` malformado rejeitado antes de `page.goto`
- [x] `download` e `upload` contidos em diretório permitido; traversal bloqueado
- [x] E-mail validado/normalizado; campos opcionais com limite; logs sem HTML

---

### T35: Retry Seletivo e Integração com Orquestrador

- **Status**: [x] Done (2026-08-31)
- **Esforço**: 1h | Paralelável: Sim
- **Depende de**: T34
- **Severidade**: ALTO

**O quê**:
1. `steps/retryStep.js:10` — retry cego retenta `MFA_REQUIRED`/`OTP_INVALID`/erro de validação → lockout. Fix: adicionar `shouldRetry` predicate `({retries:3, delay:1000, shouldRetry:(err)=>!["MFA_REQUIRED","OTP_INVALID"].includes(err.code) && (err.status>=500 || err.retryable!==false)})` ou `if(err.code==="MFA_REQUIRED"||err.code==="OTP_INVALID") throw err` no topo do loop; validar `maxRetries=Math.max(1,Math.floor(Number(maxRetries)||3))` e `delayMs` para evitar `throw undefined`; backoff exponencial `delayMs * Math.pow(2,attempt-1)` + jitter; log por tentativa `logger.warn`/`onRetry` callback.
2. Integrar `withRetry` no fluxo `robotBrowser.send` — hoje `withRetry` é exportado `robotBrowser.js:130` mas nunca usado em `send`; envolver `send` em `withRetry(()=>doSend())` ou documentar uso no caller `robotOrchestrator.js:271`; decidir e padronizar timeout global (`MFA_TIMEOUT 90s` + `retry 3×1s` vs job timeout do scheduler).
3. Garantir `captureDebugScreenshot` em catch de `upload/fill/submit` (hoje só `authStep.js:34` captura).

**Onde**:
- `backend/src/modules/robot-docusign/services/steps/retryStep.js`
- `backend/src/modules/robot-docusign/services/robotBrowser.js`
- `backend/src/modules/robot-docusign/services/robotOrchestrator.js`

**Feito quando**:
- [x] Erros não-retentáveis não são retentados; `MFA_REQUIRED` falha imediato
- [x] `withRetry(0)` não lança `undefined`; `maxRetries`/`delayMs` validados
- [x] Backoff exponencial + log por tentativa ativo
- [x] `send` envolvido em tratamento resiliente com captura de debug screenshots

---

### T36: Desacoplamento, Deduplicação e Helpers Compartilhados

- **Status**: [x] Done (2026-08-31)
- **Esforço**: 1.5h | Paralelável: Sim
- **Depende de**: T35
- **Severidade**: ALTO/MÉDIO

**O quê**:
1. **Desacoplar `backend→robot/`** — `robotBrowser.js:126` `await import("../../../../../robot/src/browser/docusign.js")` viola AD-015 (Docker backend não copia `robot/src` → `ERR_MODULE_NOT_FOUND` em prod). Fix: extrair `fetchAgreementsByRepresentative` para `backend/src/modules/robot-docusign/services/agreementsService.js` ou injetar via DI no `robotOrchestrator`; remover import cruzado; trocar dynamic import por import estático ou serviço desacoplado.
2. **Deduplicar `fill*`** — extrair `async function fillIfPresent(page, selector, value, email)` em `stepUtils.js` e substituir duplicação `fillRecipientStep.js:17` / `fillMessageStep.js:17` (4 ocorrências com `guardedAction`); para opcionais manter skip, para obrigatórios `throw` se seletor ausente.
3. **Helper de navegação** — extrair `navigateToEnvelope(page, envelopeId, selectors)` e `buildEnvelopeUrl(id, selectors)` em `stepUtils.js` para unificar duplicação `statusStep.js:20`, `downloadStep.js:27`, `resendStep.js:19`, `reportsStep.js:21` (hoje `/documents` vs `/envelopes` divergentes); resolver selectors 1× no orchestrator e injetar.
4. **Relatórios** — `reportsStep.js:11` `options` (startDate/endDate) é ecoado mas nunca usado; ou aplicar filtros na UI (`page.fill` nos datepickers + `click Apply`) ou remover da assinatura e documentar como não-filtrado; triplicação `total_sent/completed/pending` → loop `for(const [k,sel] of Object.entries({...}))`; sanitizar `parseInt` com `Number(text.replace(/[^\d]/g,""))`; remover echo de `options` no retorno (`return {totalSent,...}` sem `options`); adicionar `waitForSelector` antes de `textContent`.
5. **Normalização de assinaturas** — padronizar `(page, sendSel, data, email)` vs `(page, {sendSel,email})` vs `uploadDocument(page,sendSel,documentPath,email)` (4ª pos) inconsistente; escolher objeto único `uploadDocument(page,{sendSel,documentPath,email})` ou manter posicional documentado; corrigir `sendSel={}` default que não cobre `null` → `sendSel ?? {}`.
6. **Export duplicado** — `robotBrowser.js:130` `export {withRetry}` + `export default {withRetry}` duas fontes; manter só named `export {withRetry} from "./steps/retryStep.js"` ou só default.
7. **Ponytail** — avaliar colapsar 4 steps `fill*+upload` em 1 arquivo `sendSteps.js` OU manter granularidade mas documentar trade-off AD-031 (+77% linhas 285→506L) vs testabilidade; deletar branch morto `resolveSelectors` e fallback `data-envelope-id`.

**Onde**:
- `backend/src/modules/robot-docusign/services/robotBrowser.js`
- `backend/src/modules/robot-docusign/services/steps/stepUtils.js`
- `backend/src/modules/robot-docusign/services/steps/fillRecipientStep.js`
- `backend/src/modules/robot-docusign/services/steps/fillMessageStep.js`
- `backend/src/modules/robot-docusign/services/steps/statusStep.js`
- `backend/src/modules/robot-docusign/services/steps/downloadStep.js`
- `backend/src/modules/robot-docusign/services/steps/resendStep.js`
- `backend/src/modules/robot-docusign/services/steps/reportsStep.js`
- `backend/src/modules/robot-docusign/services/robotSelectors.js`
- `backend/src/modules/robot-docusign/services/agreementsService.js` (novo)

**Feito quando**:
- [x] `queryAgreements` sem import cruzado `backend→robot/`; prod sem `ERR_MODULE_NOT_FOUND`
- [x] `fillIfPresent` e `navigateToEnvelope` centralizados; duplicação eliminada
- [x] `reports` com loop DRY, parsing resiliente e contrato limpo
- [x] Assinaturas padronizadas; `null` sendSel tratado
- [x] Barrel `steps/index.js` não criado (YAGNI) — imports diretos mantidos

---

### Critérios de Aceite Globais Fase 16

- [x] Nenhum "sucesso fantasma": `extractEnvelopeId`/`status`/`download`/`resend` falham ruidosamente quando não há evidência de sucesso
- [x] `guardedAction` cobre tanto throw quanto redirect silencioso; `isLoginUrl` único
- [x] `resolveSelectors` com comportamento documentado (cache mtime leve) e deepMerge correto
- [x] Validação de `page`/`envelopeId`/`fileName`/`documentPath` com allowlist; path traversal bloqueado
- [x] `withRetry` seletivo com backoff exponencial e log; integrado ao fluxo `send`
- [x] `backend` sem dependência de `robot/src` em runtime; helpers deduplicados
- [x] `.specs/STATE.md` AD-032 registrado; `T31-T36` marcados Done; `validation.md` § Fase 16 com cenários validados

---

## Fase 17 — Filtro de Elegibilidade PDF + E-mail (AD-038)

### T38: Helper Centralizado e Validação em 3 Camadas

- **Req**: REQ-ELIG-01 (US-013)
- **Status**: [x] Done (2026-08-31)
- **Esforço**: 1h | Paralelável: Não
- **Depende de**: T09, T14, controllers `robotInstanceController` + `robotScheduler` + `robot/job-runner`

**O quê**:
1. Criar `backend/src/modules/robot-docusign/utils/contractEligibility.js` com `hasValue(trim)`, `hasPdf`, `hasRecipientEmail`, `isEligibleForSend` e `GERADO_ELIGIBLE_FILTER` (Mongo `$exists/$ne` + `$or` 4 e-mails).
2. `robotInstanceController.getNextJob`: usar `GERADO_ELIGIBLE_FILTER` no `findOneAndUpdate`; extrair `pdfUrl` via `hasPdf`; bloquear `action:"send"` inelegível com `isEligibleForSend`, marcar `RobotJob:failed` (`contract_missing_pdf_or_email`) e reverter `Contract` `em_processamento_robot`→`gerado` com `console.warn`.
3. `seletorApiRobot/robotScheduler.processPendingJobs`: usar `GERADO_ELIGIBLE_FILTER` no fallback Mongoose; pós-filtrar `gestorApiClient` candidato com `isEligibleForSend` em memória antes de criar job, com `warn` e queda para fallback.
4. `robot/src/job-runner.js:processJob`: extrair `recipientEmail` do job; validar `pdfUrl` + `recipientEmail` com `trim()` antes de `chromium.launch`; `throw` padronizado `"Contrato sem documento PDF anexado ou sem e-mail do destinatário."`.

**Onde**:
- `backend/src/modules/robot-docusign/utils/contractEligibility.js` (novo)
- `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
- `backend/src/modules/robot-docusign/seletorApiRobot/robotScheduler.js`
- `robot/src/job-runner.js`

**Feito quando**:
---

## Fase 18 — Critérios de Busca de Contratos Elegíveis (Todos exceto Rascunho)

### T41: Atualização do Filtro de Elegibilidade para Todos os Status Não-Rascunho

- **Req**: REQ-ELIG-02 (US-014)
- **Status**: [ ] Pending
- **Esforço**: 1h | Paralelável: Não
- **Depende de**: T38

**Contexto**:
Anteriormente, o robô filtrava apenas contratos com `status: "gerado"`. O novo critério expande a busca para capturar qualquer contrato cujo status seja diferente de `"rascunho"` (`status: { $ne: "rascunho" }`), desde que satisfaça simultaneamente as regras obrigatórias de integridade: PDF anexado (`documents.originalUrl` não-vazio) e e-mail do destinatário presente.

**O quê**:
1. **Helper Centralizado (`contractEligibility.js`)**:
   - Atualizar `GERADO_ELIGIBLE_FILTER` com `status: { $ne: "rascunho" }`.
   - Exportar aliases `CONTRACT_ELIGIBLE_FILTER` e `ELIGIBLE_CONTRACTS_FILTER` apontando para o mesmo objeto mantendo 100% de compatibilidade referencial (PonyTail/DRY).
2. **Consumo no Servidor Central (`robotInstanceController.js` e `robotScheduler.js`)**:
   - Garantir que `getNextJob` e `processPendingJobs` capturem contratos elegíveis com status `$ne: "rascunho"`.
   - Preservar a validação em memória via `isEligibleForSend` (`hasPdf` + `hasRecipientEmail`).
3. **Ferramenta de Diagnóstico (`tools/check-pending-jobs.js`)**:
   - Atualizar a consulta de diagnóstico para listar contratos com `status: { $ne: "rascunho" }` e rotular conformidade de elegibilidade.
4. **Documentação e Testes**:
   - Atualizar testes unitários em `test/backend/` cobrindo status diversos (ex.: `"gerado"`, `"pendente"`) e garantindo rejeição de `"rascunho"`.

**Onde**:
- `backend/src/modules/robot-docusign/utils/contractEligibility.js`
- `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
- `backend/src/modules/robot-docusign/seletorApiRobot/robotScheduler.js`
- `tools/check-pending-jobs.js`
- `test/backend/utils/contractEligibility.test.js`

**Feito quando**:
- [ ] `GERADO_ELIGIBLE_FILTER` e aliases atualizados para `status: { $ne: "rascunho" }`.
- [ ] Contratos com `status: "rascunho"` são estritamente ignorados pelo robô e scheduler.
- [ ] Contratos com status não-rascunho, com PDF e e-mail válidos são capturados e processados normalmente.
- [ ] Ferramenta `check-pending-jobs.js` reflete a nova regra.
---

### T27: Trava de Concorrência Atômica (isRunning / Mutex) no Scheduler de Status

- **Req**: REQ-SCHED-01
- **Status**: [x] Done (2026-08-31)
- **Esforço**: 1h | Paralelável: Sim
- **Depende de**: AD-041, AD-045

**Contexto**:
O `syncAllContractsStatus` em `statusSyncScheduler.js` não possuía trava de concorrência atômica, permitindo que execuções lentas de Playwright ou chamadas sob demanda via `POST /sync-status` gerassem instâncias sobrepostas de navegador, invalidando cookies de autenticação e criando race conditions no MongoDB.

**O quê**:
1. Flag de módulo `let isRunning = false` com checagem antecipada (retornando `{ status: "busy", reason: "already_running" }`).
2. Liberação garantida em bloco `try ... finally { isRunning = false; }`.
3. Exportação do helper `isStatusSyncRunning()`.
4. Testes unitários e de regressão em `tests/backend/services/statusSyncScheduler.test.js`.

**Onde**:
- `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`
- `backend/src/modules/robot-docusign/seletorApiRobot/index.js`
- `tests/backend/services/statusSyncScheduler.test.js`

**Feito quando**:
- [x] Flag `isRunning` bloqueia chamadas concorrentes com status `busy` e reason `already_running`.
- [x] Bloco `try...finally` garante liberação da trava em sucessos, falhas ou early returns.
- [x] Testes de regressão cobrindo concorrência, erros e bypass passando 100%.

---

### T28: Eliminação de Sucesso Fantasma (Anti-Phantom Success) no Mapeamento de Status de Envelope

- **Req**: REQ-SCHED-02
- **Status**: [x] Done (2026-08-31)
- **Esforço**: 0.5h | Paralelável: Sim
- **Depende de**: AD-041, AD-046

**Contexto**:
A cláusula `default:` de `mapEnvelopeStatusToContractStatus` em `statusSyncScheduler.js` retornava `"enviado"`, convertendo arbitrariamente qualquer status não catalogado, rascunho (`draft`) ou vazio vindo da DocuSign em contrato `"enviado"` no MongoDB.

**O quê**:
1. Atualizar `mapEnvelopeStatusToContractStatus` para retornar `null` em status não catalogados, vazios ou rascunhos.
2. No loop de sincronização `syncAllContractsStatus`, verificar se `targetStatus === null`; se for, registrar log de aviso (`console.warn`), registrar o `envelopeId` se recém-descoberto e pular (`continue`) sem alterar o status do contrato no banco.
3. Testes unitários e de regressão em `tests/backend/services/statusSyncScheduler.test.js` cobrindo status válidos, inválidos e contratos com status preservados no banco.

**Onde**:
- `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`
- `tests/backend/services/statusSyncScheduler.test.js`

**Feito quando**:
- [x] `mapEnvelopeStatusToContractStatus` retorna `null` para status desconhecidos, rascunhos ou vazios.
- [x] `syncAllContractsStatus` não modifica o status do contrato no banco para valores inválidos/desconhecidos da DocuSign.
---

### T29: Isolamento de Timers Assíncronos e Validação Completa de Regressão

- **Req**: REQ-REGR-01
- **Status**: [x] Done (2026-08-31)
- **Esforço**: 0.5h | Paralelável: Sim
- **Depende de**: AD-047

**Contexto**:
Ao executar toda a suíte de testes (`npm test`), timeouts de inicialização órfãos (`setTimeout` de boot em `robotScheduler.js` e `statusSyncScheduler.js`) permaneciam ativos mesmo após o encerramento das suítes de teste, causando vazamento de chamadas assíncronas ao Mongoose e timeouts de buffer em testes concorrentes.

**O quê**:
1. Rastrear `initialTimeoutId` e cancelá-lo explicitamente na rotina `stop()` de `statusSyncScheduler.js` e `robotScheduler.js`.
2. Configurar o ambiente local de testes com `.env.dev` e injeção controlada de `process.env.ROBOT_API_KEY` na suíte de testes de `statusSyncScheduler.test.js`.
3. Executar e validar 100% dos 195 testes em 13 arquivos de teste nativos do Node.js.

**Onde**:
- `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`
- `backend/src/modules/robot-docusign/seletorApiRobot/robotScheduler.js`
- `tests/backend/services/statusSyncScheduler.test.js`
- `.env.dev`

**Feito quando**:
- [x] `stop()` em ambos os schedulers limpa `initialTimeoutId` e timers periódicos.
- [x] Teste de sincronização de status desacoplado com `ROBOT_API_KEY` isolada.
- [x] Suíte completa de 195 testes passando com 0 falhas via `npm test`.

---

### T30: Declaração de envelopeId e docusign_envelope_id no Schema de Contract

- **Req**: REQ-CONTRACT-01
- **Status**: [x] Done (2026-08-31)
- **Esforço**: 0.5h | Paralelável: Sim
- **Depende de**: AD-048

**Contexto**:
Em `statusSyncScheduler.js`, o código atualiza `envelopeId` via `Contract.findByIdAndUpdate`. Como o schema de `Contract.js` opera com `strict: true` e não declarava essa propriedade, o campo era descartado silenciosamente durante a persistência.

**O quê**:
1. Declarar explicitamente `envelopeId: { type: String, default: null }` e `docusign_envelope_id: { type: String, default: null }` no schema Mongoose de `Contract.js`.
2. Adicionar JSDoc `@typedef {ContractDocument}` para tipagem estática e autocomplete.
3. Criar suíte de testes unitários e de regressão em `tests/backend/models/Contract.test.js`.
4. Atualizar documentação de schemas em `.specs/database/schema.md` e `.specs/STATE.md`.

**Onde**:
- `backend/src/models/Contract.js`
- `tests/backend/models/Contract.test.js`
- `.specs/database/schema.md`
- `.specs/STATE.md`

**Feito quando**:
- [x] `envelopeId` e `docusign_envelope_id` definidos com tipo `String` e default `null` no schema de `Contract.js`.
- [x] Suíte `Contract.test.js` criada com 4 testes unitários e de regressão passando.
- [x] Total de 143 testes de backend passando sem falhas.

---

## Riscos Identificados

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| DocuSign bloqueia automação (bot detection) | Alto | Delay randômico, user-agent realista, testar antes de investir |
| DO Functions não suporta Playwright (memória) | Alto | Verificar limites; alternativa: Docker container |
| Seletores UI mudam frequentemente | Médio | JSON separado facilita atualização; monitorar |
| Sessão expira rapidamente | Médio | Testar duração real; ajustar intervalo de re-login |
| Timeout DO Functions (30s) | Médio | Processar 1 contrato; monitoring de duração |
| Gestor offline na inicialização do robô | Médio | Log claro e retry ou exit defensivo com indicação de causa |
| Delay no recebimento do e-mail de verificação | Médio | Polling com retries de até 45s e clique no botão 'Atualizar' do webmail |


