# Sub-Spec: Robot-DocuSigner — Standalone Executável Protegido & Multi-Instância Distribuída

## Problem Statement
O robô RPA DocuSign é distribuído e executado localmente em múltiplos terminais, garantindo:
1. **Proteção de Código**: Ofuscação + empacotamento em `.exe` self-contained via `@yao-pkg/pkg` (sem `.jsc` — AD-013 atualizado; `bytenode` removido do pipeline).
2. **Concorrência Segura**: Fila compartilhada MongoDB com **lock atômico** (`findOneAndUpdate`) por `action` + `role`.
3. **Comunicação e Rastreabilidade**: HTTP autenticado via JWT, heartbeat periódico, identificação por `instance_id` (gerado de `key_prefix`) + `role` (`query|update|all`).
4. **Segurança de Dados**: Download temporário de PDFs com exclusão imediata e credenciais em memória volátil.
5. **Segregação por Papel**: `query` (leitura: `status/query_agreements/reports/download`) vs `update` (escrita: `send/resend`) com sessões isoladas e build matriz `N×R` (AD-053).

> **Relação com o Servidor**: `robot/` é o **Robô Standalone** (`.exe` por papel em `dist/robot-query-N/` / `dist/robot-update-N/`). Comunica com Servidor Central (`backend/`, porta 3111) via HTTP autenticado (`X-Robot-Key` + `role`). O servidor mantém `RobotJob`/`RobotInstance`/monitoramento. Standalone sem DB próprio. Fonte canônica do roteamento por papel: `features/robot/dois-robos-consulta-atualizacao` (AD-053).

---

## Requisitos Funcionais

### [REQ-SMI-01] Modelo e Concorrência Atômica na Fila
- Campos de concorrência em `RobotJob`: `locked_by`, `lock_expires_at`, `instance_metadata`, `originalStatus` (restauração fiel).
- Modelo `RobotInstance` com `role: enum[query,update,all], default all, index` + `last_heartbeat`.
- `RobotJob.action` inclui `query_agreements` com `contract_id`/`contractId` condicionalmente opcional (`required: function`); índice `{status:1, action:1, lock_expires_at:1, createdAt:1}`.
- Busca atômica via `findOneAndUpdate` com filtro por `allowedActions` do `role` + liberação de locks expirados (>10min); `$and` com dois `$or` (status + lock) para evitar sobrescrita de chave.

### [REQ-SMI-02] Endpoints da Instância (`/api/robot-docusign/instance/*`)
- `POST /auth`: Lê `role` de `req.body.role` (bypass Zod), valida `ROLE_ENUM`, autentica via `X-Robot-Key` (SHA-256) ou fallback `email/senha`, gera JWT 30d `isRobot:true`, persiste `RobotInstance.role`, retorna `{token, instance_id}`. `400` se `role` inválido.
- `GET /config`: Restrições de horário + `operations`/`schedule` (Zod).
- `GET /next-job`: Filtra por `role` → `query=[status,query_agreements,reports,download]`, `update=[send,resend]`, `all=*`; ignora `query_agreements` no `robotScheduler`; aplica filtro elegibilidade `contractEligibility`.
- `PATCH /job/:jobId/status`: Reconcilia batch `query_agreements` (`result.envelopes` Zod) via `syncContractStatus` + download PDFs assinados.
- `POST /heartbeat`: Persiste `role`, atualiza `last_heartbeat`.
- `GET /contracts/:contractId/pdf`: Stream autenticado do PDF temporário.
- `GET /instances`, `GET /metrics`, `GET /queue`: Expõem `instances_by_role: {query,update,all,total}`.

