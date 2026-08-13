# Robot-DocuSigner — Tasks de Implementação

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

---

## Fase 1 — Fundação (Paralela)

### T01: Modelo RobotJob

- **Req**: REQ-001
- **Status**: Pending
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
- **Status**: Pending
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
- **Status**: Pending
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
- **Status**: Pending
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

**Endpoints**:

| Método | Rota | Auth |
|--------|------|------|
| POST | `/trigger` | protect |
| POST | `/trigger-batch` | protect, admin |
| GET | `/status/:jobId` | protect |
| GET | `/jobs` | protect |
| GET | `/metrics` | protect |
| GET | `/logs/:jobId` | protect |
| GET | `/config` | protect |
| PUT | `/config` | protect, admin |
| POST | `/test-login` | protect, admin |
| GET | `/queue` | protect |

**Tests**: supertest (cada endpoint, auth, validação, erros)

**Feito quando**: Todos endpoints funcionam, auth OK, rotas em app.js, testes passam.

---

## Fase 4 — Frontend (Paralela)

### T07: Indicador de Modo no Step 6

- **Req**: REQ-009
- **Status**: Pending
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
- **Status**: Pending
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

### T09: DO Function + Cron

- **Req**: REQ-011
- **Status**: Pending
- **Esforço**: 1h | Paralelável: Não
- **Depende de**: T06

**O quê**: Function serverless + cron 5min para processar contratos pendentes.

**Onde**: Arquivo de function + configuração de cron (DO ou GitHub Actions)

**Fluxo**: a cada 5min → verificar habilitado → horário válido → pegar 1 contrato `gerado` → orchestrator.trigger() → resultado

**Restrições**: máx 1 contrato/execução, respeitar horário, skip se desabilitado

**Tests**: Mock orchestrator + simulação de cron (execução, horário, skip)

**Feito quando**: Function executa a cada 5min, 1 contrato/vez, respeita horário, testes passam.

---

## Fase 6 — Validação

### T10: Testes E2E Completos

- **Req**: Todos
- **Status**: Pending
- **Esforço**: 2h | Paralelável: Não
- **Depende de**: T07, T08

**O quê**: Cenários E2E completos — config → trigger → status → download.

**Onde**: `tests/e2e/robot-docusign.test.js` (novo)

**Cenários**:
1. Configuração inicial (habilitar, credenciais, test-login)
2. Envio via Robot (badge, toast, envio OK)
3. Verificação de status (progresso, mudança de status)
4. Download de documento (PDF baixado, toast sucesso)
5. Fallback para API (robot desabilitado → fluxo normal)

**Tests**: Playwright headed/headless

**Feito quando**: Todos cenários passam, fluxo completo funciona, fallback OK.

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

## Riscos Identificados

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| DocuSign bloqueia automação (bot detection) | Alto | Delay randômico, user-agent realista, testar antes de investir |
| DO Functions não suporta Playwright (memória) | Alto | Verificar limites; alternativa: Docker container |
| Seletores UI mudam frequentemente | Médio | JSON separado facilita atualização; monitorar |
| Sessão expira rapidamente | Médio | Testar duração real; ajustar intervalo de re-login |
| Timeout DO Functions (30s) | Médio | Processar 1 contrato; monitoring de duração |
