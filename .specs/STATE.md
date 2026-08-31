# STATE — Gestor de Oportunidades RPA DocuSigner

## Decisions

### AD-013
- **Decision**: Executáveis standalone com credenciais embutidas em bytecode V8 (esbuild → javascript-obfuscator → bytenode → @yao-pkg/pkg), sem `config.json` em texto plano.
- **Reason**: Evitar exposição de `ROBOT_EMAIL`/`ROBOT_PASS`/`ROBOT_ID` em disco nas máquinas dos agentes.
- **Trade-off**: Distribuição exige par inseparável `.exe` + `.jsc` na mesma pasta; debug mais difícil.
- **Scope**: `robot/build/build.js`, `robot/src/*`, pipeline de distribuição
- **Date**: 2026-08-17
- **Status**: active

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
- **Status**: active

### AD-017
- **Decision**: Build multi-chave — sem `--key`, varre `.env`/`.env.dev` por `ROBOT_API_KEY_\d+` e gera `robot-docusigner-N.exe` + `main-robot-docusigner-N.jsc` por chave.
- **Reason**: Distribuir lote de robôs sem invocar pipeline N vezes manualmente.
- **Trade-off**: Nomes sequenciais acoplados à ordem das envs.
- **Scope**: `robot/build/build.js`, `make build-robot`
- **Date**: 2026-08-17
- **Status**: active

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
- **Scope**: `.specs/features/docusign-agreements-query/`, `robot/src/browser/selectors.js`, `robot/src/browser/docusign.js`, `robot/src/job-runner.js`
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

## Handoff

- **Feature**: refactor/browserrobot-consolidation
- **Phase / Task**: Consolidação concluída — `sendStep.js` e `executeWithBrowserStep.js` removidos, `browserRobot.js` como fonte única de `send`/`executeWithBrowser`, `index.js` barrel puro
- **Completed**: AD-037 registrado, `browserRobot.js` validado como orquestrador único, deleções pendentes de commit
- **In-progress**: Aguardando commit/PR
- **Next step**: Commit, PR e merge em `main`
- **Blockers**: none
- **Branch**: refactor/browserrobot-consolidation


