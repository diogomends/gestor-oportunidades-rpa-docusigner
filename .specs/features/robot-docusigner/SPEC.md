# Robot-DocuSigner — Especificação

## Problem Statement

A integração atual com DocuSign utiliza API oficial (JWT Grant), porém restrições internas da empresa impedem a finalização da integração API no curto prazo. O **Robot-DocuSigner** é uma alternativa via automação de navegador (Playwright) que executa as mesmas operações da API — envio de contratos, acompanhamento de status, download de PDFs assinados e extração de relatórios — acessando diretamente a UI web da DocuSign como um humano faria.

O robot opera como um serviço de contingência/bridge: enquanto a API não é ativado, o robot é o modo primário. Quando a API estiver disponível, o sistema permite alternar entre modos (Robot vs API) via toggle no config-sistema, sem alterar o fluxo do usuário.

## Visão Geral

| Aspecto | Decisão |
|---------|---------|
| Engine | Playwright (headless) — já presente no projeto |
| Autenticação | Credenciais (email/senha) armazenadas em SystemConfig + API Key (`X-Robot-Key`) |
| Execução | `robotScheduler` interno (intervalo configurável) + `POST /process-pending` + trigger manual |
| Storage sessão | MongoDB (1 documento sobrescrito por login, sem crescimento) |
| Seletores UI | JSON separado no módulo (`selectors/docusign-ui.json`) |
| Anti-detecção | Delay randômico entre ações |
| Status tracking | RobotJob model separado (não contamina Contract) |
| Contratos alvo | Status `gerado` **e elegível** — exige `documents[].originalUrl` não-vazio + e-mail do destinatário (`client.representante.email` \| `signer.email` \| `email` \| `clientEmail`) via `contractEligibility.js` |
| Modo de operação | Um contrato por execução |
| Retry | 3 tentativas, delay exponencial (2s → 4s → 8s) |
| Logs | Detalhado por passo com timestamp |
| Elegibilidade | Helper centralizado `utils/contractEligibility.js` (`GERADO_ELIGIBLE_FILTER`, `hasPdf`, `hasRecipientEmail`, `isEligibleForSend` com `trim()`) usado em `getNextJob`, `robotScheduler` e `job-runner` |

## Arquitetura de 2 Componentes

O projeto é dividido em **2 componentes independentes** no mesmo repositório:

| Componente | Diretório | Onde roda | Responsabilidade |
|------------|-----------|-----------|------------------|
| **Servidor Central** | `backend/src/` | Servidor de produção (porta 3111) | API REST, fila de jobs, autenticação JWT/API Key, monitoramento de instâncias, orquestração |
| **Robô** | `robot/` | Máquinas dos vendedores/agentes (`.exe`) | Polling autenticado, execução Playwright, download de PDFs, heartbeat |

