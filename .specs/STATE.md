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

> AD-001/002/003/004/005/006/007/012 eram órfãos do CRM `gestor-oportunidades` (soft delete, KPI cards, Phosphor, FilterBar, manual) — removidos deste repo. Histórico preservado em `CHANGELOG.md` + `git log` + `features/*/validation.md`. Visão/Diagrama/Fluxo movidos para `README.md` e `SPEC.md:8-60`.

## Handoff

- **Feature**: robot-docusigner / makefile-mongosh-commands
- **Phase / Task**: Adição de comandos mongosh para consulta de jobs, instâncias e configs do robô no Makefile
- **Completed**: AD-021 + AD-022 + AD-023 + AD-024 + AD-025 + AD-026
- **In-progress**: Finalização de PR e merge
- **Next step**: Executar fluxo de commit e PR conforme regras
- **Blockers**: none
- **Branch**: feat/makefile-mongosh-robot-collections
