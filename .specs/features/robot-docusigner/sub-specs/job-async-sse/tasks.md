# Sub-Spec: Robot-DocuSigner — Tasks de Implementação (Async Job + SSE Stream)

## Execution Protocol

- **Runner**: `node --test` (nativo do Node 18+)
- **Framework**: `node:assert` + `node:test` (mock.method, mock.restoreAll)
- **Branch**: `feat/robot-docusigner-async-sse`
- **Commits**: Atômicos por task, seguindo `.agents/rules/commit.md`
- **Idioma**: pt-BR em mensagens, comentários e documentação

## Test Coverage Matrix

| Req ID | Task | Testes Unitários | Testes Integração | Testes E2E / Frontend |
|--------|------|-------------------|-------------------|-----------------------|
| REQ-ASYNC-01 | T-ASYNC-01 | ✅ robotOrchestrator events | ✅ Controller trigger 202 | — |
| REQ-ASYNC-02 | T-ASYNC-02 | ✅ SSE stream headers | ✅ GET /jobs/:jobId/stream | — |
| REQ-ASYNC-03 | T-ASYNC-03 | — | — | ✅ docusignService SSE listen |
| REQ-ASYNC-04 | T-ASYNC-04 | — | — | ✅ Polling fallback test |
| REQ-ASYNC-05 | T-ASYNC-05 | — | ✅ Nginx proxy config | — |

---

## Detalhamento das Tasks

### T-ASYNC-01: Adaptação do Orchestrator e Disparo Assíncrono (HTTP 202)

- **Req**: REQ-ASYNC-01
- **Status**: ✅ Completed (2026-08-12)
- **Esforço**: 1.5h | Paralelável: Não
- **O quê**: 
  - Adicionar suporte a `EventEmitter` no `robotOrchestrator.js` para emitir eventos `job:progress` a cada mudança de step/status em `executeJob`.
  - Alterar `triggerJob` e `triggerBatchJobs` em `src/modules/robot-docusign/controllers/robotDocusignController.js` para criar o `RobotJob`, disparar a execução em background sem `await` (usando `setImmediate`), e retornar HTTP `202 Accepted` com `{ success: true, message: "Job agendado", jobId: job._id, status: job.status }`.
- **Onde**:
  - `src/modules/robot-docusign/services/robotOrchestrator.js`
  - `src/modules/robot-docusign/controllers/robotDocusignController.js`
- **Testes**:
  - `src/modules/robot-docusign/controllers/robotDocusignController.test.js` (validar retorno HTTP 202 em vez de bloqueio síncrono).

---

### T-ASYNC-02: Endpoint de Streaming Server-Sent Events (SSE)

- **Req**: REQ-ASYNC-02
- **Status**: ✅ Completed (2026-08-12)
- **Esforço**: 2h | Paralelável: Sim (após T-ASYNC-01)
- **O quê**:
  - Criar o handler `streamJobProgress` em `src/modules/robot-docusign/controllers/robotDocusignController.js`.
  - Configurar headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
  - Registrar listener nos eventos do `robotOrchestrator` para o `jobId` específico.
  - Implementar intervalo de keep-alive (15s) para enviar `: ping\n\n`.
  - Fechar a conexão ao atingir status terminal (`completed` ou `failed`).
  - Adicionar rota `GET /jobs/:jobId/stream` em `src/modules/robot-docusign/routes.js`.
- **Onde**:
  - `src/modules/robot-docusign/controllers/robotDocusignController.js`
  - `src/modules/robot-docusign/routes.js`
- **Testes**:
  - Teste de integração via Supertest validando headers SSE e transmissão de eventos mockados.

---

### T-ASYNC-03: Atualização do Cliente Frontend com EventSource & UI Feedback

- **Req**: REQ-ASYNC-03
- **Status**: ✅ Completed (2026-08-12)
- **Esforço**: 2h | Paralelável: Sim (após T-ASYNC-02)
- **O quê**:
  - Atualizar `public/modules/contratos/api.js` para tratar resposta HTTP 202 no método `triggerRobot`.
  - Atualizar `public/modules/contratos/services/docusignService.js` para instanciar `new EventSource('/api/robot-docusign/jobs/' + jobId + '/stream')`.
  - Atualizar os elementos visuais do modal de envio com o status/passo atual em tempo real (ex: *"Logando..."*, *"Gerando envelopes..."*, *"Finalizado"*).
- **Onde**:
  - `public/modules/contratos/api.js`
  - `public/modules/contratos/services/docusignService.js`

---

### T-ASYNC-04: Polling Fallback no Frontend

- **Req**: REQ-ASYNC-04
- **Status**: ✅ Completed (2026-08-12)
- **Esforço**: 1h | Paralelável: Sim (junto com T-ASYNC-03)
- **O quê**:
  - Adicionar fallback no `docusignService.js`: se o `EventSource` emitir `onerror` ou não for suportado pelo navegador, iniciar um `setInterval` de 3 segundos consultando `window.api.getRobotJobStatus(jobId)` até o término.
- **Onde**:
  - `public/modules/contratos/services/docusignService.js`

---

### T-ASYNC-05: Ajuste de Infraestrutura Nginx para SSE

- **Req**: REQ-ASYNC-05
- **Status**: ✅ Completed (2026-08-12)
- **Esforço**: 0.5h | Paralelável: Sim
- **O quê**:
  - Adicionar bloco no [`nginx/default.conf`](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/nginx/default.conf):
    ```nginx
    location ~ /api/robot-docusign/jobs/.*/stream {
        proxy_pass http://app_gestor:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
    ```
- **Onde**:
  - `nginx/default.conf`