### [REQ-SMI-03] Cliente Autônomo Standalone
- Arquitetura `ApiClient` + `Scheduler` + `JobRunner` + `Browser/Playwright` + `Logger` ANSI.
- Config injetada em build (`ROBOT_KEY`, `ROBOT_ROLE`, `HEADLESS`, `API_URL` via `--define`); sem `config.json` (removido, apenas `session-query.json`/`session-update.json`/`session-docusign.json` por papel); entrypoints `main-query.js`/`main-update.js` wrappers 3L (`process.env.ROBOT_ROLE="query"; await import("./main.js")`).
- `JobRunner` com `ROLE_ACTIONS` e guard `if(!allowedActions.includes(action)) { updateJobStatus failed; throw }` **antes** de `chromium.launch`.
- Setup via `setup.bat` apenas para Chromium.
- **Distribuição**: `.exe` self-contained + `node_modules/playwright` + `node_modules/playwright-core` ao lado + `setup.bat` + `run.bat` (título por papel) + `README.txt` por `dist/robot-<role>-N/` (sem `.jsc`; `.exe` não aborta por ausência de `.jsc`).

### [REQ-SMI-04] Pipeline de Build Protegido
- Transpilação `esbuild` (ESM→CJS) com `--external:playwright --external:playwright-core --external:bytenode` e `--define:process.env.API_URL|ROBOT_KEY|ROBOT_ROLE|HEADLESS`.
- Ofuscação `javascript-obfuscator` (control-flow-flattening, string-array base64).
- Empacotamento `@yao-pkg/pkg` → `node20-win-x64` `.exe` por `(chave, role)`.
- **Sem etapa `bytenode/.jsc`** — `import bytenode` removido; pipeline 3 etapas (era 4 com `.jsc`). Se `.jsc` for reintroduzido, atualizar AD-013 e este REQ.
- Matriz `ROBOT_API_KEY_N × role` → `dist/robot-query-N/` e `dist/robot-update-N/` (alias `robot-docusigner-N` quando `role=all`); `entryFile` por papel (`main-query.js`/`main-update.js`/`main.js`).
- Patch `coreBundle.js` (`node:inspector` shim) para `@yao-pkg/pkg` (`ERR_INSPECTOR_NOT_AVAILABLE`).

### [REQ-SMI-05] Distribuição das Dependências Playwright no Build
- `@yao-pkg/pkg` não inclui deps dinâmicas (`C:\snapshot`); `playwright` + `playwright-core` copiados para `dist/robot-query-N/node_modules/` e `dist/robot-update-N/node_modules/`.
- `setup.bat` copiado para cada `dist/<bundleBase>/`.
- `run.bat` com `title [DocuSign RPA] - Consulta #N - robot-query-N` (ou `Atualização`/`All`) e `README.txt` explicativo por pasta.

### [REQ-SMI-06] Script de Setup com Diagnóstico Completo de Ambiente
- `setup.bat` sem `config.json` / `config.json.example`; header `chcp 65001` UTF-8.
- **Detecção Inteligente Chromium**: verifica `%LOCALAPPDATA%\ms-playwright\chromium-*` antes de download; se existe, pronto sem rede.
- **Download sob Demanda**: `npx playwright install chromium` só se não encontrado, com `%ERRORLEVEL%`, teste de conectividade (`ping`) e `setup.log`.
- Pré-checagem `if exist "%LOCALAPPDATA%\ms-playwright"` antes de `for /d` com curinga (evita `. was unexpected` em máquinas limpas).
- Feedback `[SUCESSO] O robô está pronto para uso` ou orientações.

### [REQ-SMI-07] Inicialização Automática com o Windows no Setup
- `setup.bat` registra `DocuSignerRobot` → `run.bat` em `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (`reg add`), loga `%ERRORLEVEL%`.

### [REQ-SMI-08] Segregação Dual-Robot Query/Update (AD-053)
- `RobotInstance.role` + `RobotJob.action=query_agreements` + índice por `action`; `getNextJob` filtra por `allowedActions`; `statusSyncScheduler` enfileira `query_agreements` idempotente quando `mode=robot` e existe `RobotInstance` com `role in [query,all]` e `last_heartbeat>60s`, senão fallback `executeWithBrowser("query_agreements")`; intervalo padrão `5min`; `updateJobStatus` reconcilia batch; `Makefile ROLE=query|update|all` + `robot/package.json build:robot:query|update|all`.

> Cross-ref: `features/robot/dois-robos-consulta-atualizacao/spec.md` (AC-01.1..01.8, AC-02.1..02.3, ROB2-01..09).
