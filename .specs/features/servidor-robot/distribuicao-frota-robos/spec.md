# Especificação Técnica: Distribuição de Frota de Robôs DocuSigner

## 1. Visão Geral

Esta especificação define o comportamento arquitetural e de execução para a distribuição de frotas de robôs RPA (`robot-query` e `robot-enviar`), eliminando a concorrência inline do servidor com a frota standalone, padronizando o enfileiramento assíncrono via `POST /trigger`, propagando progresso via Server-Sent Events (SSE), reforçando garantias anti-fantasma com validação estrita de `envelopeId` UUID e unificando papéis canônicos de robôs (`query`, `update`, `all`) com suporte a aliases (`enviar -> update`).

---

## 2. Requisitos Funcionais e Arquiteturais

### FROTA-01: Confirmação Resiliente de Upload no Robô Standalone
- **Contexto**: O robô standalone (`uploadStep.js`) necessita validar a renderização e o processamento do documento após o envio do arquivo PDF.
- **Regra**: A confirmação de upload não deve misturar engines de seletores (ex.: CSS com pseudo-engines `text=`). Deve utilizar seletores Playwright válidos e corrida (`Promise.race`) entre detecção de card de documento por atributos (`[data-qa*='document'], [data-qa*='file-name']`) e detecção de texto com escape de regex (`RegExp(escapedPrefix, "i")`).
- **Critério**: O sucesso só é declarado após evidência visual real na página. Falhas disparam captura de screenshot (`upload_process_fail`) e lançam exceção explícita.

### FROTA-02: Enfileiramento Assíncrono no Trigger (`POST /trigger`)
- **Contexto**: O endpoint `POST /api/robot-docusign/trigger` disparava execução direta ou inline competindo com os robôs autônomos.
- **Regra**: O endpoint `POST /trigger` deve criar um registro `RobotJob` com `status: "pending"` e responder imediatamente com HTTP `202 Accepted` contendo o `jobId` real (`_id` do documento gerado no MongoDB).
- **Critério**: Nenhum fallback para `contractId` no campo `jobId`. Emissão do evento de progresso inicial (`emitProgress`).

### FROTA-03: Scheduler de Envio Exclusivamente como Fallback
- **Contexto**: O `robotScheduler` no servidor backend executava jobs de envio periodicamente, colidindo com a frota distribuída ativa.
- **Regra**: O `robotScheduler` deve verificar se existem instâncias ativas com role `update` ou `all` com heartbeat recente (< 90s). Se houver frota ativa, o processamento de envio inline pelo servidor é ignorado com status `skipped` e razão `fleet_active`.
- **Critério**: O backend só processa envio inline quando não houver nenhum robô de envio vivo na frota.

### FROTA-04: Propagação Unificada de Progresso via SSE para Robôs Standalone
- **Contexto**: A UI acompanha o progresso dos envelopes via SSE (`/jobs/:jobId/stream`), mas os robôs `.exe` reportam via API REST.
- **Regra**: Ao travar um job em `getNextJob` ou receber atualizações em `PATCH /instance/job/:jobId/status` (`updateJobStatus`), o backend deve emitir o evento `emitProgress(job)`.
- **Critério**: A interface web recebe em tempo real os passos (`steps`) e status (`processing`, `retrying`, `completed`, `failed`) executados pelas instâncias standalone.

### FROTA-05: Garantia Anti-Fantasma no Envio de Envelopes
- **Contexto**: Prevenção contra falsos positivos onde um job de envio é marcado como concluído sem que a DocuSign tenha gerado um envelope válido.
- **Regra**: Ao atualizar o status de um job de `send`/`resend` para `completed`, o backend valida obrigatoriamente se o `envelopeId` é um UUID v4 válido de 36 caracteres.
- **Critério**: Se o `envelopeId` for ausente ou inválido, o status do job é forçado para `failed`, e o status do contrato é revertido para o status pré-lock (`originalStatus` ou `gerado`).

### FROTA-06: Visibilidade de Instâncias Vivas na Frota (`alive`)
- **Contexto**: O painel de monitoramento necessita identificar quais robôs estão operacionais.
- **Regra**: O endpoint `GET /api/robot-docusign/instances` (e `getAllInstances`) calcula dinamicamente o campo booleano `alive` para cada instância baseado no `last_heartbeat` (< 90 segundos da data/hora atual).
- **Critério**: Preservação das agregações por papel (`instances_by_role`) e retrocompatibilidade com campos legados.

### FROTA-07: Padronização Canônica de Roles e Normalização de Alias
- **Contexto**: O papel de envio era referenciado alternadamente como `update` ou `enviar`.
- **Regra**: O valor canônico de protocolo no backend e banco de dados é `update` (junto a `query` e `all`). O termo `enviar` é tratado como alias de borda na CLI e na compilação (`robot/build/build.js`).
- **Critério**: Criação do módulo central `roleActions.js` (`ROLE_ENUM`, `ROLE_ACTIONS`, `getAllowedActions`, `isActionAllowedForRole`) consumido pelo distribuidor.

### FROTA-08: Rastreabilidade, Registro de Decisão e Documentação
- **Contexto**: Manutenção de histórico arquitetural e conformidade com as regras de governança.
- **Regra**: Registro formal da decisão arquitetural AD-067 no arquivo `.specs/STATE.md` e atualização da topologia e comandos no `AGENTS.md`.

---

## 3. Matriz de Rastreabilidade

| Requisito | Componente / Arquivo | Ação |
| :--- | :--- | :--- |
| FROTA-01 | `robot/src/browser/steps/uploadStep.js` | Race Playwright válido + escape regex |
| FROTA-02 | `backend/.../seletorApiRobot/index.js`, `backend/.../controllers/robotDocusignController.js` | Função `enqueueJob` + `POST /trigger` 202 com `_id` real |
| FROTA-03 | `backend/.../seletorApiRobot/robotScheduler.js` | Guard de heartbeat < 90s para instâncias `update`/`all` |
| FROTA-04 | `backend/.../controllers/robotInstanceController.js` | Emissão `emitProgress` em `getNextJob` e `updateJobStatus` |
| FROTA-05 | `backend/.../controllers/robotInstanceController.js` | Validação UUID em `completed` de send + reversão em falha |
| FROTA-06 | `backend/.../controllers/robotInstanceController.js` | Cálculo de `alive` (< 90s) em `getAllInstances` |
| FROTA-07 | `backend/.../utils/roleActions.js`, `backend/.../controllers/robotInstanceController.js`, `robot/build/build.js` | Módulo canônico de roles + normalização de alias `enviar` |
| FROTA-08 | `.specs/STATE.md`, `AGENTS.md` | AD-067 + topologia de frota de 2 robôs |
