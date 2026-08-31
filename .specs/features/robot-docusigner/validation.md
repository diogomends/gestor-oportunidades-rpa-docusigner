# Relatório de Validação — Tasks T11 & T12: Refatoração, Segurança e Desambiguação de Rotas Robot-DocuSign

- **Data**: 2026-08-14
- **Escopo**: Microsserviço RPA DocuSigner (`gestor-oportunidades-rpa-docusigner`) & Integração Frontend
- **Padrões Aplicados**: SOLID (Single Responsibility Principle) e PonyTail (eliminação de sobre-engenharia e segregação estrita de rotas).

---

## 1. Arquivos Implementados e Refatorados

| Arquivo | Ação | Descrição |
|---|---|---|
| `gestor-oportunidades-rpa-docusigner/src/modules/robot-docusign/routes.js` | Refatorado | Remoção de `router.use(instanceRoutes)` genérico, segregação de sub-rotas `/instance/*` e adição de rota administrativa `/instances` com RBAC `admin`. |
| `gestor-oportunidades-rpa-docusigner/src/modules/robot-docusign/routes/robotInstanceRoutes.js` | Refatorado | Middleware `authorize("admin")` adicionado na rota de instâncias. |
| `public/modules/config-sistema/robot-docusign/robotDocusignService.js` | Criado | Serviço com 5 funções isoladas (`fetchConfig`, `saveConfig`, `testLogin`, `fetchStatusMetrics`, `fetchInstances`). |
| `public/modules/config-sistema/robot-docusign/robot-docusign.js` | Refatorado | Polling seguro, proteção XSS via `escapeHtml`, listeners de auto-save e tratamento graceful de ausência de instâncias. |

---

## 2. Critérios de Aceite Validados (T11 & T12)

- [x] Desambiguação completa de rotas: `GET /api/robot-docusign/config` responde as configurações globais sem colisão com `GET /api/robot-docusign/instance/config`.
- [x] Rota `GET /api/robot-docusign/instances` protegida por JWT e RBAC `admin`.
- [x] Sanitização contra XSS aplicada a todos os campos dinâmicos da instância (`instance_id`, `hostname`, `platform`).
- [x] Polling recursivo com `setTimeout` no `finally` e guard `document.hidden` para evitar tempestade de requisições.
- [x] Proxy Nginx compatibilizado sem barra final (`set $rpa_docusigner_api "http://rpa_docusigner:3111"`).

---

## 3. Validação E2E Playwright (Task T10)

- **Arquivo de Teste**: `tests/e2e/robot-docusign.spec.js`
- **Ambiente**: Produção (`http://165.227.212.57:8000`)
- **Cenários Cobertos**:
  - [x] Carregamento completo do painel de configuração com todos os seletores e badges presentes.
  - [x] Disparo e feedback de auto-save via interface.
  - [x] Acionamento de teste de login com estado visual de loading e toast de feedback.
---

## 4. Validação Fase 8 — Tasks T13 & T14: Integração e Desacoplamento com Gestor de Oportunidades

- **Data**: 2026-08-17
- **Arquivos Implementados e Atualizados**:
  - `src/services/gestorApiClient.js`: Cliente HTTP com métodos `validateApiKey()`, `fetchPendingContracts()` e `updateContractStatus()`, com timeout de 10s via `AbortSignal.timeout(10000)` e retries exponenciais para resiliência de rede.
  - `src/services/gestorApiClient.test.js`: Suíte de testes unitários nativos com `node:test` e mocks isolados para todas as operações do cliente.
  - `src/modules/robot-docusign/services/robotScheduler.js`: Consulta desacoplada de contratos pendentes via `gestorApiClient.fetchPendingContracts` com fallback para Mongoose.
  - `src/modules/robot-docusign/services/robotOrchestrator.js`: Atualização desacoplada de status de contratos pós-envio/download via `gestorApiClient.updateContractStatus` com fallback para Mongoose.
  - `src/server.js`: Guard de validação de chave no bootstrap antes da inicialização do scheduler e do listener HTTP.
  - `.specs/features/robot-docusigner/tasks.md` & `SPEC.md`: Status das tasks legadas, matriz de testes e rastreabilidade de requisitos sincronizados.
