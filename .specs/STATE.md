# STATE — Gestor de Oportunidades RPA DocuSigner

## Decisions

### AD-013
- **Decision**: Executáveis standalone com credenciais embutidas (esbuild → javascript-obfuscator → @yao-pkg/pkg, sem `config.json` em texto plano; `bytenode/.jsc` removido — pipeline 3 etapas `esbuild→obfuscator→pkg`, `import bytenode` morto).
- **Reason**: Evitar exposição de `ROBOT_EMAIL`/`ROBOT_PASS`/`ROBOT_ID` em disco nas máquinas dos agentes.
- **Trade-off**: Distribuição é `.exe` self-contained + `node_modules/playwright` + `node_modules/playwright-core` ao lado + `setup.bat`/`run.bat`/`README.txt` por `dist/robot-<role>-N/` (sem par `.exe+.jsc`); debug mais difícil.
- **Scope**: `robot/build/build.js`, `robot/src/*`, pipeline de distribuição
- **Date**: 2026-08-17
- **Status**: active (atualizado pós AD-053 — removido bytenode/.jsc)

### AD-014
- **Decision**: Autenticação dual da instância — `X-Robot-Key` (SHA-256 vs `crm_acl.robot_api_keys`) com fallback legado `email`/`senha`; JWT `isRobot:true` 30 dias.
- **Reason**: Herdar cargo/permissões do `created_by` e rastrear `last_used_at`/`last_used_ip` por chave.
- **Trade-off**: Mantém codepath legado até migração completa.
- **Scope**: `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`, `POST /instance/auth`
- **Date**: 2026-08-17
- **Status**: active

### AD-015
- **Decision**: Dois componentes no mesmo repositório — Servidor Central (`backend/`, porta 3111) e Robô (`robot/` → `.exe`) comunicando via HTTP polling + heartbeat.
- **Reason**: Isolar fila/orquestração (servidor) de automação Playwright (robo) sem acoplar dependências.
- **Trade-off**: Monorepo exige `docker-compose` + pipeline de build separado.
- **Scope**: `backend/src/*`, `robot/*`, `docker-compose.yml`
- **Date**: 2026-08-17
- **Status**: active

### AD-016
- **Decision**: Build simplificado com 3 parâmetros (`--key`, `--api-url`, `--headless`); `instance_id` resolvido dinamicamente pelo servidor em `POST /instance/auth`.
- **Reason**: Reduzir superfície de `esbuild --define` e risco de credenciais hardcoded.
- **Trade-off**: Perde pinagem estática de `ROBOT_ID` no binário.
- **Scope**: `robot/build/build.js`, `robot/src/config.js`, `robot/src/main.js`
- **Date**: 2026-08-17
- **Status**: superseded by AD-053 (estendido para 4 params + --role, matriz N×R)

### AD-017
- **Decision**: Build multi-chave — sem `--key`, varre `.env`/`.env.dev` por `ROBOT_API_KEY_\d+` e gera `robot-docusigner-N.exe` + `main-robot-docusigner-N.jsc` por chave.
- **Reason**: Distribuir lote de robôs sem invocar pipeline N vezes manualmente.
- **Trade-off**: Nomes sequenciais acoplados à ordem das envs.
- **Scope**: `robot/build/build.js`, `make build-robot`
- **Date**: 2026-08-17
- **Status**: superseded by AD-053 (matriz N×R: ROBOT_API_KEY_N × role → robot-query-N / robot-update-N, sem .jsc)

### AD-018
- **Decision**: Extração headless de MFA via IMAP/TLS nativo (`node:tls`) com `token_notification_email` (`host`/`port`/`tls`/`email`/`password`), fallback Roundcube Webmail.
- **Reason**: ~1s vs 15-20s do Playwright + sem aba extra; detecção MFA por texto/seletores (`security_code`, `data-qa="verify-code"`).
- **Trade-off**: Requer credenciais IMAP válidas e tolerância de clock skew 30s.
- **Scope**: `robot/src/browser/imapClient.js`, `robot/src/browser/roundcube.js`, `robot/src/browser/docusign.js`, `PUT /api/robot-docusign/config`
- **Date**: 2026-08-27
- **Status**: active

### AD-021
- **Decision**: Remoção dos arquivos legados `test/helpers/env.js` e `test/helpers/setup.js` e migração do runner de testes para `--env-file=.env.dev` nativo do Node.js 24.
- **Reason**: Eliminar código morto e fallbacks hardcoded (`test_secret_key`, etc.) que mascaravam dados de `.env.dev`, alinhando os testes diretamente à fonte de verdade de desenvolvimento.
- **Trade-off**: N/A.
- **Scope**: `package.json`, `backend/package.json`, `test/**/*.test.js`, `.env.dev`
- **Date**: 2026-08-28
- **Status**: active

