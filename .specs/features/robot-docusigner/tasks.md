# Robot-DocuSigner — Tasks de Implementação

> **Arquitetura de 2 Componentes**: Este projeto possui o **Servidor Central** (`src/`) e o **Robô Standalone** (`robot-standalone/`). As tasks abaixo cobrem ambos — Fases 1-5 e 8 referem-se ao servidor; a sub-spec `build-executor/` cobre o standalone e seu pipeline de build.

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

### T09: DO Function + Cron

- **Req**: REQ-011
- **Status**: [x] Done (2026-08-11)
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

## Riscos Identificados

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| DocuSign bloqueia automação (bot detection) | Alto | Delay randômico, user-agent realista, testar antes de investir |
| DO Functions não suporta Playwright (memória) | Alto | Verificar limites; alternativa: Docker container |
| Seletores UI mudam frequentemente | Médio | JSON separado facilita atualização; monitorar |
| Sessão expira rapidamente | Médio | Testar duração real; ajustar intervalo de re-login |
| Timeout DO Functions (30s) | Médio | Processar 1 contrato; monitoring de duração |
| Gestor offline na inicialização do robô | Médio | Log claro e retry ou exit defensivo com indicação de causa |