- **Critérios de Aceite**:
  - [x] Header `x-robot-key` propagado nas requisições HTTP para a API Central.
  - [x] Timeout de 10s e retries com backoff exponencial ativos no cliente HTTP.
  - [x] Falhas de rede ou retorno `HTTP != 200` tratadas graciosamente sem travar o processo.
  - [x] Guard de inicialização em `server.js` interrompe a subida (`process.exit(1)`) caso a chave esteja revogada ou inválida.
  - [x] Sincronização de status do contrato via HTTP funcionando com fallback direto no banco de contingência.

---

## 5. Critérios de Validação - Task T15: Código OTP/MFA no test-login

- **Data**: 2026-08-25
- **Status**: Implementado — validação unitária/integração concluída; E2E pendente pós-deploy

### Cenários a validar

- [x] `POST /api/robot-docusign/test-login` com `otpCode` ausente → comportamento atual preservado (sem breaking change). *Coberto por testes de regressão existentes (`robotSession.test.js`).* 
- [x] `POST /test-login` com `otpCode` válido (6 dígitos) e tela MFA presente no DocuSign → código preenchido, submetido e login concluído com sucesso. *Teste "preenche e submete otpCode com timeout estendido" (`robotSession.test.js`).*
- [x] Tela MFA detectada **sem** `otpCode` informado → HTTP **401** com `{ "error": "MFA_REQUIRED" }`. *Teste "lanca erro MFA_REQUIRED" + mapeamento no controller.*
- [x] `otpCode` rejeitado/expirado pelo DocuSign → HTTP **401** com `{ "error": "OTP_INVALID" }`. *Teste "lanca erro OTP_INVALID" + mapeamento no controller.*
- [x] `otpCode` fora do padrão (ex.: 5 dígitos, letras) → HTTP **400** (validação Zod). *Teste de integração "deve retornar 400 quando otpCode não tem exatamente 6 dígitos numéricos" (`robotDocusignController.test.js`).*
- [x] Timeouts da etapa MFA estendidos para 90s (`MFA_TIMEOUT`) — detecção do input e navegação pós-submissão; fluxo sem MFA mantém timeouts originais (10s/30s).
- [x] Testes unitários (`robotSession.test.js`) e de integração (`robotDocusignController.test.js`) passando via `npm test` — 87 testes, 0 falhas.
- [ ] E2E em produção: login real DocuSign exigindo MFA com código gerado pelo usuário.

---

## 6. Critérios de Validação — Task T17: Extração Headless de MFA via IMAP

- **Data**: 2026-08-27
- **Status**: ✅ Concluído e Validado (100/100 testes de regressão passando)
- **Escopo**: Leitura direta via protocolo IMAP/TLS nativo (`node:tls`) com fallback resiliente para Roundcube.

### Cenários Validados
- [x] Conexão TLS com servidor IMAP (`host`, `port`, `tls`) estabelecida com `{ rejectUnauthorized: false }` tolerante.
- [x] Autenticação com credenciais decifradas de `token_notification_email` executada com sucesso via comando `LOGIN`.
- [x] Busca de e-mails DocuSign no `INBOX` priorizando o e-mail mais recente por UID.
- [x] Decodificação de conteúdo em `quoted-printable` e `base64` com extração precisa do código de 6 dígitos.
- [x] Marcação da mensagem como lida (`STORE +FLAGS (\Seen)`) após extração bem-sucedida.
- [x] Tratamento gracioso quando o e-mail não estiver disponível imediatamente (polling com backoff).
- [x] Suporte a fallback para `roundcube.js` em caso de erro de rede ou recusa de porta IMAP (993).
- [x] Persistência de `token_notification_email` em `PUT /config` com senha cifrada e sem perda de campos.
- [x] Cobertura de testes unitários com mock TLS em `robot/src/browser/imapClient.test.js` e `backend/src/modules/robot-docusign/services/imapClient.test.js`.
- [x] Compatibilidade garantida com o build binário do robô (`robot/build`) por usar 100% módulos nativos do Node.js.

