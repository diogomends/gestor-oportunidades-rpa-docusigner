# Feature Specification: Segregação de Dois Robôs (Consulta e Atualização)

## Problem Statement

Atualmente, o robô RPA DocuSigner opera com um único executável genérico que concorre pelo consumo de todas as tarefas da fila (envio de envelopes, download de PDFs, verificação individual e consulta periódica de acordos). Para otimizar a escalabilidade, mitigar bloqueios de sessão na interface web do DocuSign e permitir a distribuição dedicada de tarefas em máquinas ou processos distintos, o sistema deve segregar a operação em dois robôs especializados:
1. **Robô de Consulta (Query):** Dedicado à varredura paginada na DocuSign (`view=agreements`), extração de status de recebedores e conciliação periódica.
2. **Robô de Atualização/Envio (Update):** Dedicado ao fluxo transacional de envio sob demanda, upload de PDFs, preenchimento de campos e submissão de envelopes.

## Out of Scope

- Alteração das regras de negócio de elegibilidade de contratos (`contractEligibility.js`).
- Modificação na infraestrutura de resolução de MFA por IMAP/Roundcube (`imapClient.js` / `roundcube.js`).
- Alteração nos schemas de contratos (`Contract.js`) ou banco de dados externo do CRM.

## Assumptions & Open Questions

| Assumption / Decision | Chosen default | Rationale |
| :--- | :--- | :--- |
| Identificação do papel da instância | Atributo `role: "query" \| "update" \| "all"` no handshake (`POST /instance/auth` + `POST /instance/heartbeat`) persistido em `RobotInstance.role`; `role` não colide com `JWT.role` (cargo do usuário). `X-Robot-Key` bypassa Zod — `authenticateInstance` lê `role` de `req.body.role` direto, não do schema; Zod valida apenas fallback `email/senha` | Permite roteamento transparente no backend sem quebrar instâncias existentes (default `"all"`). |
| Isolamento de sessão local | Arquivos de sessão separados (`session-query.json` e `session-update.json`); segregação futura em `robot_sessions` por `role` quando mesmo `email` for compartilhado é **out-of-scope** desta feature (future) | Evita corrupção de cookies e storageState caso ambos os robôs rodem na mesma máquina. |
| Distribuição dos executáveis | Pastas separadas por papel e por chave: `dist/robot-query-<N>/` e `dist/robot-update-<N>/` (compatível com multi-chave `ROBOT_API_KEY_N` existente); `dist/robot-docusigner-N/` legado mantido como alias durante migração | Facilita deploy e manutenção independente dos pacotes de execução; evita colisão com `dist/robot-docusigner-N/`. |
| Compatibilidade retroativa | Instâncias sem `role` assumem `"all"` e recebem qualquer job disponível; `role` inválido → `400 { error: "role inválido" }` | Garante operação ininterrupta durante migração gradual dos executáveis. |
| Mapeamento de actions por papel | `query` = leitura (`query_agreements`, `status`, `reports`, `download`); `update` = escrita transacional (`send`, `resend`); `all` = qualquer | `download` co-localizado com `query` evita handoff de 1 job extra por contrato assinado; `resend` é escrita e pertence a `update`. Evita starvation de `download`/`resend`/`reports`. |
| Schedulers existentes | `statusSyncScheduler` enfileira `RobotJob(action: "query_agreements")` quando `mode="robot"` **e** houver `RobotInstance` com `role in ["query","all"]` e `last_heartbeat > now-60s`; fallback para `executeWithBrowser` se nenhum query robot conectado; idempotência: skip se já existe `query_agreements` com `status in ["pending","processing"]`; intervalo padrão `5` min (`orchestratorConfig` + scheduler fallback `5`, unificado — AD-052) | Preserva conciliação automática sem duplicação ou ociosidade do robô de consulta. |
| Índice de fila | `{ status: 1, action: 1, lock_expires_at: 1, createdAt: 1 }` cobrindo `findOneAndUpdate` de `getNextJob` com filtro por `action` + lock | Evita COLLSCAN após introdução do filtro por `role`. |

Open questions: none (todas as decisões foram estabelecidas com valores padrão seguros). Critério "robô externo conectado" definido acima (heartbeat 60s).

## User Stories

### US-01: Roteamento e Conciliação Especializada no Backend
As an API orchestrator  
I want to deliver jobs filtered by the connecting robot's role and reconcile batch agreement query results  
So that query robots receive agreement scans, update robots receive envelope transmissions, and database contracts are automatically synchronized upon scan completion.