```
┌─────────────────────────────────┐         ┌──────────────────────────────────┐
│   SERVIDOR CENTRAL (produção)   │         │       ROBÔ (.exe local)          │
│   backend/src/ → node server.js │         │   robot/ → .exe                  │
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

**Fluxo resumido:**
1. Servidor recebe job via API (`POST /api/robot-docusign/trigger`) ou scheduler automático (`POST /process-pending`).
2. Robô faz polling autenticado (`GET /instance/next-job` com lock atômico) e busca jobs pendentes.
3. Robô executa automação Playwright no DocuSign (login, envio, download).
4. Robô reporta progresso/status via heartbeat e `PATCH /instance/job/:jobId/status`.
5. Servidor atualiza status do job no MongoDB e notifica frontends via SSE (`GET /jobs/:jobId/stream`).

**Comunicação:** HTTP autenticada via JWT (emitido via `POST /instance/auth` com `X-Robot-Key`). O robô tem zero dependências de servidor — apenas Playwright.

## Requisitos Funcionais

### [REQ-001] Modelo RobotJob

- **Localização**: `src/modules/robot-docusign/models/RobotJob.js`
- **Database**: `crm_contracts` (via `getContractsConnection()`)
- **Campos**:
  - `contractId`: ObjectId (ref: Contract) — obrigatório
  - `status`: enum `["pending", "running", "success", "failed"]` — default `pending`
  - `mode`: enum `["robot", "api"]` — qual modo executou
  - `steps`: Array de `{ name, status, timestamp, duration, error }` — log por passo
  - `retryCount`: Number — default 0, máx 3
  - `lastError`: String — mensagem do último erro
  - `envelopeId`: String — ID do envelope na DocuSign (preenchido após sucesso)
  - `signedDocPath`: String — caminho do PDF assinado (preenchido após download)
  - `startedAt`: Date
  - `completedAt`: Date
- **Índices**: `{ contractId: 1, status: 1 }`, `{ createdAt: -1 }`
- **Criterios de Aceite**:
  1. WHEN um job é criado THEN o status SHALL ser `pending`
  2. WHEN a automação inicia THEN o status SHALL mudar para `running` e `startedAt` SHALL ser registrado
  3. WHEN um passo é executado THEN um item SHALL ser adicionado ao array `steps` com `name`, `status`, `timestamp` e `duration`
  4. WHEN a automação completa com sucesso THEN o status SHALL ser `success`, `completedAt` SHALL ser registrado e `envelopeId` SHALL ser preenchido
  5. WHEN a automação falha após 3 tentativas THEN o status SHALL ser `failed` e `lastError` SHALL conter a mensagem de erro

### [REQ-002] Extensão do SystemConfig

- **Key**: `robot_docusign`
- **Localização**: `src/modules/config-sistema/controllers/systemConfigController.js` (nova seção)
- **Estrutura do `value`**:
  ```js
  {
    enabled: false,                    // Toggle geral do robot
    operations: {
      send: true,                      // Enviar contratos
      statusCheck: true,               // Consultar status
      download: true,                  // Baixar PDFs assinados
      reports: true,                   // Extrair relatórios
      resend: true                     // Reenviar convites
    },
    credentials: {
      email: "",                       // Email DocuSign
      password: ""                     // Senha DocuSign (armazenar com criptografia)
    },
    schedule: {
      intervalMinutes: 5,             // Intervalo entre execuções
      startHour: "07:00",             // Horário início
      endHour: "19:00",               // Horário fim
      activeDays: [1, 2, 3, 4, 5]    // Dias da semana (0=dom, 1=seg...)
    },
    retry: {
      maxAttempts: 3,                 // Máximo de tentativas
      baseDelayMs: 2000              // Delay base para exponencial
    },
    antiDetection: {
      minDelayMs: 1000,              // Delay mínimo entre ações
      maxDelayMs: 3000               // Delay máximo entre ações
    }
  }
  ```
- **Validação Zod**: Todos os campos `optional()` com defaults
- **Endpoint**: `GET/PUT /api/system-config/robot-docusign`
- **Autorização**: `protect` + `authorize("admin")`
- **Criterios de Aceite**:
  1. WHEN admin acessa config-sistema THEN o card do robot SHALL exibir todos os campos configuráveis
  2. WHEN admin salva config THEN o valor SHALL ser persistido via upsert (padrão SystemConfig)
  3. WHEN `enabled` é `false` THEN o robot NÃO SHALL executar nenhuma automação
  4. WHEN horário atual está fora de `startHour`/`endHour` THEN o robot NÃO SHALL processar (exceto trigger manual)
  5. WHEN credenciais estão vazias THEN o sistema SHALL exibir aviso e bloquear ativação

### [REQ-003] Serviço de Sessão (robotSession.js)

- **Localização**: `src/modules/robot-docusign/services/robotSession.js`
- **Responsabilidade**: Gerenciar login, cookies e persistência de sessão
- **Fluxo**:
  1. Buscar sessão salva no MongoDB (`robot_sessions` collection)
  2. Se sessão existe e não expirou → reutilizar cookies no browser
  3. Se sessão expirou ou não existe → fazer login fresh via Playwright
  4. Após login → salvar cookies no MongoDB (sobrescrever documento anterior)
- **Collection MongoDB**: `robot_sessions` (database `crm_contracts`)
  - `{ _id, cookies: Mixed, localStorage: Mixed, expiresAt: Date, createdAt: Date }`
- **Criterios de Aceite**:
  1. WHEN sessão válida existe THEN o login SHALL ser pulado (economia de tempo)
  2. WHEN sessão expirou THEN o robot SHALL fazer login fresh automaticamente
  3. WHEN login falha THEN o robot SHALL retornar erro com mensagem descritiva
  4. WHEN sessão é salva THEN apenas 1 documento SHALL existir (sobrescrito)

### [REQ-004] Serviço de Automação (robotBrowser.js)

- **Localização**: `src/modules/robot-docusign/services/robotBrowser.js`
- **Responsabilidade**: Core da automação Playwright — todas as ações na UI DocuSign
- **Operações**:
  - `sendEnvelope(contract)`: Criar envelope, upload PDFs, preencher signatário, enviar
  - `checkStatus(envelopeId)`: Consultar status do envelope na UI
  - `downloadSigned(contractId, envelopeId)`: Baixar PDF assinado
  - `resendEnvelope(envelopeId)`: Reenviar convite de assinatura
  - `extractReports(filters)`: Extrair dados de relatórios da UI
- **Seletores**: Carregados de `selectors/docusign-ui.json` via `robotSelectors.js`
- **Anti-detecção**: Delay randômico entre cada ação (configurável via SystemConfig)
- **Criterios de Aceite**:
  1. WHEN `sendEnvelope` é chamado THEN o robot SHALL: navegar para "New Envelope" → upload 3 PDFs → preencher nome/email/CPF → posicionar SignHere → enviar
  2. WHEN upload de PDF falha THEN o robot SHALL retry até 3 vezes antes de reportar erro
  3. WHEN elemento UI não é encontradoTHEN o robot SHALL aguardar até `timeout` (10s) antes de falhar
  4. WHEN ação é executada THEN um delay randômico SHALL ser aplicado antes da próxima ação
  5. WHEN browser é fechado THEN todos os recursos Playwright SHALL ser liberados (finally block)

### [REQ-005] Orquestrador (robotOrchestrator.js)

- **Localização**: `src/modules/robot-docusign/services/robotOrchestrator.js`
- **Responsabilidade**: Decidir Robot vs API, orquestrar execução, gerenciar retry
- **Fluxo**:
  1. Verificar se robot está habilitado no SystemConfig
  2. Se habilitado → verificar horário (7h-19h) e dia da semana
  3. Buscar contratos com status `gerado` (pending)
  4. Criar RobotJob com status `pending`
  5. Executar operação (robotBrowser)
  6. Em caso de falha → retry com delay exponencial (até 3x)
  7. Atualizar RobotJob e Contract status
- **Criterios de Aceite**:
  1. WHEN robot está desabilitado THEN o orquestrador SHALL retornar `{ mode: "disabled" }`
  2. WHEN horário inválido e trigger manual THEN o orquestrador SHALL executar (ignorar horário)
  3. WHEN horário inválido e agendamento THEN o orquestrador SHALL pular execução
  4. WHEN contrato não tem PDFs gerados THEN o orquestrador SHALL marcar job como `failed` com erro descritivo
  5. WHEN retry é executado THEN o `retryCount` SHALL ser incrementado e `steps` SHALL registrar cada tentativa

### [REQ-006] Controller API

- **Localização**: `backend/src/modules/robot-docusign/controllers/robotDocusignController.js` + `robotInstanceController.js`
- **Endpoints** (`backend/src/modules/robot-docusign/routes.js` + `routes/robotInstanceRoutes.js`):

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/api/robot-docusign/trigger` | protect | Trigger manual para 1 contrato (body: `contractId`/`contract_id`) |
| `POST` | `/api/robot-docusign/trigger-batch` | protect + admin | Trigger para múltiplos (body: `{ contractIds: [] }`) |
| `GET` | `/api/robot-docusign/status/:jobId` | protect | Status de uma execução (busca por _id ou contract_id) |
| `GET` | `/api/robot-docusign/jobs` | protect | Lista de jobs (query: `?status=&page=&limit=`) |
| `GET` | `/api/robot-docusign/jobs/:jobId/stream` | protect | SSE stream de progresso do job |
| `GET` | `/api/robot-docusign/metrics` | protect | Métricas agregadas (enviados/dia, taxa sucesso, erros) |
| `GET` | `/api/robot-docusign/logs/:jobId` | protect | Logs detalhados de um job |
| `GET` | `/api/robot-docusign/config` | protect | Buscar config do robot |
| `PUT` | `/api/robot-docusign/config` | protect + admin | Atualizar config do robot |
| `POST` | `/api/robot-docusign/test-login` | protect + admin | Testar credenciais na DocuSign (aceita `otpCode` opcional) |
| `GET` | `/api/robot-docusign/queue` | protect | Fila de contratos pendentes |
| `POST` | `/api/robot-docusign/process-pending` | protect | Processa até 1 contrato pendente (scheduler manual) |
| `GET` | `/api/robot-docusign/instances` | protect + admin | Lista instâncias do robô (fleet monitoring) |
| `POST` | `/api/robot-docusign/instance/auth` | público | Auth da instância (`X-Robot-Key` ou email/senha) |
| `GET` | `/api/robot-docusign/instance/instances` | protect + admin | Lista instâncias (via sub-router, alias) |
| `GET` | `/api/robot-docusign/instance/config` | protect | Config da instância |
| `GET` | `/api/robot-docusign/instance/next-job` | protect | Próximo job pendente (polling do robô) |
| `PATCH` | `/api/robot-docusign/instance/job/:jobId/status` | protect | Atualiza status do job |
| `POST` | `/api/robot-docusign/instance/heartbeat` | protect | Heartbeat da instância |
| `GET` | `/api/robot-docusign/instance/contracts/:contractId/pdf` | protect | Download de PDF do contrato |
| `GET` | `/health` | público | Health check (fora do prefixo, `backend/src/app.js:15`) |