---

## 7a. Critérios de Validação — Task T20: Otimização PonyTail e Redução de Roundtrips IMAP (5.51.0)

- **Data**: 2026-08-27
- **Status**: ✅ Aprovado — `CHANGELOG 5.51.0` migrado
- **Escopo**: M1 redução 8→2 `UID SEARCH`, M2 reuso de socket no polling, M3 eliminação de duplicação de testes, M4 alinhamento de constantes.

### Cenários de Validação Executados (T20)

- [x] **M1 — Redução de UID SEARCH**: 8 consultas sequenciais → 2 padrões (`SINCE <hoje>` + fallback `ALL`), filtro de assunto delegado ao cliente via regex — economia de até 6 roundtrips por tentativa (`imapClient.js`).
- [x] **M2 — Reuso de Conexão**: mesmo socket/sessão autenticado reutilizado durante `fetchMfaCodeViaImap` polling, sem `LOGIN` repetido — previne rate-limit Dovecot (`imapClient.js`).
- [x] **M3 — Fonte única de testes**: `robot/src/browser/imapClient.test.js` mantido como fonte da verdade; `backend/.../imapClient.test.js` referencia diretamente — duplicação eliminada.
- [x] **M4 — Constantes alinhadas à spec**: `pollIntervalMs: 3000`, `backoffFactor: 1.2`, `maxPollIntervalMs: 6000`.
- [x] **Regressão**: 100% testes `imapClient.test.js` passando via `node --test`.

---

## 7. Critérios de Validação — Task T18: Hardening e Resiliência do Cliente IMAP

- **Data**: 2026-08-27
- **Status**: ✅ Aprovado
- **Escopo**: Resiliência contra queda prematura de socket, otimização de rate-limit e filtro temporal `SINCE`.

### Cenários de Validação Executados
- [x] Encerramento abrupto ou queda do socket durante `sendCommand` rejeita a Promise imediatamente sem aguardar 15 segundos de timeout.
- [x] O comando `UID SEARCH` inclui filtro temporal formatado (`SINCE <DD-Mon-YYYY>`) evitando falsos positivos com mensagens legadas.
- [x] Estratégia de polling com backoff adaptativo previne esgotamento de conexões e mitigação de bloqueios por firewall/antispam.
- [x] Regressão: 100% dos testes unitários do backend e do robô passam sem falhas via `node --test`.

---

## 8. Critérios de Validação — Task T19: Correção de Conexão, Parsing e Sanitização IMAP

- **Data**: 2026-08-27
- **Status**: ✅ Aprovado
- **Escopo**: Correção de handshake hang (E1), regex multiline em tags (E2), escaping de credenciais RFC 3501 (E3) e data com zero-padding (E4).

### Cenários de Validação Executados
- [x] E1: `connect()` mantém timeout ativo até o greeting `* OK` e rejeita a Promise imediatamente se o socket fechar prematuramente.
- [x] E2: `sendCommand` usa regex delimitada por linha `(?:^|\r?\n)${tag}` evitando falsos positivos em payloads de e-mail e retorna `{ tag, response, raw }` compatível com JSDoc.
- [x] E3: `escapeImapString` escapa corretamente aspas duplas e barras invertidas no comando `LOGIN` do protocolo IMAP.
- [x] E4: `formatImapDate` formata dias menores que 10 com zero-padding (ex: `02-Aug-2026`).

---

## 9. Critérios de Validação — Task T24 & T25: Filtro de Assunto/Timestamp IMAP e Persistência de Sessão