### AD-022
- **Decision**: Modelo de Conectividade Dual em Produção — Servidor Central Docker (`app_docusigner`) conecta diretamente ao MongoDB (`db_crm_funil` e `crm_contracts`) e valida chave no Gestor (`GESTOR_API_URL`), enquanto robôs clientes standalone (`.exe`) comunicam-se via HTTP com a API Central utilizando chave única `ROBOT_KEY` (`X-Robot-Key`).
- **Reason**: Isolar o acesso direto ao banco de dados na infraestrutura segura do servidor central, permitindo que robôs distribuídos em máquinas de operadores trabalhem sem portas abertas de banco nem credenciais de banco locais.
- **Trade-off**: Robôs dependem da disponibilidade e conectividade HTTP da API Central de Produção.
- **Scope**: `.env` de produção, `backend/src/server.js`, `robot/src/main.js`, `POST /api/robot-docusign/instance/auth`
- **Date**: 2026-08-28
- **Status**: active

### AD-023
- **Decision**: Sincronização do `Makefile` e ferramentas de diagnóstico (`tools/db-and-collection.js` e `tools/generate-routes-inventory.js`) adaptadas para o serviço de automação RPA DocuSigner.
- **Reason**: Padronizar comandos operacionais de Docker (`up-dev`, `up-prod`, `logs`), túnel SSH para MongoDB remoto (`tunnel`), diagnóstico de banco e coleções, coleta remota de screenshots de debug do robô (`fetch-robot-debug-images`) e geração/validação automatizada de documentação de rotas (`routes-inventory`).
- **Trade-off**: N/A.
- **Scope**: `Makefile`, `tools/db-and-collection.js`, `tools/generate-routes-inventory.js`, `.specs/routes-inventory.md`, `AGENTS.md`
- **Date**: 2026-08-28
- **Status**: active

### AD-024
- **Decision**: Reestruturação das variáveis e comandos SSH no `Makefile` com avaliação recursiva (`=`), defaults (`DEPLOY_HOST`, `DEPLOY_KEY`, `REMOTE_PROJECT_PATH`) carregados no topo e unificação de opções de conexão via `SSH_OPTS`.
- **Reason**: Evitar que `$(DEPLOY_HOST)` e flags de chave privada fossem expandidos como vazios na definição imediata (`:=`), garantindo execução confiável dos targets `db-and-collection-prod`, `tunnel` e `fetch-robot-debug-images`.
- **Trade-off**: N/A.
- **Scope**: `Makefile`, `.specs/STATE.md`
- **Date**: 2026-08-28
- **Status**: active

### AD-025
- **Decision**: Criação dos targets `ssh-uploads-prod` e `ls-uploads-prod` no `Makefile` apontando para `REMOTE_UPLOADS_PATH` (`/home/appuser/servidor-unity-rce/gestor-oportunidades/uploads`).
- **Reason**: Permitir acesso interativo direto e inspeção de pastas e arquivos de PDFs/documentos de clientes no servidor de produção com um único comando.
- **Trade-off**: N/A.
- **Scope**: `Makefile`, `AGENTS.md`, `.specs/STATE.md`
- **Date**: 2026-08-28
- **Status**: active

### AD-026
- **Decision**: Criação dos targets `mongosh-jobs`, `mongosh-jobs-prod`, `mongosh-instances`, `mongosh-instances-prod`, `mongosh-config` e `mongosh-config-prod` no `Makefile`.
- **Reason**: Prover comandos diretos e padronizados para inspecionar as coleções consumidas pelo robô (`crm_contracts.robot_jobs`, `crm_contracts.robot_instances` e `db_crm_funil.systemconfigs`) tanto em ambiente local quanto em produção via túnel SSH.
- **Trade-off**: N/A.
- **Scope**: `Makefile`, `AGENTS.md`, `.specs/STATE.md`
- **Date**: 2026-08-28
- **Status**: active

### AD-027
- **Decision**: Criação da especificação TLC Spec-Driven para a feature `docusign-agreements-query` cobrindo consulta paginada de acordos/documentos DocuSign via RPA, com filtro por representante (`Para:`), cálculo dinâmico de datas (5 dias atrás até hoje) e validação resiliente de status com alerta para status não mapeados.
- **Reason**: Automatizar a coleta e conciliação do status de envelopes diretamente na interface Web da DocuSign para o Gestor de Oportunidades.
- **Trade-off**: Depende da estabilidade dos seletores `data-qa="manage-envelopes-list.*"` da interface web do DocuSign.
- **Scope**: `.specs/features/servidor-robot/consulta-paginada-acordos/` + `.specs/features/servidor-robot/extracao-dados-oneds/` + `.specs/features/robot/consulta-acordos-navegador/`, `robot/src/browser/selectors.js`, `robot/src/browser/docusign.js`, `robot/src/job-runner.js`
- **Date**: 2026-08-28
- **Status**: active

### AD-028
- **Decision**: Modularização de `robot/src/browser/docusign.js` em submódulos de domínio (`statusParser.js`, `auth.js`, `envelopes.js`, `agreements.js`) mantendo `docusign.js` como Facade retrocompatível com exports nomeados e default.
- **Reason**: Atender estritamente aos princípios SOLID (SRP para auth/MFA, envelopes, agreements e status parser; OCP com regras declarativas em statusParser; DIP desacoplando MFA helpers) e PonyTail (remoção de import dinâmico de selectors e simplificação de fallbacks).
- **Trade-off**: N/A. Preservação 100% das assinaturas e contratos públicos consumidos por `job-runner.js` e backend.
- **Scope**: `robot/src/browser/*`, `robot/src/browser/docusign.js`
- **Date**: 2026-08-31
- **Status**: superseded by AD-030