- **Criterios de Aceite**:
  1. WHEN `trigger/:contractId` é chamado THEN um RobotJob SHALL ser criado e a execução SHALL iniciar
  2. WHEN `trigger-batch` é chamado THEN cada contrato SHALL gerar um RobotJob independente
  3. WHEN `metrics` é chamado THEN o sistema SHALL retornar: total enviados hoje, taxa sucesso %, top erros
  4. WHEN `test-login` é chamado THEN o sistema SHALL tentar logar e retornar success/failure
  5. WHEN autenticação falha THEN todos os endpoints SHALL retornar HTTP 401/403

### [REQ-007] Rotas

- **Localização**: `backend/src/modules/robot-docusign/routes.js` + `backend/src/modules/robot-docusign/routes/robotInstanceRoutes.js`
- **Montagem**: `app.use("/api/robot-docusign", robotDocusignModule.routes)` em `backend/src/app.js` + `app.get("/health")` na raiz
- **Criterios de Aceite**:
  1. WHEN o módulo é carregado THEN todas as rotas SHALL estar disponíveis em `/api/robot-docusign/*`
  2. WHEN proteção está ativa THEN todas as rotas SHALL requerer token JWT válido

### [REQ-008] Seletores UI

- **Localização**: `src/modules/robot-docusign/selectors/docusign-ui.json`
- **Formato**: JSON com seções para cada área da UI
  ```json
  {
    "login": { "email": "...", "password": "...", "submitButton": "..." },
    "envelope": { "newButton": "...", "uploadArea": "...", "recipientName": "...", "sendButton": "..." },
    "status": { "envelopeList": "...", "statusBadge": "..." },
    "download": { "downloadButton": "...", "menuActions": "..." }
  }
  ```
