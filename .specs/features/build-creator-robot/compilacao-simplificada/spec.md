# Build Robots Specification

## Problem Statement

O build legado do robot aceitava 6 parâmetros (`ids`, `keys`, `emails`, `passwords`, `headless`, `api-url`), mas a maioria era redundante. `ROBOT_ID` é gerado pelo server a partir de `key_prefix`, e `ROBOT_EMAIL`/`ROBOT_PASS` nunca eram lidos. Com AD-053 a segregação dual-robot introduziu `ROBOT_ROLE` (`query|update|all`) com sessões isoladas (`session-query.json` / `session-update.json`) e pipeline matriz `N×R`.

## Goals

- [x] Reduzir parâmetros legados de 6 para 4 (`--key`, `--api-url`, `--headless`, `--role`)
- [x] Eliminar `ROBOT_ID` do código do robô (server gera `instance_id` na auth)
- [x] Eliminar `ROBOT_EMAIL` e `ROBOT_PASS` (nunca são lidos)
- [x] Suportar segregação por papel `ROBOT_ROLE` com entrypoints dedicados (`main-query.js` / `main-update.js`) e `DOCUSIGN_SESSION_PATH` role-aware
- [x] Pipeline matriz `ROBOT_API_KEY_N × role` → `dist/robot-query-N/` e `dist/robot-update-N/` (alias `robot-docusigner-N` quando `role=all`)
- [x] Remover etapa `bytenode/.jsc` — distribuição é `.exe` self-contained + `node_modules/playwright` ao lado (AD-013 atualizado)
- [x] Manter compatibilidade com fluxo de autenticação existente

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mudanças no gestor-oportunidades | Fluxo de geração de chave já existe |
| Elegibilidade de contratos / MFA IMAP | Ver `robot/dois-robos-consulta-atualizacao` e AD-038/050 |

> Multi-robot por chave (matriz `ROBOT_API_KEY_N × role`) é escopo desta spec — ver `robot/dois-robos-consulta-atualizacao` (AD-053) para roteamento backend.

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|----------------------|---------------|-----------|------------|
| `ROBOT_ID` pode ser eliminado | Server gera de `key_prefix` | Controller já faz fallback | y |
| `HEADLESS` e `ROBOT_ROLE` embutidos via `--define` | `--define:process.env.HEADLESS` e `--define:process.env.ROBOT_ROLE` no esbuild | Segurança (chave+papel fixos no binário) + impede troca de papel em runtime; matriz gera artefato por papel | y |
| Chave continua embutida no build | 1 `.exe` por `(chave, role)` — matriz `N×R` | Mais seguro, sem arquivo exposto; `N` chaves × 2 papéis = `2N` artefatos quando `ROLE=all` | y |
| Pipeline sem `bytenode/.jsc` | `esbuild → javascript-obfuscator → @yao-pkg/pkg` (3 etapas) + `import bytenode` morto removido | `.jsc` exigia par inseparável `.exe+.jsc`; `.exe` self-contained simplifica distribuição | y |
| Sessões isoladas por papel | `sessionByRole = {query: session-query.json, update: session-update.json, all: session-docusign.json}` | Evita corrupção de storageState quando ambos papéis rodam na mesma máquina | y |

**Open questions:** none

---

## User Stories

### P1: Build simplificado com key, API_URL, headless e role ⭐ MVP

**User Story**: Como desenvolvedor, quero gerar o build com `--key`, `--api-url`, `--headless` e `--role`, para que o processo seja simples, seguro e gere artefatos por papel.

**Why P1**: Reduz complexidade, elimina credenciais desnecessárias, suporta deploy dedicado query/update.

**Acceptance Criteria**:

1. WHEN `node build/build.js --key "rf_xxxxx" --api-url "http://localhost:3111" --role query` é executado THEN o build SHALL gerar `dist/robot-query-1/robot-query-1.exe` (sem `.jsc`) + `run.bat` + `README.txt` + `node_modules/` ao lado
2. WHEN `--role all` (ou omitido) é usado THEN o build SHALL gerar matriz `2N` artefatos (`robot-query-N` + `robot-update-N`); alias legado `robot-docusigner-N` preservado quando `role=all`
3. WHEN o build é executado sem `--key` e sem `ROBOT_API_KEY_N` no env THEN o build SHALL retornar erro e abortar
4. WHEN o build é executado sem `--api-url` THEN o build SHALL usar `http://localhost:3111` como padrão (sanitiza trailing slash)
5. WHEN `--headless false` é passado THEN o build SHALL embutir `HEADLESS=false` via `--define`
6. WHEN `--headless` não é passado THEN o build SHALL usar `true` como padrão
7. WHEN `--role` é `query|update|all` THEN o build SHALL usar `entryFile` correspondente (`main-query.js` / `main-update.js` / `main.js`), `define ROBOT_ROLE` e `run.bat` com título por papel (`[DocuSign RPA] - Consulta #N`)
8. WHEN `--role` inválido é passado THEN o build SHALL fazer fallback para `all` (ou manter `ROBOT_ROLE` env) com warning