- **Data**: 2026-08-28
- **Status**: ✅ Aprovado
- **Escopo**: Filtro rigoroso de assunto (`Subject`), timestamp (`mfaTriggerTime`), decodificação de header folding (RFC 5322), decodificação de charsets (UTF-8, ISO-8859-1/Latin1), janela de validade configurável (default 10min) e persistência de sessão `storageState` (`session-docusign.json`).

### Cenários de Validação Executados (T24)
- [x] **Header Folding (RFC 5322)**: `decodeMimeHeader` e `parseEmailMetadata` realizam desdobramento de linhas continuadas (`\r?\n[ \t]+` -> `" "`) e ignoram espaços entre blocos MIME adjacentes (`RFC 2047 6.2`), processando assuntos multi-linha sem truncamento.
- [x] **Suporte a Charsets**: Mapeamento dinâmico em `getBufferEncoding` suporta UTF-8, ISO-8859-1, Latin1 e Windows-1252 sem corrupção de acentuação.
- [x] **Filtro de Assunto Estrito**: Verificação com `typeof options.subjectFilter === "string"` preserva filtros intencionalmente vazios e aplica default `"Verificar um novo dispositivo"`.
- [x] **Validação Temporal com Janela Configurável (default 10min)**:
  - Aceita mensagens recebidas dentro da janela (`mfaTriggerTime - 3min`, ex: reinício).
  - Rejeita mensagens expiradas (`mfaTriggerTime - 11min`).
  - Configurável via `SystemConfig mfa.maxAgeMs` / `env MFA_MAX_AGE_MS` / `options.mfaMaxAgeMs`.
- [x] **Prevenção de Falso Positivo por Ausência de Data**: Quando `mfaTriggerTime` está ativo e a mensagem não contém `INTERNALDATE` nem cabeçalho `Date`, a mensagem é descartada defensivamente (`continue`).
- [x] **Fallback de Cabeçalho `Date`**: Quando `INTERNALDATE` está ausente do servidor IMAP, o cabeçalho `Date:` do e-mail é utilizado para validação temporal.
- [x] **Expurgo de Regex Genérica**: Removido `\b(\d{6})\b` de `extractMfaCodeFromText`, restringindo a extração aos padrões semânticos oficiais de segurança DocuSign.
- [x] **Propagação ao Fallback Roundcube**: `mfaTriggerTime` e lista de `excludedCodes` repassados a `fetchMfaCodeFromRoundcube` em `docusign.js`.

### Divergência Arquitetural Documentada
- **UID FETCH Único (`BODY.PEEK[]`)**: Em vez de executar dois comandos FETCH separados (`HEADER.FIELDS (SUBJECT DATE)` e posterior `BODY.PEEK[TEXT]`), o `imapClient` executa `UID FETCH ${uid} (INTERNALDATE BODY.PEEK[])` de uma só vez por UID sequencial decrescente. Essa decisão preserva a simplicidade e reduz roundtrips de socket TCP/TLS (princípio PonyTail), visto que o corpo completo é mandatário para a extração do código logo após a checagem de cabeçalhos.

### Cenários de Validação Executados (T25)
- [x] Contexto Playwright carrega automaticamente `session-docusign.json` se existente.
- [x] Auto-recuperação e descarte de arquivo de sessão corrompido sem interrupção do job runner.
- [x] `ensureAuthenticated` persiste `storageState` localmente após sucesso de autenticação/MFA.
- [x] Invalidação automática e reautenticação transparente ao detectar sessão expirada em operações de envio/status.

---

## 10. Critérios de Validação — Task T26: Hardening, Isolamento e Resiliência da Sessão Playwright

- **Data**: 2026-08-28
- **Status**: ✅ Aprovado
- **Escopo**: Prevenção de vazamento no Git/Docker, criação recursiva de pastas (`mkdirSync`), restrição de permissão UNIX (`0o600`), persistência contínua de sessão pós-envio/status, proteção contra duplo redirect e repasse de caminho customizado.