- **Service**: `robotSelectors.js` carrega o JSON e expõe seletores; fallback para defaults hardcoded
- **Criterios de Aceite**:
  1. WHEN o JSON é atualizado THEN as mudanças SHALL refletir sem redeploy
  2. WHEN um seletor não é encontrado no JSON THEN o sistema SHALL usar o fallback default
  3. WHEN a UI da DocuSign muda THEN apenas o JSON precisa ser atualizado

### [REQ-009] Integração Frontend — Step 6

- **Arquivos modificados**:
  - `public/modules/contratos/contratos.html` — indicador de modo no step 6
  - `public/modules/contratos/contratos.js` — lógica toggle Robot/API
  - `public/modules/contratos/services/docusignService.js` — chamar robot ao invés de API quando toggle ativo
- **Comportamento**:
  - Badge indicador no step 6: "🤖 Robot Ativo" (verde) / "🔗 API Ativa" (azul) / "⏳ Processando..." (amarelo)
  - Botão "ENVIAR PARA ASSINATURA" → `robotOrchestrator.decide()` → chama Robot ou API conforme toggle
  - Toast de notificação em tempo real do status da automação
- **Criterios de Aceite**:
  1. WHEN robot está habilitado THEN o badge SHALL exibir "Robot Ativo" e o botão SHALL acionar o robot
  2. WHEN robot está desabilitado THEN o badge SHALL exibir "API Ativa" e o botão SHALL chamar a API
  3. WHEN robot está processando THEN o botão SHALL ficar disabled com texto "Processando..."
  4. WHEN processamento completa THEN um toast SHALL exibir success/failure

### [REQ-010] Integração Frontend — Config-Sistema

- **Arquivo**: `public/modules/config-sistema/config-sistema.html` (novo card)
- **Conteúdo do card**:
  - Toggle geral: Robot Ligado/Desligado
  - Seção de operações: toggles individuais (envio, status, download, relatórios, reenvio)
  - Credenciais: campos email/senha (obscured)
  - Agendamento: intervalo (valores numéricos "5", "10", "15", "30" minutos), horário início/fim, dias da semana
  - Retry: máx tentativas, delay base
  - Anti-detecção: delay mínimo/máximo
  - Log de execuções: últimas 50 com status
  - Métricas: contratos enviados hoje, taxa sucesso, último erro
- **Criterios de Aceite**:
  1. WHEN admin acessa config-sistema THEN o card do robot SHALL exibir todas as configurações
  2. WHEN admin altera qualquer campo (toggle, select ou input) THEN a config SHALL ser salva imediatamente (auto-save exclusivo, sem botão manual de salvar)
  3. WHEN credenciais são salvas THEN elas SHALL ser criptografadas antes de persistir
  4. WHEN robot está em execução THEN o toggle geral SHALL ficar disabled

### [REQ-011] Agendamento (Scheduler Interno)

- **Implementação**: `backend/src/modules/robot-docusign/services/robotScheduler.js` (`start()`/`stop()` + `processPendingJobs()`) iniciado em `backend/src/server.js` via `robotScheduler.start()`. Rota manual `POST /api/robot-docusign/process-pending` exposta para trigger externo/cron. Não consulta `Contract`; apenas consome `RobotJob` (`pending`/`retrying`).
- **Fluxo**:
  1. Scheduler interno verifica config `robot_docusign.enabled` no SystemConfig
  2. Verifica horário e dia da semana (`isTimeAccessAllowed`) e concorrência (`max_concurrent`)
  3. Se válido → busca próximo `RobotJob` pendente/`retrying` FIFO; se nenhum, retorna idle
  4. Processa 1 job via `robotOrchestrator.trigger(contractId, action, {jobId})`
  5. Retorna resultado (success/failure + jobId)
- **Criterios de Aceite**:
  1. WHEN cron aciona function THEN a function SHALL processar no máximo 1 `RobotJob`
  2. WHEN nenhum job pendente THEN a function SHALL retornar `{ processed: 0 }`
  3. WHEN robot está desabilitado THEN a function SHALL retornar `{ disabled: true }`
  4. WHEN `RobotJob` aponta para contrato sem PDF ou e-mail THEN `getNextJob`/`job-runner` SHALL marcar `failed` (`contract_missing_pdf_or_email`) e reverter `em_processamento_robot`→status original