#### Acceptance Criteria
- **AC-01.1**: When a robot instance requests `/api/robot-docusign/instance/next-job` with `role="query"`, the system SHALL return only pending jobs where action is in `["query_agreements", "status", "reports", "download"]` (read/download path).
- **AC-01.2**: When a robot instance requests `/api/robot-docusign/instance/next-job` with `role="update"`, the system SHALL return only pending jobs where action is in `["send", "resend"]` (transactional write path).
- **AC-01.3**: When a robot instance requests without specifying role (or `role="all"`), the system SHALL maintain legacy behavior and return the first available pending job of any action.
- **AC-01.4**: When storing instances in `RobotInstance`, the system SHALL persist the `role` (`enum ["query","update","all"]`, default `"all"`, indexed) and expose it in instance metrics (`GET /instances`, `GET /queue`, `GET /metrics`) com métricas agregadas por `role` (`instances_by_role: { query, update, all, total }`); `role` inválido SHALL return `400`.
- **AC-01.5**: `RobotJob` actions `download`/`resend`/`reports`/`query_agreements` SHALL be explicitly routed (no orphan): `download`+`reports`+`query_agreements`+`status` → `query`, `send`+`resend` → `update`; `robotScheduler` SHALL ignore `query_agreements` (não consome fila de leitura).
- **AC-01.6**: `RobotJob` schema SHALL accept `query_agreements` and make `contract_id` / `contractId` conditionally required via `required: function() { return !["query_agreements","reports"].includes(this.action) }` (não `required:false` simples); Zod schemas (`triggerSchema`, `triggerBatchSchema`) SHALL accept `query_agreements` and make `contractId` opcional apenas para `query_agreements`/`reports` (ex: `if (!targetContractId && !["reports","query_agreements"].includes(action)) 400`).
- **AC-01.7**: When a `query_agreements` job is completed via `PATCH /instance/job/:jobId/status` with `result.envelopes`, the backend SHALL execute the batch reconciliation logic (`syncContractStatus` and auto-download of signed PDFs) for all active contracts; `result.envelopes` SHALL be validado via Zod (`array` de envelopes) e `robotScheduler` não reprocessa o mesmo batch.
- **AC-01.8**: When `statusSyncScheduler` triggers periodically and `mode="robot"`, the scheduler SHALL create/enqueue a `RobotJob` with `action: "query_agreements"` (sem `contract_id`) if no pending/processing query job already exists (`RobotJob.exists({action:"query_agreements", status:{$in:["pending","processing"]}})`) **e** houver query robot conectado (`last_heartbeat > now-60s`); caso contrário SHALL fallback para `executeWithBrowser("query_agreements")`; intervalo padrão `5` min.

### US-02: Especialização dos Executáveis Standalone
As a DevOps engineer / Agent operator  
I want to run dedicated robot executables for query and update  
So that workload is isolated and resource consumption is optimized per process.

#### Acceptance Criteria
- **AC-02.1**: When starting the robot with `--role=query` or `ROBOT_ROLE=query`, the system SHALL load query-specific routines (`status`/`query_agreements`/`reports`/`download`) and use `session-query.json` for storageState.
- **AC-02.2**: When starting the robot with `--role=update` or `ROBOT_ROLE=update`, the system SHALL load send-specific routines (`send`/`resend`) and use `session-update.json` for storageState.
- **AC-02.3**: When building binaries via build pipeline, the build script SHALL support targets `build:robot:query`, `build:robot:update` and `build:robot:all`, generating isolated bundles em `dist/robot-query-<N>/` e `dist/robot-update-<N>/` (matriz `ROBOT_API_KEY_N × role`, ex: `robot-query-1`, `robot-update-1`) com scripts `run.bat` e `setup.bat` com títulos de janela específicos por papel.

## Requirement Traceability

| Requirement ID | Description | Status |
| :--- | :--- | :--- |
| ROB2-01 | Modelagem do campo `role` em `RobotInstance` (`query|update|all`, default `all`, índice) + extensão de `action` em `RobotJob` para `query_agreements` e `contract_id` condicionalmente opcional (`required: function`) + índice `{status:1,action:1,lock_expires_at:1,createdAt:1}` | Implemented |
| ROB2-02 | Filtro por `role` no endpoint `/instance/next-job` em `robotInstanceController.js` com mapeamento `query=[status,query_agreements,reports,download]` / `update=[send,resend]` e fallback `all`; `robotScheduler` ignora `query_agreements` | Implemented |
| ROB2-03 | Suporte a `ROBOT_ROLE` / `--role` e caminhos de sessão dedicados em `config.js` + propagação de `role` em `api-client.js` (`auth`/`heartbeat`/`next-job`) | Implemented |
| ROB2-04 | Entrypoints físicos `main-query.js` e `main-update.js` (wrappers 3L) com dispatch em `main.js` (`ROBOT_ROLE`/`--role`) | Implemented |
| ROB2-05 | Segregação e desacoplamento de execução de rotinas em `job-runner.js` com `allowedActions` e guard antes de `chromium.launch` | Implemented |
| ROB2-06 | Pipeline de compilação parametrizado por papel em `build.js` (matriz `ROBOT_API_KEY_N × role` → `dist/robot-<role>-<N>/`, `define ROBOT_ROLE`) | Implemented |
| ROB2-07 | Scripts no `package.json` e `Makefile` para build individual e conjunto (`build:robot:query`, `build:robot:update`, `build:robot:all`, `ROLE=` ) | Implemented |
| ROB2-08 | Enfileiramento idempotente de `query_agreements` no `statusSyncScheduler` (heartbeat 60s + fallback `executeWithBrowser`) e conciliação em lote em `updateJobStatus` | Implemented |
| ROB2-09 | Agregação de métricas por `role` em `getAllInstances` e `getMetrics`, com schemas Zod atualizados em `robotDocusignController.js` + `400` para `role` inválido | Implemented |