**Independent Test**: `node build/build.js --key "rf_test" --role query` → `dist/robot-query-1/robot-query-1.exe` existe e `dist/robot-query-1/main-robot-*jsc` NÃO existe

---

### P2: Robô obtém instance_id do server na auth

**User Story**: Como robô, quero receber meu `instance_id` na resposta da autenticação, para que eu não precise saber meu ID antes de conectar.

**Why P2**: Elimina necessidade de `ROBOT_ID` embutido, server controla identificação.

**Acceptance Criteria**:

1. WHEN o robô envia `POST /instance/auth` com `X-Robot-Key` + `role` THEN o server SHALL retornar `{ token, instance_id }` e persistir `RobotInstance.role`
2. WHEN o robô recebe a resposta da auth THEN ele SHALL gravar o `instance_id` retornado (`api-client.js: this.instanceId = data.instance_id`)
3. WHEN o robô faz chamadas subsequentes (next-job `?role=`, heartbeat `body.role`, job-status) THEN ele SHALL enviar `instance_id` + `role`

**Independent Test**: Verificar que `api-client.js` construtor aceita `(baseUrl, instanceId, role)` e `authenticate()` grava `instance_id` da resposta

---

### P3: Config limpa e role-aware

**User Story**: Como desenvolvedor, quero que `config.js` exponha `ROBOT_ROLE` e `DOCUSIGN_SESSION_PATH` isolado por papel, sem chaves obsoletas.

**Why P3**: Limpeza + isolamento de sessão por papel.

**Acceptance Criteria**:

1. WHEN `config.js` é carregado THEN o objeto retornado NÃO SHALL conter `ROBOT_ID`, `ROBOT_EMAIL`, `ROBOT_PASS`
2. WHEN `config.js` é carregado THEN o objeto SHALL conter `API_URL`, `ROBOT_KEY`, `ROBOT_ROLE` (`query|update|all`), `HEADLESS`, `POLL_INTERVAL_SECONDS`, `DOCUSIGN_SESSION_PATH` (role-aware: `session-query.json` / `session-update.json` / `session-docusign.json`)
3. WHEN `config.json` / `config.json.example` é verificado THEN arquivos NÃO SHALL existir (removidos em AD-013/T-SMI-16); apenas `session-*.json` por papel

**Independent Test**: `loadConfig()` retorna `ROBOT_ROLE` + `DOCUSIGN_SESSION_PATH` e `Test-Path robot/config.json` é `False`

---

## Edge Cases

- WHEN `--key` é vazio ou não informado e nenhum `ROBOT_API_KEY_N` existe THEN build SHALL abortar com mensagem clara
- WHEN `--api-url` termina com `/` THEN build SHALL remover trailing slash
- WHEN `HEADLESS` não é definido THEN `true` como padrão
- WHEN `--role` inválido THEN fallback `all` + warning
- WHEN `ROBOT_API_KEY_N` múltiplas chaves + `ROLE=all` THEN `2N` builds (ex: 3 chaves → 6 pastas)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---------------|-------|-------|--------|
| BUILD-01 | P1: .exe por papel sem .jsc | Phase 3 | Passed |
| BUILD-02 | P1: aborta sem key | Phase 3 | Passed |
| BUILD-03 | P1: default API_URL | Phase 3 | Passed |
| BUILD-04 | P1: headless false embutido | Phase 3 | Passed |
| BUILD-05 | P1: default HEADLESS true | Phase 3 | Passed |
| BUILD-06 | P1: --role query/update/all + define + entryFile + run.bat | Phase 3 | Implemented |
| BUILD-07 | P1: matriz N×R (2N quando all) | Phase 3 | Implemented |
| AUTH-01 | P2: server retorna token+instance_id+role | Phase 2 | Passed |
| AUTH-02 | P2: robô grava instance_id | Phase 2 | Passed |
| AUTH-03 | P2: chamadas usam instance_id+role | Phase 2 | Passed |
| CFG-01 | P3: sem ROBOT_ID/EMAIL/PASS, com ROBOT_ROLE+SESSION_PATH | Phase 1 | Passed |
| CFG-02 | P3: config.json removido, session-*.json por papel | Phase 1 | Passed |

**Coverage:** 12 total, 12 mapped to tasks, 0 unmapped ✅

> Fonte canônica do roteamento por papel: `features/robot/dois-robos-consulta-atualizacao/spec.md` (AD-053).

---

## Success Criteria

- [x] Build gera `.exe` por `(chave, role)` com `--key --api-url --headless --role` (sem `.jsc`)
- [x] Matriz `ROBOT_API_KEY_N × role` → `dist/robot-query-N/` + `dist/robot-update-N/`
- [x] `ROBOT_ROLE` embutido via `--define` + `entryFile` dedicado + `run.bat` com título por papel
- [x] Robô autentica sem `instance_id` prévio (server gera) e propaga `role`
- [x] `ROBOT_ID`, `ROBOT_EMAIL`, `ROBOT_PASS` removidos; `ROBOT_ROLE` + `DOCUSIGN_SESSION_PATH` role-aware presentes
- [x] `config.json` removido; sessões `session-query.json` / `session-update.json` isoladas
