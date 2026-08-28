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

### AD-020
- **Decision**: Bloco `mfa: { maxWaitMs: 90000, maxAgeMs: 600000 }` tipado no Zod `updateConfigSchema`, mesclado em `updateConfig`, repassado nos payloads de `getInstanceConfig`/`getNextJob` e lido via `credentials.mfa.*` em `docusign.js`.
- **Reason**: Respeitar SRP e PonyTail sem duplicar estado dentro de `credentials` ou `token_notification_email`, permitindo ajuste fino de timeouts MFA via API REST e propagação para o robô.
- **Trade-off**: N/A.
- **Scope**: `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`, `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`, `robot/src/browser/docusign.js`
- **Date**: 2026-08-28
- **Status**: active

> AD-001/002/003/004/005/006/007/012 eram órfãos do CRM `gestor-oportunidades` (soft delete, KPI cards, Phosphor, FilterBar, manual) — removidos deste repo. Histórico preservado em `CHANGELOG.md` + `git log` + `features/*/validation.md`. Visão/Diagrama/Fluxo movidos para `README.md` e `SPEC.md:8-60`.

## Handoff

- **Feature**: robot-docusigner / sub-specs/mfa-imap
- **Phase / Task**: T28 Done — Configurabilidade MFA e Fallback Roundcube Resiliente + Propagação REST API/Instância
- **Completed**: T01..T28 (incl. T27 timeout 90s/10min e T28 configurabilidade `mfa` em REST API, instâncias e robô) + Migração testes test/
- **In-progress**: none
- **Next step**: Próxima feature `robot-auto-provision-chromium` ou nova demanda
- **Blockers**: none
- **Branch**: main