> **Nota AD-028 → AD-030**: Facade com `default` removido em AD-030; apenas barrel named permanece.

### AD-029
- **Decision**: Correção do regex de asserção de persistência de autenticação em `tests/robot/browser/docusign.test.js` e padronização dos scripts de teste nos manifests `package.json` para o diretório `tests/` (plural).
- **Reason**: Garantir 100% de cobertura e aprovação na suíte de testes de regressão nativa (`node --test`) executada via `npm test` sem intermediários ou sobre-engenharia (*PonyTail*).
- **Trade-off**: N/A.
- **Scope**: `package.json`, `backend/package.json`, `robot/package.json`, `tests/robot/browser/docusign.test.js`, `AGENTS.md`
- **Date**: 2026-08-31
- **Status**: active

### AD-030
- **Decision**: Simplificação do Facade `robot/src/browser/docusign.js` para barrel de re-exports diretos (`export { } from`) com remoção do objeto `docusignFacade` e `export default` morto (0 consumidores — `job-runner.js:4` e `robotBrowser.js:327` usam apenas named imports, validado via grep).
- **Reason**: Ponytail rung 6 — 44L → 11L (-38L, -75%), eliminar import intermediário + objeto redundante mantendo identidade referencial 10/10 e 100% compatibilidade de assinaturas.
- **Trade-off**: Perde `default` import; reintroduzir quando `.exe` legado exigir (YAGNI).
- **Scope**: `robot/src/browser/docusign.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-031
- **Decision**: Refatoração modular de `backend/src/modules/robot-docusign/services/robotBrowser.js` em micro-etapas atômicas localizadas em `backend/src/modules/robot-docusign/services/steps/` (`stepUtils.js`, `authStep.js`, `uploadDocumentStep.js`, `fillRecipientStep.js`, `fillMessageStep.js`, `submitEnvelopeStep.js`, `extractEnvelopeIdStep.js`, `statusStep.js`, `downloadStep.js`, `resendStep.js`, `reportsStep.js`, `retryStep.js`).
- **Reason**: Aplicação estrita dos princípios SOLID (Single Responsibility Principle) e PonyTail, modularizando o pipeline de envio e desacoplando funções de automação Playwright em etapas lineares e testáveis com preservação de 100% de retrocompatibilidade para os chamadores.
- **Trade-off**: Criação de subdiretório `steps/` para abrigar a granularidade das ações.
- **Scope**: `backend/src/modules/robot-docusign/services/robotBrowser.js`, `backend/src/modules/robot-docusign/services/steps/*`
- **Date**: 2026-08-31
- **Status**: active

### AD-032
- **Decision**: Hardening pós-AD-031 dos steps modulares do robô com eliminação de falsos-positivos/sucessos fantasmas (`extractEnvelopeId`, `submit`, `status`, `download`, `resend`), cache leve de seletores por `mtime`, desacoplamento de `agreementsService.js` no backend nativo, e retry seletivo com backoff exponencial.
- **Reason**: Garantir resiliência, segurança (prevenção contra path traversal e redirects silenciosos) e eliminar import cruzado em runtime (`backend→robot/`) em conformidade com AD-015 e os princípios SOLID/PonyTail.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/services/steps/*`, `backend/src/modules/robot-docusign/services/robotBrowser.js`, `backend/src/modules/robot-docusign/services/robotSelectors.js`, `backend/src/modules/robot-docusign/services/agreementsService.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-033
- **Decision**: Desacoplamento e simplificação do `robotOrchestrator.js` com extração de `contractSyncService.js`, encapsulamento do ciclo de vida do Playwright em `robotBrowser.executeWithBrowser` e eliminação de queries de concorrência redundantes no orquestrador.
- **Reason**: Aplicação rigorosa dos princípios SOLID (SRP isolando persistência externa e DIP desacoplando o browser) e PonyTail (eliminação de sobre-engenharia, redução de linhas de 622 para ~410 e eliminação de loops com setTimeout bloqueante).
- **Trade-off**: N/A. Preservação 100% dos contratos e exports consumidos por controllers e scheduler.
- **Scope**: `backend/src/modules/robot-docusign/services/robotOrchestrator.js`, `backend/src/modules/robot-docusign/services/robotBrowser.js`, `backend/src/modules/robot-docusign/services/contractSyncService.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-034
- **Decision**: Centralização de `LOGIN_URL_REGEX`/`isLoginUrl` em `backend/src/modules/robot-docusign/browserrobot/loginUrl.js` como fonte única (barrel em `services/loginUrl.js` para retrocompatibilidade); `browserrobot/steps/stepUtils.js` re-exporta e `browserrobot/robotSession.js` importa direto, eliminando duplicação e divergência `/login`/`/password`.
- **Reason**: Corrigir C1 do hardening (regex divergente e claim falso de unicidade), quebrar ciclo `stepUtils↔robotSession` e garantir paridade futura via módulo sem dependências.
- **Trade-off**: Novo arquivo de 11L em `browserrobot/`; `services/` mantém barrels para compatibilidade com `agreementsService`/`authStep`.
- **Scope**: `backend/src/modules/robot-docusign/browserrobot/loginUrl.js`, `backend/src/modules/robot-docusign/services/loginUrl.js`, `backend/src/modules/robot-docusign/browserrobot/steps/stepUtils.js`, `backend/src/modules/robot-docusign/services/steps/stepUtils.js`, `backend/src/modules/robot-docusign/browserrobot/robotSession.js`, `tests/backend/services/robotBrowser.test.js`
- **Date**: 2026-08-31
- **Status**: active

> **Nota AD-034 → AD-035**: Fonte canônica migrada de `services/loginUrl.js` para `browserrobot/loginUrl.js` em AD-035; `services/` convertido em barrel.
### AD-035
- **Decision**: Decomposição estrutural do domínio `robot-docusign/` em dois submódulos de alta coesão: `browserrobot/` (automação Playwright, steps, sessões, acordos, seletores) e `seletorApiRobot/` (orquestração, seleção de modo, apiActionService, config, eventos, scheduler, contractSyncService), padronização de queries Mongoose e conversão integral de `services/steps/` e `services/*.js` em barrels de re-exportação (DRY/PonyTail).
- **Reason**: Aplicação plena dos princípios SOLID (SRP, ISP e DIP com isolamento absoluto entre infraestrutura de navegador e orquestração de negócios) e PonyTail (zero sobre-engenharia, zero duplicação de lógica e 100% de retrocompatibilidade com controllers e testes).
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/browserrobot/*`, `backend/src/modules/robot-docusign/seletorApiRobot/*`, `backend/src/modules/robot-docusign/services/*`, `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`, `backend/src/modules/robot-docusign/index.js`, `README.md`
- **Date**: 2026-08-31
- **Status**: active

> AD-001/002/003/004/005/006/007/012 eram órfãos do CRM `gestor-oportunidades` (soft delete, KPI cards, Phosphor, FilterBar, manual) — removidos deste repo. Histórico preservado em `CHANGELOG.md` + `git log` + `features/*/validation.md`. Visão/Diagrama/Fluxo movidos para `README.md` e `SPEC.md:8-60`.

### AD-036
- **Decision**: Refatoração de `backend/src/modules/robot-docusign/browserrobot/index.js` para barrel puro seguindo o padrão de imports atômicos do `main_robot.py`. Centralização das atividades do navegador e orquestração do pipeline de envio (`send` e `executeWithBrowser`) em `backend/src/modules/robot-docusign/browserrobot/browserRobot.js`. O `index.js` atua exclusivamente como fachada e barrel puro re-exportando as operações.
- **Reason**: Aplicação estrita do padrão de pipeline modular (PonyTail + SRP): nenhuma lógica procedural de ciclo de vida do navegador vive no `index.js`, centralizando a orquestração do browser em `browserRobot.js` e mantendo `index.js` limpo com 100% de compatibilidade.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/browserrobot/index.js`, `backend/src/modules/robot-docusign/browserrobot/browserRobot.js`
- **Date**: 2026-08-31
- **Status**: superseded by AD-037