### Cenários de Validação Executados (T26)
- [x] **P0 - Isolamento Git & Docker**: `session-docusign.json` e `**/session-docusign.json` adicionados a `.gitignore` e `.dockerignore`.
- [x] **P0 - Criação de Diretório Recursivo**: `path.dirname(sessionPath)` verificado e criado com `{ recursive: true }` em `docusign.js` (`saveSessionState`) e `job-runner.js` (`JobRunner.processJob`).
- [x] **P1 - Permissão Segura (0o600)**: `fs.chmodSync(sessionPath, 0o600)` executado após gravação de storageState com tratamento defensivo de erros (`catch`).
- [x] **P1 - Persistência Pós-Operação**: `saveSessionState` invocado ao final de `sendEnvelope` e `checkEnvelopeStatus`, assegurando persistência da rotação de cookies.
- [x] **P1 - Proteção Contra Duplo Redirect**: Redirecionamento persistente para `/oauth/`, `/login` ou `identity.` após reautenticação lança exceção imediata (`Falha de autenticação persistente...`), eliminando loops e timeouts cegos em inputs.
- [x] **P1 - Repasse de Configuração**: `DOCUSIGN_SESSION_PATH` carregado de variáveis de ambiente/config.json em `config.js` e injetado na instanciação de `JobRunner` em `main.js`.
- [x] **P2 - Testes Unitários de Hardening**: Criada suíte `robot/src/browser/docusign.test.js` com 6 cenários de teste validando criação de diretório, persistência de sessão ativa, remoção de sessão expirada e lançamento de exceção em duplo redirect.
- [x] **P2 - Documentação**: Variável `DOCUSIGN_SESSION_PATH` documentada em `.env.example`, `README.md` e `AGENTS.md`.
- [x] **Regressão Global**: 160 testes (121 backend + 39 robot browser) executados e aprovados com 100% de sucesso.

---

## 11. Critérios de Validação — Correções 5.56.1: Paridade MFA Roundcube e Hardening Charset (Diagnóstico Atualizado)

- **Data**: 2026-08-28
- **Status**: ✅ Aprovado — diagnóstico sincronizado para **5.56.1** (supersede `5.55.2`)
- **Escopo**: Alinhamento de paridade `roundcube.js` ↔ `imapClient.js`, remoção de `decodeQuotedPrintable` redundante e log de `mkdirSync`

---

## 12. Critérios de Validação — Filtro de Elegibilidade PDF + E-mail (AD-038)

- **Data**: 2026-08-31
- **Status**: ✅ Aprovado — 177 testes passando, `node --check` OK nos 4 arquivos
- **Escopo**: Helper centralizado `utils/contractEligibility.js` e validação em 3 camadas (`getNextJob`, `robotScheduler`, `job-runner`)

### Cenários de Validação Executados (AD-038)
- [x] **Filtro de criação (`GERADO_ELIGIBLE_FILTER`)**: `Contract.findOneAndUpdate` em `getNextJob` e `Contract.findOne` em `robotScheduler` só capturam `status:"gerado"` com `documents.originalUrl` não-vazio e e-mail em `$or` (4 campos); contrato sem PDF/e-mail permanece `gerado` sem travar fila
- [x] **Pós-validação de job legado (`getNextJob`)**: job `pending`/`retrying` com contrato inelegível → `RobotJob: failed` + `reason:"contract_missing_pdf_or_email"` + `Contract` revertido `em_processamento_robot`→`gerado` (coberto por `hasPdf`/`isEligibleForSend` com `trim()`)
- [x] **Pós-filtro da API (`robotScheduler`)**: `gestorApiClient.fetchPendingContracts` retornando contrato sem PDF/e-mail é descartado em memória (`isEligibleForSend`) com `console.warn` e cai no fallback Mongoose filtrado
- [x] **Validação pré-browser (`job-runner`)**: `processJob` com `action:"send"` e `pdfUrl` vazio ou `recipientEmail` vazio → `throw` antes de `chromium.launch` com mensagem `"Contrato sem documento PDF anexado ou sem e-mail do destinatário."`, economizando Playwright
- [x] **Whitespace**: `hasValue(trim)` trata `originalUrl:"   "` e `email:"   "` como ausentes (Mongo `$ne:""` + memória `trim()`)
- [x] **Helper centralizado**: `contractEligibility.js` exporta `GERADO_ELIGIBLE_FILTER`, `hasPdf`, `hasRecipientEmail`, `isEligibleForSend`; 0 duplicação de objeto filtro (DRY)
- [x] **Regressão**: `npm test` 177 pass, schemas e rotas inalterados, compatibilidade com `.exe` legado preservada