### [REQ-012] Download de PDFs Assinados

- **Fluxo**: Quando robot detecta status `completed` para um envelope
  1. Navegar na UI DocuSign para o envelope
  2. Clicar em "Download" → "Combined Document"
  3. Salvar PDF em `uploads/{cnpj}_{razao}/contrato_assinado_{envelopeId}.pdf`
  4. Atualizar `RobotJob.signedDocPath` e `Contract.status` → `assinado`
- **Criterios de Aceite**:
  1. WHEN download completa THEN o PDF SHALL ser salvo na pasta do contrato
  2. WHEN PDF já existe THEN o robot SHALL sobrescrever (versão mais recente)
  3. WHEN download falha THEN o robot SHALL retry (parte do fluxo normal de retry)

## Estrutura de Arquivos

```
backend/src/modules/robot-docusign/
├── index.js                              # Barrel export
├── routes.js                             # Rotas Express (prefixo /api/robot-docusign)
├── routes/
│   └── robotInstanceRoutes.js            # Sub-rotas /instance (auth, next-job, heartbeat, pdf)
├── models/
│   ├── RobotJob.js                       # Schema RobotJob
│   ├── RobotSession.js                   # Sessão persistida
│   └── RobotInstance.js                  # Instâncias do robô (fleet)
├── services/
│   ├── robotOrchestrator.js              # Orquestrador principal
│   ├── robotBrowser.js                   # Core Playwright (automação)
│   ├── robotSession.js                   # Gerenciamento de sessão
│   ├── robotSelectors.js                 # Loader de seletores JSON
│   └── robotScheduler.js                 # Scheduler interno (start/stop/processPendingJobs)
├── selectors/
│   └── docusign-ui.json                  # Seletores CSS/XPath da UI DocuSign
└── controllers/
    ├── robotDocusignController.js        # Endpoints principais
    └── robotInstanceController.js        # Endpoints de instância (auth, heartbeat, pdf)

robot/
├── src/
│   ├── main.js, config.js, api-client.js, job-runner.js, scheduler.js
│   └── browser/ (docusign.js, selectors.js, roundcube.js, imapClient.js)
├── build/build.js                        # Pipeline: esbuild → obfuscator → bytenode → pkg
└── scripts/setup.bat                     # Instalador Windows
```

## Restrições & Preservação (Impact Protector)

### Modulos Legados Preservados (INTOCÁVEIS)

| Modulo | Caminho | Motivo |
|--------|---------|--------|
| contract | `src/modules/contract/` | CRUD de contratos — sem alteração |
| docusign (API) | `src/modules/docusign/` | Integração API existente — mantida como fallback |
| gerador-pdf-html | `src/modules/gerador-pdf-html/` | Geração de PDF — sem alteração |
| client-docs | `src/modules/client-docs/` | Portal de docs do cliente — sem alteração |
| config-sistema | `src/modules/config-sistema/` | Apenas extensão (nova key `robot_docusign`) |

### Frontend Preservado

| Arquivo | O que NÃO muda |
|---------|----------------|
| `contratos.html` | Step 6 existente preservado — apenas ADICIONA badge e adjust no botão |
| `contratos.js` | Funções existentes mantidas — apenas ADICIONA lógica de decisão Robot/API |
| `docusignService.js` | Métodos existentes mantidos — apenas ADICIONA wrapper para robot |
| `config-sistema.html` | Cards existentes preservados — apenas ADICIONA novo card |

### API Preservada

| Endpoint | Status |
|----------|--------|
| `POST /api/docusign/send/:contractId` | Mantido (chamado quando modo API) |
| `GET /api/docusign/status/:contractId` | Mantido |
| `POST /api/docusign/webhook` | Mantido |
| Todos os endpoints docusign existentes | Mantidos |

## Assumptions & Open Questions

| Assunção / Decisão | Default Escolhido | Justificativa | Confirmado? |
|--------------------|--------------------|---------------|-------------|
| Playwright já está instalado no projeto | Sim | Usado pelo gerador-pdf-html | ✅ |
| MongoDB pode armazenar sessões | Sim | 1 doc sobrescrito, sem crescimento | ✅ |
| DO Functions suporta Playwright headless | Verificar | Limites de memória/tempo em serverless | ❓ |
| DocuSign não bloqueia automação | Verificar | Risk: detecção de bot | ❓ |
| PDFs estão em formato acessível para upload | Sim | São gerados pelo Playwright, SVG/PDF | ✅ |
| SystemConfig aceita nova key `robot_docusign` | Sim | Padrão key-value genérico | ✅ |
| Um contrato por execução é suficiente | Sim | Evita sobrecarga e facilita debug | ✅ |

## Edge Cases