> **Nota AD-036 → AD-037**: `steps/sendStep.js` e `steps/executeWithBrowserStep.js` consolidados em `browserRobot.js`; barrel `index.js` mantido puro.

### AD-037
- **Decision**: Consolidação de `backend/src/modules/robot-docusign/browserrobot/steps/sendStep.js` e `steps/executeWithBrowserStep.js` em `backend/src/modules/robot-docusign/browserrobot/browserRobot.js`; exclusão dos steps intermediários e manutenção de `browserrobot/index.js` como barrel puro (`send`, `executeWithBrowser`, `status`, `download`, `resend`, `reports`, `queryAgreements`, `withRetry`).
- **Reason**: PonyTail rungs 2/6 — eliminar duplicação/indireção: `browserRobot.js` já centralizava o ciclo de vida Playwright e pipeline `send`; steps separados eram fachadas finas sem reuso externo. Redução de 2 arquivos (-184 linhas) com 100% de compatibilidade de assinatura validada via `git log --name-status` e `browserRobot.test`.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/browserrobot/browserRobot.js`, `backend/src/modules/robot-docusign/browserrobot/index.js`, `backend/src/modules/robot-docusign/browserrobot/steps/*`
- **Date**: 2026-08-31
- **Status**: active

### AD-038
- **Decision**: Filtro centralizado de elegibilidade de contratos para envio DocuSign via helper `backend/src/modules/robot-docusign/utils/contractEligibility.js` (`GERADO_ELIGIBLE_FILTER` + `hasPdf`/`hasRecipientEmail`/`isEligibleForSend` com `trim()`), aplicado em `robotInstanceController.getNextJob` (pós-validação com revert `em_processamento_robot`→status original) e `robot/src/job-runner.js` (validação `pdfUrl`+`recipientEmail` antes de `chromium.launch`).
- **Reason**: Evitar jobs falhos, lock ocioso e abertura de Playwright para contratos legados sem `documents.originalUrl` ou sem e-mail do destinatário; manter contrato em `gerado` para retry quando PDF/e-mail forem anexados, economizando ~2s + 300 MB por job inválido.
- **Trade-off**: Filtro Mongo `$ne:""` não cobre whitespace — coberto por `hasValue(trim)` em memória; índice parcial `{status:1,"documents.originalUrl":1}` pendente para alto volume.
- **Scope**: `backend/src/modules/robot-docusign/utils/contractEligibility.js`, `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`, `backend/src/modules/robot-docusign/seletorApiRobot/robotScheduler.js`, `robot/src/job-runner.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-039
- **Decision**: Correção do bug de sobrescrita da chave `$or` em `RobotJob.findOneAndUpdate` no endpoint `GET /api/robot-docusign/instance/next-job` (`robotInstanceController.js`) agrupando os filtros de status e lock dentro de `$and: [ { $or: ... }, { $or: ... } ]`, e adição de logs explicativos de polling no robô desktop (`robot/src/scheduler.js`).
- **Reason**: No JavaScript, duas chaves `$or` no mesmo objeto faziam a segunda sobrescrever a primeira, ignorando o filtro de status `pending`/`retrying` e puxando jobs legados já concluídos, bloqueando a fila de processamento local.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`, `robot/src/scheduler.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-040
- **Decision**: Sincronização do modo do robô como única fonte da verdade (`enabled: robotConfig.mode === "robot"`) em `getInstanceConfig`, sincronização do `DEFAULT_ROBOT_DOCUSIGN_CONFIG` com `enabled: true, mode: "robot"`, inclusão de schemas Zod para `operations` e `schedule` em `updateConfigSchema`, e validação granular da flag `operations.send !== false` no orquestrador (`shouldUseRobot`), no scheduler periódico (`robotScheduler.js`), no lock de jobs (`getNextJob`) e no cliente frontend (`docusignService.js`).
- **Reason**: Evitar falso-negativo no robô cliente em .exe quando registros legados no MongoDB continham `enabled: false` apesar de `mode: "robot"`, e garantir que administradores possam desabilitar individualmente operações de envio sem que o robô continue capturando contratos `gerado`.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/seletorApiRobot/orchestratorConfig.js`, `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`, `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`, `backend/src/modules/robot-docusign/seletorApiRobot/robotScheduler.js`, `backend/src/modules/robot-docusign/seletorApiRobot/index.js`, `gestor-oportunidades/public/modules/contratos/services/docusignService.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-041
- **Decision**: Segregação do Robô DocuSign em duas rotinas independentes: (1) Consulta periódica geral de status (`statusSyncScheduler.js`), consumindo `schedule.intervalMinutes` (5 a 30 min), varrendo contratos ativos não-rascunhos na DocuSign, atualizando diretamente o schema `Contract` (uma única vez para status finais/irreversíveis), baixando automaticamente PDFs de contratos assinados e emitindo notificações via SSE; (2) Envio sob demanda estritamente síncrono acionado pelo botão do frontend (`triggerJob`), removendo o envio automático de contratos `gerado` de `robotScheduler.js`.
- **Reason**: Atender aos requisitos operacionais do CRM Funil / Gestor de Oportunidades, eliminando envios não autorizados de contratos e garantindo conciliação periódica autônoma de status e arquivamento automático de PDFs assinados.
- **Trade-off**: N/A. Preservação de todos os endpoints, seletores DOM e contratos de API legados.
- **Scope**: `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`, `backend/src/modules/robot-docusign/services/statusSyncScheduler.js`, `backend/src/modules/robot-docusign/seletorApiRobot/robotScheduler.js`, `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`, `backend/src/modules/robot-docusign/routes.js`, `backend/src/modules/robot-docusign/seletorApiRobot/index.js`, `backend/src/server.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-042
- **Decision**: Extração direta do UUID (`envelopeId`) a partir do atributo `data-qa` da tag `<tr>` (`manage-envelopes-list.row.<UUID>`) e captura do `subject` a partir de `button[data-qa$='-mobile-name']` e `[data-qa$='-mobile-name-text']` com fallbacks para `href` de `<a>` e seletores legados.
- **Reason**: Adequação à arquitetura moderna OneDS do DocuSign, que não utiliza mais links `<a>` com `href` para navegação nos envelopes, evitando retorno de `envelopeId: null` e assunto vazio durante a conciliação de acordos.
- **Trade-off**: N/A. Totalmente retrocompatível com mocks e páginas legadas.
- **Scope**: `backend/src/modules/robot-docusign/browserrobot/agreementsService.js`, `robot/src/browser/agreements.js`, `backend/src/modules/robot-docusign/browserrobot/robotSelectors.js`, `robot/src/browser/selectors.js`, `tests/robot/browser/docusign.test.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-043
- **Decision**: Refinamento do seletor de linhas da tabela de acordos para `tbody[data-qa='manage-envelopes-list.body'] tr, tr[data-qa^='manage-envelopes-list.row.']`.
- **Reason**: Evitar que a busca por `[data-qa='manage-envelopes-list.table'] tr` capture a linha do cabeçalho `<thead>` (`manage-envelopes-list.header.row`), eliminando iteração com registro nulo no início da tabela.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/browserrobot/agreementsService.js`, `robot/src/browser/agreements.js`, `robot/src/browser/selectors.js`, `tests/robot/browser/selectors.test.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-044
- **Decision**: Correção do seletor de fallback da coluna de destinatário em `extractEnvelopesFromCurrentPage` para `td:nth-child(2) [data-qa$='-mobile-from']` e `td:nth-child(2)` (anteriormente apontando para a 3ª coluna de status `td:nth-child(3)`), e sanitização dos prefixos de interface `"Para:"` e `"To:"` através de `replace(/^(para|to):\s*/i, "").trim()`.
- **Reason**: Evitar falsos negativos na comparação com o representante do filtro e garantir que o campo `recipient` retornado contenha apenas o nome limpo do destinatário sem prefixos visuais da UI.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/browserrobot/agreementsService.js`, `robot/src/browser/agreements.js`, `tests/robot/browser/docusign.test.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-045
- **Decision**: Adição de trava de concorrência atômica `let isRunning = false` com checagem antecipada (retornando `{ status: "busy", reason: "already_running" }`) e liberação garantida no bloco `try ... finally { isRunning = false; }` dentro de `syncAllContractsStatus` (`statusSyncScheduler.js`), além de exposição do helper `isStatusSyncRunning()`.
- **Reason**: Evitar execuções simultâneas do Playwright quando uma consulta demorar mais que o intervalo periódico configurado ou quando a rota `POST /api/robot-docusign/sync-status` for disparada concomitantemente, impedindo invalidação de sessão na DocuSign e race conditions no MongoDB.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`, `backend/src/modules/robot-docusign/seletorApiRobot/index.js`, `tests/backend/services/statusSyncScheduler.test.js`, `tests/backend/controllers/robotDocusignController.test.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-046
- **Decision**: Eliminação de coerção arbitrária no mapeamento de status em `statusSyncScheduler.js` (`mapEnvelopeStatusToContractStatus`), retornando `null` para status desconhecidos, vazios, rascunhos ou inesperados em vez de `"enviado"`, prevenindo alterações indevidas de estado nos contratos do MongoDB (Princípio Anti-Phantom Success).
- **Reason**: Anteriormente, a cláusula `default:` retornava `"enviado"`, fazendo com que envelopes em rascunho (`draft`) ou retornos vazios/desconhecidos da DocuSign forçassem contratos em estado `gerado` para `enviado` sem envio real.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`, `tests/backend/services/statusSyncScheduler.test.js`
- **Date**: 2026-08-31
- **Status**: active