### Correção de Referências do Diagnóstico
- **Versão**: `5.55.2` → `5.56.1` no changelog `STATE.md:119` (changelog `5.55.2` mantido como histórico; `5.56.1` é a versão corrente).
- **`roundcube.js:17` → `roundcube.js:19` (estável, anterior `17` pré-`logger`)**: `export function parseRoundcubeDate` agora em `roundcube.js:19` (com `import logger` deslocou +1); `roundcube.js:18` no diagnóstico anterior era off-by-one após adição do import — corrigido para `19`.
- **`imapClient.js:438` estável**: `const subjectMatches = !expectedSubject || ...` permanece em `imapClient.js:438`; filtro `!expectedSubject` permite `subjectFilter=""` desabilitar validação de assunto, documentado no JSDoc `408`.

### Cenários de Validação Executados (5.56.1)
- [x] **Paridade Roundcube** (`roundcube.js:179`): quando `!parsedDate` trata como recente (warn, não descarta) para não perder código no fallback; quando parse ok, valida `parsedDate < mfaTriggerTime - maxAgeMs` (default 10min), alinhado a `imapClient.js:451`.
- [x] **Expurgo `decodeQuotedPrintable` redundante** (`imapClient.js:81`): `return decoded.trim()` sem `decodeQuotedPrintable` extra — `decodeMimeHeader` já decodifica blocos `Q`/`B` via `getBufferEncoding`.
- [x] **Resiliência `job-runner.js`**: `mkdirSync` com `logger.warn` em falha de criação de diretório de sessão.
- [x] **Regressão**: 39 testes browser (`imapClient.test.js` + `roundcube.test.js`) + 160 globais passando.

---

## 13. Critérios de Validação — Trava de Concorrência (isRunning / Mutex) no Scheduler de Status (AD-045)

- **Data**: 2026-08-31
- **Status**: ✅ Concluído e Validado (190/190 testes de regressão passando: 134 backend + 56 robot)
- **Escopo**: Implementação de trava atômica `let isRunning = false` com liberação obrigatória via `try...finally` em `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`, prevenindo execuções simultâneas de Playwright e colisões no MongoDB.

### Cenários de Validação Executados (AD-045)
- [x] **Bloqueio de Concorrência Simultânea**: Quando `syncAllContractsStatus` é acionado enquanto `isRunning === true`, a função retorna imediatamente `{ success: true, checked: 0, updated: 0, downloaded: 0, status: "busy", reason: "already_running" }` sem instanciar novo browser.
- [x] **Liberação Garantida em Exceções (`try...finally`)**: Se `browserrobot.executeWithBrowser` ou operações de banco falharem, o bloco `finally` garante que `isRunning = false` seja redefinido, permitindo que ciclos subsequentes operem normalmente.
- [x] **Exposição do Helper de Introspecção**: Função `isStatusSyncRunning()` exportada em `statusSyncScheduler.js` e re-exportada em `seletorApiRobot/index.js` para monitoramento de estado em tempo real.
- [x] **Bypass e Early Exits**: Garantido reset de `isRunning` em todos os retornos antecipados (`mode !== "robot"`, `statusCheck === false`, `outside_working_hours`, `no_active_contracts`).
- [x] **Regressão e Cobertura**: 100% de aprovação na suíte de testes unitários e de integração dedicada (`tests/backend/services/statusSyncScheduler.test.js`) e rotas HTTP (`POST /api/robot-docusign/sync-status`).

