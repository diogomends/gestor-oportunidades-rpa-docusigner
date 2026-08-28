# Robot-DocuSigner — Tasks de Implementação

> **Arquitetura de 2 Componentes**: Este projeto possui o **Servidor Central** (`backend/src/`) e o **Robô** (`robot/`). As tasks abaixo cobrem ambos — Fases 1-5 e 8 referem-se ao servidor; a sub-spec `build-executor/` cobre o robô e seu pipeline de build.

## Execution Protocol

- **Runner**: `node --test` (nativo do Node 18+)
- **Framework**: `node:assert` + `node:test` (mock.method, mock.restoreAll)
- **DB em testes**: `mongodb-memory-server` (quando necessário)
- **Playwright**: `npx playwright install chromium` (já no projeto)
- **Branch**: Criar branch `feat/robot-docusigner` antes de iniciar
- **Commits**: Atômicos por task, seguindo `.agents/rules/commit.md`
- **Lint**: `npm run lint` antes de cada commit
- **Idioma**: pt-BR em mensagens, comentários e documentação

## Gate Check Commands

```bash
npm run lint              # Lint antes de commit
npm test                  # Testes unitários
node --test src/modules/robot-docusign/**/*.test.js  # Testes do módulo
npm run typecheck         # Type check (se disponível)
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
| REQ-MFA-IMAP-06 | T24 | ✅ imapClient.test.js | ✅ Filtro Subject & mfaTriggerTime | — |
| REQ-MFA-IMAP-07 | T25 | ✅ job-runner.js / docusign.js | ✅ Persistência storageState | — |

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

**Tests**: `src/modules/robot-docusign/models/RobotJob.test.js`
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
- `backend/src/modules/robot-docusign/services/robotSession.test.js` — testes unitários: MFA sem código → erro `MFA_REQUIRED`; MFA com código → preenche/submente com timeout estendido; OTP inválido → erro `OTP_INVALID`; sem tela MFA → fluxo inalterado.
- `backend/src/modules/robot-docusign/controllers/robotDocusignController.test.js` — integração: payload com `otpCode` válido/inválido (Zod → 400) e mapeamento dos erros 401.

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
 - `robot/src/browser/imapClient.test.js` e `backend/src/modules/robot-docusign/services/imapClient.test.js` (novos testes unitários)
 
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
- `robot/src/browser/imapClient.test.js` e `backend/src/modules/robot-docusign/services/imapClient.test.js` (testes de resiliência e socket drops)

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
3. **M3 (Eliminação de Duplicação de Testes)**: Manter `robot/src/browser/imapClient.test.js` como fonte da verdade e referenciar diretamente em `backend/src/modules/robot-docusign/services/imapClient.test.js`.
4. **M4 (Alinhamento de Constantes)**: `pollIntervalMs: 3000`, `backoffFactor: 1.2`, `maxPollIntervalMs: 6000`.

**Onde**:
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
- `robot/src/browser/imapClient.test.js`

**Feito quando**:
- [x] `mfaTriggerTime` registrado e propagado até a rotina IMAP.
- [x] Filtro estrito de assunto e timestamp ignora mensagens legadas e divergentes.
- [x] Regex genérica `\b(\d{6})\b` expurgada.
- [x] Testes unitários cobrindo decodificação MIME, parsing e filtros temporais.

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