### AD-047
- **Decision**: Adição do rastreamento e limpeza de `initialTimeoutId` na função `stop()` dos agendadores `robotScheduler.js` e `statusSyncScheduler.js`, injeção explícita de `process.env.ROBOT_API_KEY` na suíte de testes de `statusSyncScheduler.test.js` e criação do arquivo `.env.dev` com parâmetros padrão de desenvolvimento e testes.
- **Reason**: Eliminar vazamento de callbacks assíncronos (`setTimeout` órfãos) que disparavam consultas de banco de dados em segundo plano após o término dos testes, garantindo 100% de isolamento, idempotência e aprovação dos 195 testes da suíte completa de regressão (`npm test`).
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`, `backend/src/modules/robot-docusign/seletorApiRobot/robotScheduler.js`, `tests/backend/services/statusSyncScheduler.test.js`, `.env.dev`
- **Date**: 2026-08-31
- **Status**: active

### AD-048
- **Decision**: Declaração explícita das propriedades `envelopeId` e `docusign_envelope_id` (`{ type: String, default: null }`) no schema Mongoose de `Contract` (`backend/src/models/Contract.js`), tipagem estática via `@typedef {ContractDocument}` JSDoc, e criação de suíte unitária/regressão em `tests/backend/models/Contract.test.js`.
- **Reason**: Permitir a persistência e atualização correta de `envelopeId` em `statusSyncScheduler.js` e queries sem descarte silencioso em virtude do modo `strict: true` padrão do Mongoose.
- **Trade-off**: N/A. Total compatibilidade com o schema legado e banco `crm_contracts`.
- **Scope**: `backend/src/models/Contract.js`, `tests/backend/models/Contract.test.js`, `.specs/database/schema.md`, `.specs/STATE.md`
- **Date**: 2026-08-31
- **Status**: active

### AD-049
- **Decision**: Aplicação das correções dos itens 8 ao 14 da revisão de código: (a) Remoção de escrita dupla em `statusSyncScheduler.js` centralizando atualização em `syncContractStatus`, (b) Verificação prévia de existência de PDF e Anti-Phantom Success (`stat.size > 0`) no download de arquivos, (c) Proteção de endpoints contra `CastError` no Mongoose em `robotDocusignController.js` validando `ObjectId.isValid`, (d) Retorno de `HTTP 500` em falhas operacionais em `POST /sync-status`, (e) Proteção RBAC via `authorize("admin")` em `POST /sync-status` e `POST /process-pending`, (f) Implementação de Graceful Shutdown em `server.js` (`SIGINT`/`SIGTERM`) encerrando schedulers, servidor HTTP e conexão com MongoDB, e (g) Aplicação estrita de JSDoc em todos os métodos e módulos modificados.
- **Reason**: Garantir integridade dos dados e arquivos baixados, eliminar concorrência e race conditions, proteger endpoints administrativos sensíveis e evitar processos e sockets órfãos no desligamento/reinício do servidor.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`, `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`, `backend/src/modules/robot-docusign/routes.js`, `backend/src/server.js`, `backend/src/modules/robot-docusign/utils/contractEligibility.js`, `.specs/routes-inventory.md`, `.specs/STATE.md`
- **Date**: 2026-08-31
- **Status**: active