- WHEN DocuSign muda a UI (novo layout/seletores) THEN o robot SHALL falhar graciosamente e logar erro descritivo; correção = atualizar `docusign-ui.json`
- WHEN sessão expira no meio de uma execução THEN o robot SHALL tentar relogar uma vez antes de falhar
- WHEN contract `gerado` não tem PDF (`documents[].originalUrl` vazio) ou não tem e-mail do destinatário THEN SHALL ser ignorado em `getNextJob`/`robotScheduler` (sem criar job, status permanece `gerado`); jobs legados `pending` sem elegibilidade SHALL ser marcados `failed` com `reason:"contract_missing_pdf_or_email"` e contrato revertido `em_processamento_robot`→`gerado`; `job-runner` SHALL rejeitar antes de `chromium.launch` com erro `"Contrato sem documento PDF anexado ou sem e-mail do destinatário."`
- WHEN timeout do Playwright (30s padrão) THEN o robot SHALL retry com tentativa incremental
- WHEN múltiplos jobs estão running para o mesmo contract THEN o sistema SHALL bloquear (job duplicado)
- WHEN DO Functions atinge timeout (30s default) THEN a execução SHALL ser retomada ou o job SHALL ser marcado como failed
- WHEN credenciais DocuSign estão incorretas THEN `test-login` SHALL retornar erro claro e robot SHALL não executar
- WHEN `documents.originalUrl` ou e-mail contém apenas whitespace THEN SHALL ser tratado como ausente via `trim()` em `hasValue`

## Requirement Traceability

| Req ID | User Story | Fase | Status |
|--------|-----------|------|--------|
| REQ-001 | US-001 | 1 - Model | Done |
| REQ-002 | US-002 | 2 - Config | Done |
| REQ-003 | US-003 | 3 - Session | Done |
| REQ-004 | US-004 | 4 - Browser Core | Done |
| REQ-005 | US-005 | 5 - Orchestrator | Done |
| REQ-006 | US-006 | 6 - Controller | Done |
| REQ-007 | US-006 | 6 - Routes | Done |
| REQ-008 | US-007 | 3 - Selectors | Done |
| REQ-009 | US-008 | 7 - Frontend Step6 | Done |
| REQ-010 | US-009 | 8 - Frontend Config | Done |
| REQ-011 | US-010 | 9 - Scheduling | Done |
| REQ-012 | US-004 | 4 - Download | Done |
| REQ-ROBOT-KEY-01 | US-011 | 8 - Service Account Auth | Done |
| REQ-ROBOT-KEY-02 | US-011 | 8 - Contracts HTTP Client | Done |
| REQ-ROBOT-KEY-03 | US-011 | 8 - Bootstrap Guard | Done |
| REQ-MFA-IMAP-01 | US-012 | 11 - Headless IMAP MFA | Done |
| REQ-MFA-IMAP-02 | US-012 | 11 - Fallback & Resilient Polling | Done |
| REQ-MFA-IMAP-03 | US-012 | 11 - Bytecode & Build Compatibility | Done |
| REQ-ELIG-01 | US-013 | 17 - Elegibilidade PDF+E-mail (3 camadas) | Done |
| REQ-ELIG-02 | US-014 | 18 - Elegibilidade Todos exceto Rascunho | Pending |
| REQ-SCHED-01 | US-015 | 19 - Trava de Concorrência (isRunning/Mutex) no Scheduler | Done |

## Variações da Implementação & Notas Técnicas

- **Trigger de Contrato**: O endpoint `POST /api/robot-docusign/trigger` recebe `contractId` / `contract_id` no body da requisição.
- **Trigger em Lote**: Adicionado `POST /api/robot-docusign/trigger-batch` (Zod `{ contractIds: z.array(z.string()).min(1) }`) que executa os disparos sequencialmente.
- **Painel de Interface**: Tela/painel dedicada construída no frontend para acompanhamento de jobs, métricas e configurações do Robô DocuSign.
- **Agendamento (Scheduler)**: Processamento via `POST /api/robot-docusign/process-pending` e `robotScheduler.start()` (30s) consome **apenas** `RobotJob` existente (`pending`/`retrying` FIFO). Criação de job é 100% sob demanda via `POST /trigger` (botão Enviar). Não há busca automática de `Contract`.
- **Elegibilidade de Contratos**: Módulo `utils/contractEligibility.js` centraliza `GERADO_ELIGIBLE_FILTER` (Mongo), `hasPdf`, `hasRecipientEmail` e `isEligibleForSend` (com `trim()`); usado em `GET /instance/next-job` (pós-validação com revert `em_processamento_robot`→status original) e `robot/job-runner.js` (validação pré-browser). `robotScheduler` não consulta `Contract`.
- **Criptografia de Credenciais**: Senhas de acesso à DocuSign são criptografadas com `encryptText` (AES-256-CBC) nos endpoints de gravação e decifradas na leitura com `decryptText`.
- **Status do Contrato e Download do PDF**: No envio bem-sucedido, altera `Contract.status = "enviado"`; no download bem-sucedido, altera `Contract.status = "assinado"` e salva o arquivo em `uploads/{cnpj}_{razao}/contrato_assinado_{envelopeId}.pdf`, definindo `job.signedDocPath`.

## User Stories

### US-001: RobotJob Model