---

## 14. Critérios de Validação — Anti-Phantom Success no Mapeamento de Status Padrão (AD-046)

- **Data**: 2026-08-31
- **Status**: ✅ Concluído e Validado (139/139 testes de backend passando)
- **Escopo**: Eliminação de transições de status arbitrárias para `"enviado"` quando a DocuSign retornar status desconhecido, rascunho (`draft`) ou vazio em `statusSyncScheduler.js`.

### Cenários de Validação Executados (AD-046)
- [x] **Retorno `null` para Status Desconhecidos/Rascunho**: `mapEnvelopeStatusToContractStatus("draft")`, `mapEnvelopeStatusToContractStatus("rascunho")`, `mapEnvelopeStatusToContractStatus("unknown")`, `mapEnvelopeStatusToContractStatus("")` retornam estritamente `null`.
- [x] **Mapeamento Preciso de Status Canônicos**: `completed`/`assinado`/`concluido` -> `assinado`; `declined`/`voided`/`expired`/`cancelado` -> `cancelado`; `sent`/`delivered`/`processing`/`enviado`/`entregue` -> `enviado`.
- [x] **Proteção de Integridade do Contrato no MongoDB**: Quando a DocuSign retorna status não reconhecido ou rascunho, o `statusSyncScheduler` não modifica o `status` do contrato no banco nem invoca sincronizações com o Gestor, mantendo o estado `gerado` intacto.

---

## 15. Critérios de Validação — Execução Consolidada de Testes de Regressão (AD-047)

- **Data**: 2026-08-31
- **Status**: ✅ Concluído e Validado (195/195 testes passando — 100% de sucesso)
- **Escopo**: Execução ponta a ponta de toda a suíte de testes de regressão do microsserviço RPA DocuSigner (`npm test` e `make test`), abrangendo robô standalone e backend.

### Cenários de Validação Executados (AD-047)
- [x] **Robô Standalone Playwright**: 56 testes passando em `tests/robot/browser/` (`docusign.test.js`, `imapClient.test.js`, `roundcube.test.js`, `selectors.test.js`), validando extração de MFA/IMAP socket direto, re-autenticação, paginação OneDS e proteção contra redirect duplo.
- [x] **Backend Controllers & Rotas HTTP**: 36 testes passando em `tests/backend/controllers/robotDocusignController.test.js` cobrindo todas as rotas da API REST (`/trigger`, `/trigger-batch`, `/status`, `/jobs`, `/metrics`, `/logs`, `/config`, `/test-login`, `/queue`, `/process-pending`, `/sync-status`).
- [x] **Backend Models**: 27 testes passando em `tests/backend/models/` (`RobotJob.test.js`, `RobotSession.test.js`).
- [x] **Backend Services & Schedulers**: 76 testes passando em `tests/backend/services/` (`gestorApiClient.test.js`, `imapClient.test.js`, `robotBrowser.test.js`, `robotSession.test.js`, `robotScheduler.test.js`, `statusSyncScheduler.test.js`).
- [x] **Isolamento de Timers Assíncronos**: Limpeza garantida de timeouts de inicialização (`initialTimeoutId`) nas rotinas `stop()` de `robotScheduler.js` e `statusSyncScheduler.js`, prevenindo vazamento de timers em background.
- [x] **Isolamento de Variáveis de Ambiente**: Configuração do ambiente de teste via `.env.dev` e injeção controlada de `process.env.ROBOT_API_KEY` para mock decoupling completo.