### AD-050
- **Decision**: Envio 100% sob demanda — removido auto-enfileiramento de `Contract` em `robotInstanceController.getNextJob`; `getNextJob` e `robotScheduler` apenas consomem `RobotJob` existente (`pending`/`retrying`), criação exclusiva via `POST /trigger`.
- **Reason**: Evitar disparo automático sem clique no botão Enviar; envio automático causava envio não autorizado.
- **Scope**: `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
- **Date**: 2026-09-01
- **Status**: active

### AD-051
- **Decision**: Hardening do filtro de contratos elegíveis com blocklist estrita (`$nin: ["rascunho", "enviado", "assinado", "cancelado", "em_processamento_robot"]`), proteção contra status nulos/ausentes e `Object.freeze` em `contractEligibility.js`; adição de `"em_processamento_robot"` ao enum de `Contract.js`; persistência de `originalStatus` pré-lock em `RobotJob` e restauração fiel no fallback de `robotInstanceController.js` (`getNextJob` e `updateJobStatus`); centralização do import de filtro em `tools/check-pending-jobs.js` com projeção de campos otimizada.
- **Reason**: Eliminar risco de loops de reprocessamento e reenvios indevidos no DocuSign para contratos finalizados (B1), garantir conformidade do schema Mongoose e evitar rebaixamento forçado para "gerado" em falhas (B2), eliminar duplicações de código (M2), garantir imutabilidade de referências (M3) e otimizar consumo de memória na CLI.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/utils/contractEligibility.js`, `backend/src/models/Contract.js`, `backend/src/modules/robot-docusign/models/RobotJob.js`, `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`, `tools/check-pending-jobs.js`, `tests/backend/regression/eligibleContractsRegression.test.js`, `.specs/features/servidor-robot/contratos-elegiveis/*`
- **Date**: 2026-08-31
- **Status**: active