**User Story**: Como sistema, quero rastrear cada execução do robot com status, logs e timestamps, para que eu saiba o que aconteceu com cada contrato.

**Acceptance Criteria**:
1. WHEN um job é criado THEN SHALL ter status `pending`
2. WHEN execução inicia THEN SHALL mudar para `running`
3. WHEN passo é executado THEN SHALL registrar no array `steps`
4. WHEN completa THEN SHALL ter status `success` ou `failed`

---

### US-002: Configuração do Robot

**User Story**: Como admin, quero configurar o robot no config-sistema (credenciais, horários, operações), para que eu possa controlar o comportamento sem deploy.

**Acceptance Criteria**:
1. WHEN acesso config-sistema THEN vejo card do robot
2. WHEN alterno toggle THEN config é salva
3. WHEN salvo credenciais THEN são criptografadas
4. WHEN robot está rodando THEN toggle fica disabled

---

### US-003: Sessão Persistente

**User Story**: Como robot, quero reutilizar sessões salvas no MongoDB, para que eu não precise logar a cada execução.

**Acceptance Criteria**:
1. WHEN sessão válida existe THEN pulo login
2. WHEN expirou THEN reloga
3. WHEN login falha THEN reporto erro

---

### US-004: Envio de Contratos via UI

**User Story**: Como robot, quero criar envelopes na UI DocuSign, fazer upload dos PDFs e enviar para assinatura, para que contratos sejam processados sem a API.

**Acceptance Criteria**:
1. WHEN envio é acionado THEN crio envelope → upload → preencho → envio
2. WHEN upload falha THEN retry 3x
3. WHEN elemento não encontrado THEN aguardo 10s antes de falher
4. WHEN completo THEN registr envelopeId e atualizo status

---

### US-005: Orquestração e Retry

**User Story**: Como orquestrador, quero decidir Robot vs API e gerenciar retry com delay exponencial, para que falhas sejam tratadas automaticamente.

**Acceptance Criteria**:
1. WHEN robot desabilitado THEN retorno `disabled`
2. WHEN horário inválido e agendamento THEN pulo
3. WHEN retry THEN incremento retryCount com delay 2s→4s→8s

---

### US-006: API Endpoints

**User Story**: Como frontend, quero endpoints para trigger manual, status, logs, config e métricas, para que eu possa gerenciar o robot via UI.

**Acceptance Criteria**:
1. WHEN chamo trigger THEN job é criado e execução inicia
2. WHEN chamo metrics THEN recebo agregados
3. WHEN autenticação falha THEN retorno 401/403

---

### US-007: Seletores UI

**User Story**: Como maintainer, quero seletores em JSON separado, para que eu possa atualizar quando a UI DocuSign mudar sem fazer deploy.

**Acceptance Criteria**:
1. WHEN JSON é atualizado THEN reflete sem redeploy
2. WHEN seletor não existe THEN uso fallback default

---

### US-008: Integração Step 6

**User Story**: Como usuário, quero ver no step 6 se o modo é Robot ou API, e que o botão "Enviar" funcione conforme o modo configurado.

**Acceptance Criteria**:
1. WHEN robot ativo THEN badge verde "Robot Ativo"
2. WHEN API ativa THEN badge azul "API Ativa"
3. WHEN processando THEN botão disabled com "Processando..."
4. WHEN completo THEN toast success/failure

---

### US-009: Config-Sistema Card

**User Story**: como admin, quero um painel completo no config-sistema para gerenciar todas as configurações do robot.

**Acceptance Criteria**:
1. WHEN acesso card THEN vejo toggles, credenciais, agendamento, retry, logs
2. WHEN salvo THEN persiste via SystemConfig
3. WHEN robot executando THEN config fica read-only

---

---

### US-011: Integração com Gestor de Oportunidades via Service Account (API Key)

**User Story**: Como serviço robô, quero me autenticar no Gestor de Oportunidades usando uma chave de API (`x-robot-key`) e consumir contratos de toda a organização com o perfil herdado do solicitante.

**Acceptance Criteria**:
1. WHEN serviço inicia THEN valida a chave via `POST /api/internal/robot-keys/validate` com header `x-robot-key`
2. WHEN chave é válida THEN obtém perfil e inicia rotinas de orquestração
3. WHEN chave é inválida/revogada THEN encerra processo com log de advertência
4. WHEN consulta contratos pendentes THEN envia header `x-robot-key` em `GET /api/contracts` obtendo bypass de equipe com escopo do solicitante
5. WHEN processamento finaliza THEN atualiza contrato via `PUT /api/contracts/:id` com header `x-robot-key`

---

### US-012: Extração Headless de MFA via Protocolo IMAP

**User Story**: Como robô RPA, quero consultar a caixa de e-mails via conexão IMAP/TLS direta, para obter o código de verificação MFA da DocuSign em ~1s sem abrir abas adicionais de navegador.