### AD-052
- **Decision**: Padronização do valor inicial padrão do intervalo de agendamento de consulta geral de status (`schedule.intervalMinutes`) para 5 minutos em `orchestratorConfig.js` (`DEFAULT_ROBOT_DOCUSIGN_CONFIG`) e `statusSyncScheduler.js` (fallback interno `intervalMinutes || 5`), mantendo suporte total à sobrescrita dinâmica via `SystemConfig` (`key: "robot_docusign"`).
- **Reason**: Prover sincronização mais frequente e responsiva de status dos contratos e download automático de PDFs assinados no boot e na operação contínua sem depender de configurações manuais prévias.
- **Trade-off**: N/A. Total compatibilidade com a configuração customizada no painel administrativo.
- **Scope**: `backend/src/modules/robot-docusign/seletorApiRobot/orchestratorConfig.js`, `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`, `.specs/STATE.md`, `.specs/features/servidor-robot/trava-concorrencia-periodica/*`
- **Date**: 2026-09-01
- **Status**: active

### AD-053
- **Decision**: Segregação dual-robot query/update — `RobotInstance.role` (`query|update|all`, default `all`, index), `RobotJob.action` `query_agreements` com `contract_id` condicional (alias) e índice `{status:1,action:1,lock_expires_at:1,createdAt:1}`; `getNextJob` filtra por `role` (`query=[status,query_agreements,reports,download]`, `update=[send,resend]`, `all=*`); `auth`/`heartbeat` persistem `role` (400 se inválido) e expõem `instances_by_role`; `statusSyncScheduler` enfileira `query_agreements` idempotente quando query robot com `last_heartbeat>60s` senão fallback `executeWithBrowser`; `updateJobStatus` reconcilia batch `result.envelopes`; `robot/src` com `ROBOT_ROLE`/`--role`, sessões `session-query/update.json`, `JobRunner` guard por `allowedActions` antes de `chromium.launch`, entrypoints `main-query.js`/`main-update.js` wrappers 3L; pipeline `robot/build/build.js` matriz `ROBOT_API_KEY_N × role` → `dist/robot-query-N/` e `dist/robot-update-N/` com `define ROBOT_ROLE` e `run.bat` por papel; `Makefile` `ROLE=query|update|all` + `robot/package.json` `build:robot:query|update|all`. Uma chave por robô.
- **Reason**: Isolar varredura paginada (`view=agreements`) de envio transacional, mitigar corrupção de `storageState` e starvation, permitir deploy dedicado por máquina/processo com monitoramento por frota.
- **Trade-off**: Dobra artefatos de build (N×2) e disco; compatibilidade `all` mantida para migração gradual; `dist/robot-docusigner` legado como alias quando `role=all`.
- **Scope**: `backend/src/modules/robot-docusign/models/*`, `backend/src/modules/robot-docusign/controllers/*`, `backend/src/modules/robot-docusign/seletorApiRobot/*`, `robot/src/*`, `robot/build/build.js`, `robot/package.json`, `Makefile`, `.specs/routes-inventory.md`
- **Date**: 2026-09-01
- **Status**: active