**Acceptance Criteria**:
1. WHEN a tela MFA for detectada no DocuSign THEN o robô conecta no servidor IMAP configurado (`host`, `port`, `tls`, `email`, `password`)
2. WHEN o e-mail de segurança for localizado no INBOX THEN extrai o código de 6 dígitos via regex e encerra a conexão IMAP
3. WHEN o código for retornado THEN preenche o input MFA e avança o login no Playwright
4. WHEN o servidor IMAP falhar THEN registra log defensivo e aplica fallback controlado

---

### US-013: Filtro de Elegibilidade de Contratos (PDF + E-mail)

**User Story**: Como sistema, quero que apenas contratos `gerado` com PDF anexado e e-mail do destinatário entrem na fila do robô, para que jobs legados sem documento não consumam lock/browser e permaneçam `gerado` até o PDF ser gerado.

**Acceptance Criteria**:
1. WHEN contrato `gerado` não tem `documents[].originalUrl` não-vazio THEN SHALL ser ignorado por `GET /instance/next-job` e `robotScheduler` (sem criar job)
2. WHEN contrato `gerado` não tem e-mail em `client.representante.email`/`signer.email`/`email`/`clientEmail` THEN SHALL ser ignorado (mesma regra; `trim()` trata whitespace)
3. WHEN job legado `pending`/`retrying` aponta para contrato inelegível e `GET /next-job` o pega THEN SHALL marcar job `failed` com `contract_missing_pdf_or_email` e reverter `Contract` `em_processamento_robot`→`gerado`
4. WHEN `robotScheduler` recebe contrato da API `gestorApiClient` sem elegibilidade THEN SHALL descartar em memória e cair no fallback Mongoose filtrado
5. WHEN `job-runner` recebe `action:"send"` sem `pdfUrl` ou sem `recipientEmail` THEN SHALL lançar erro antes de `chromium.launch` com mensagem padronizada
6. WHEN validação Mongo usa `$ne:""` THEN whitespace SHALL ser coberto por `hasValue(trim)` em memória (`contractEligibility.js`)

---

### US-014: Critérios de Busca de Contratos Elegíveis — Todos exceto Rascunho

**User Story**: Como sistema e operador, quero que o robô busque todos os contratos com status diferente de `"rascunho"` que possuam PDF anexado e e-mail de destinatário válido, permitindo processar contratos em etapas posteriores à criação que estejam aptos para assinatura eletrônica.

**Acceptance Criteria**:
1. WHEN o robô ou scheduler busca contratos elegíveis THEN SHALL consultar contratos onde `status: { $ne: "rascunho" }`.
2. WHEN contrato satisfaz simultaneamente: (a) `status !== "rascunho"`, (b) `documents.originalUrl` presente e não-vazio, e (c) e-mail de destinatário presente (`client.representante.email` | `signer.email` | `email` | `clientEmail`) THEN SHALL ser considerado elegível para processamento.
3. WHEN contrato possui `status: "rascunho"` THEN NÃO SHALL ser capturado pela busca automática.
4. WHEN contrato possui status diferente de rascunho mas não possui PDF ou e-mail válido THEN NÃO SHALL ser processado e SHALL permanecer em seu status sem gerar travamento.

---

### US-015: Trava de Concorrência Atômica no Scheduler de Status (AD-045)

**User Story**: Como sistema e operador, quero que o scheduler de consulta geral de status (`statusSyncScheduler.js`) e a rota `POST /api/robot-docusign/sync-status` possuam uma trava de concorrência atômica (`isRunning`), garantindo que apenas uma instância de varredura do Playwright execute por vez, prevenindo sobreposição de navegadores, expiração de cookies no DocuSign e race conditions no banco de dados.

**Acceptance Criteria**:
1. WHEN uma rodada de `syncAllContractsStatus` é acionada enquanto outra já está em andamento (`isRunning === true`) THEN SHALL abortar imediatamente e retornar `{ success: true, checked: 0, updated: 0, downloaded: 0, status: "busy", reason: "already_running" }`.
2. WHEN `syncAllContractsStatus` finaliza por conclusão, retorno antecipado ou exceção de erro THEN SHALL obrigatoriamente executar `isRunning = false` no bloco `finally`.
3. WHEN consumidores ou rotas necessitarem consultar o estado da trava THEN SHALL utilizar a função exportada `isStatusSyncRunning()`.
4. WHEN testes de regressão são executados THEN SHALL validar o bloqueio de concorrência, a liberação sob falhas e a integridade das rotas HTTP.

## Success Criteria

- [x] Robot consegue fazer login na DocuSign via Playwright headless
- [x] Robot cria envelope, upload de 3 PDFs e envia para assinatura
- [x] Robot consulta status e atualiza Contract
- [x] Robot baixa PDF assinado e salva no servidor
- [x] Toggle Robot/API funciona no step 6
- [x] Config-sistema permite gerenciar todas as configurações
- [x] Retry com delay exponencial funciona (3 tentativas)
- [x] Logs detalhados por passo são registrados
- [x] Agendamento automático funciona (5min, 7h-19h)
- [x] Trigger manual funciona para qualquer contrato com status `gerado`
- [x] Autenticação e consumo via Service Account com `x-robot-key` funcional e validada no bootstrap