### AD-054
- **Decision**: Hardening pós-AD-053 — (1) `ROLE_ACTIONS` centralizado em `backend/.../utils/roleActions.js` (`ROLE_ENUM`, `ROLE_ACTIONS`, `getAllowedActions`, `isActionAllowedForRole`) e clone isolado `robot/src/utils/roleActions.js` (offline .exe) consumido por `robotInstanceController.getNextJob` e `JobRunner`; (2) `normalizeString` extraído para `backend/.../utils/normalizeString.js` (NFD/acento/caixa) reaproveitado em `seletorApiRobot/statusSyncScheduler.js` e `robotInstanceController` (reconciliação e-mail/nome) com re-export para compat; (3) `requireJwtSecret()` fail-hard: `JWT_SECRET` ausente em `NODE_ENV=production` aborta `jwt.sign` (`controller.js:148,222`), dev mantém `default_jwt_secret_dev`; (4) reconciliação `updateJobStatus` paritária AD-053: após `syncContractStatus` para `assinado` com `envelopeId` faz auto-download via `buildDownloadPath` + `browserrobot.executeWithBrowser("download")` com `exists+size>0` e `operations.download!==false` (parity com `statusSyncScheduler`); (5) fachadas `services/statusSyncScheduler.js` e `services/robotScheduler.js` documentadas como Facade DIP (canônico `seletorApiRobot/*`); (6) `JobRunner` guard `ROLE_MISMATCH` `code/nonRetriable` antes de `chromium.launch` com `failed [ROLE_MISMATCH]` sem retry; (7) `build.js` `bundleBase` legacy `robot-docusigner` vs `robot-{query|update}` documentado para migração `all→robot-all`.
- **Reason**: SOLID DRY/SRP/OCP/DIP e anti-falha: single source para role/normalize, JWT não assina com default em prod, paridade download evita órfãos assinados, guard evita retentar mismatch, barrel esclarece fonte canônica.
- **Trade-off**: Duplicação lógica `roleActions` entre backend/robot por isolamento runtime (sync manual).
- **Scope**: `backend/src/modules/robot-docusign/utils/roleActions.js`, `backend/src/modules/robot-docusign/utils/normalizeString.js`, `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`, `backend/src/modules/robot-docusign/seletorApiRobot/statusSyncScheduler.js`, `backend/src/modules/robot-docusign/services/*.js`, `robot/src/utils/roleActions.js`, `robot/src/job-runner.js`, `robot/build/build.js`, `.specs/database/schema.md`, `.specs/routes-inventory.md`, `AGENTS.md`
- **Date**: 2026-09-01
- **Status**: active

### AD-055
- **Decision**: Correção de compatibilidade no pipeline de build do robô standalone (`robot/build/build.js`, `robot/src/main.js`, `robot/src/main-query.js`, `robot/src/main-update.js`): (1) Execução incondicional de `bootstrap()` no final de `src/main.js` garantindo inicialização imediata no runtime `.exe` do `@yao-pkg/pkg`; (2) Invocação `bootstrap("query")` e `bootstrap("update")` nos launchers locais sem `await import()` dinâmico; (3) Apontamento de `entryFile` diretamente para `src/main.js` no `build.js` para compilação via `esbuild --format=cjs`.
- **Reason**: `esbuild` com target CJS bloqueava a compilação por falta de suporte a *top-level await* em `await import("./main.js")`, e a verificação `process.argv[1].endsWith("main.js")` impedia a inicialização dentro dos executáveis empacotados.
- **Trade-off**: N/A. Preserva a execução via CLI local e o empacotamento automatizado dos executáveis standalone.
- **Scope**: `robot/src/main.js`, `robot/src/main-query.js`, `robot/src/main-update.js`, `robot/build/build.js`, `.specs/STATE.md`
- **Date**: 2026-09-01
- **Status**: active

## Handoff

- **Feature**: robot/dois-robos-consulta-atualizacao + Makefile runners + build bootstrap fix
- **Phase / Task**: T1-T11 + AD-054/AD-055 (Feature Completa + Makefile runners + Bootstrap Fix)
- **Completed**: Dual-robot (AD-053), hardening (AD-054), build fix com bootstrap incondicional (AD-055), adição de `make execute-robot`, `make execute-robot-query` e `make execute-robot-update` no `Makefile` e documentação no `AGENTS.md`.
- **In-progress**: nenhum
- **Next step**: Pronto para commit, PR, merge e build
- **Blockers**: none
- **Branch**: main


