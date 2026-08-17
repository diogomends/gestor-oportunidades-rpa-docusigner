# Simplify Robot Build Specification

## Problem Statement

O build atual do robot standalone aceita 6 parâmetros (`ids`, `keys`, `emails`, `passwords`, `headless`, `api-url`), mas a maioria não é necessária. O `ROBOT_ID` é redundante (o server gera a partir do `key_prefix`), e `ROBOT_EMAIL`/`ROBOT_PASS` nunca são lidos pelo código do robô. Isso causa confusão e expõe credenciais desnecessárias.

## Goals

- [x] Reduzir parâmetros do build de 6 para 3 (`--key`, `--api-url`, `--headless`)
- [x] Eliminar `ROBOT_ID` do código do robô (server gera `instance_id` na auth)
- [x] Eliminar `ROBOT_EMAIL` e `ROBOT_PASS` (nunca são lidos)
- [x] Manter compatibilidade com o fluxo de autenticação existente

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mudanças no server (rpa-docusigner) | O server já suporta auth sem `instance_id` (linha 107 do controller) |
| Mudanças no gestor-oportunidades | Fluxo de geração de chave já existe |
| Modo multi-robot (1 .exe para N robôs) | Fora do escopo — cada .exe tem sua chave embutida |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|----------------------|---------------|-----------|------------|
| `ROBOT_ID` pode ser eliminado | Server gera de `key_prefix` | Linha 107 do controller já faz fallback | y |
| `HEADLESS` pode ser dinâmico | Remover `--define` do esbuild | `config.js` já lê de env var ou config.json | y |
| Chave continua embutida no build | Opção A (1 .exe por robô) | Mais seguro, sem arquivo exposto | y |

**Open questions:** none

---

## User Stories

### P1: Build simplificado com apenas key e API_URL ⭐ MVP

**User Story**: Como desenvolvedor, quero gerar o build do robô com apenas `--key` e `--api-url`, para que o processo seja simples e seguro.

**Why P1**: Reduz complexidade, elimina credenciais desnecessárias, mantém segurança.

**Acceptance Criteria**:

1. WHEN `node build/build.js --key "rf_xxxxx" --api-url "http://localhost:3111"` é executado THEN o build SHALL gerar .exe + .jsc em `dist/`
2. WHEN o build é executado sem `--key` THEN o build SHALL retornar erro e abortar
3. WHEN o build é executado sem `--api-url` THEN o build SHALL usar `http://localhost:3111` como padrão
4. WHEN `--headless false` é passado THEN o build SHALL embutir `HEADLESS=false` no bytecode
5. WHEN `--headless` não é passado THEN o build SHALL usar `true` como padrão

**Independent Test**: Executar `node build/build.js --key "rf_test"` e verificar que gera `dist/robot-docusigner.exe` + `dist/main-robot-docusigner.jsc`

---

### P2: Robô obtém instance_id do server na auth

**User Story**: Como robô, quero receber meu `instance_id` na resposta da autenticação, para que eu não precise saber meu ID antes de conectar.

**Why P2**: Elimina necessidade de `ROBOT_ID` embutido, server controla identificação.

**Acceptance Criteria**:

1. WHEN o robô envia `POST /instance/auth` com `X-Robot-Key` THEN o server SHALL retornar `{ token, instance_id }` na resposta
2. WHEN o robô recebe a resposta da auth THEN ele SHALL gravar o `instance_id` retornado
3. WHEN o robô faz chamadas subsequentes (next-job, heartbeat, job-status) THEN ele SHALL enviar o `instance_id` obtido na auth

**Independent Test**: Verificar que `api-client.js` não requer `instanceId` no construtor e grava o ID da resposta auth

---

### P3: Remover configurações obsoletas do config.js

**User Story**: Como desenvolvedor, quero que o `config.js` não leia `ROBOT_ID`, `ROBOT_EMAIL` ou `ROBOT_PASS`, para que não haja referências a valores que não existem.

**Why P3**: Limpeza de código, evita confusão.

**Acceptance Criteria**:

1. WHEN `config.js` é carregado THEN o objeto retornado NÃO SHALL conter chaves `ROBOT_ID`, `ROBOT_EMAIL`, `ROBOT_PASS`
2. WHEN `config.json` é lido THEN valores `ROBOT_EMAIL` e `ROBOT_PASS` SHALL ser ignorados

**Independent Test**: Verificar que `loadConfig()` retorna objeto com `API_URL`, `ROBOT_KEY`, `HEADLESS`, `POLL_INTERVAL_SECONDS` — sem `ROBOT_ID`

---

## Edge Cases

- WHEN `--key` é vazio ou não informado THEN build SHALL abortar com mensagem de erro clara
- WHEN `--api-url` termina com `/` THEN build SHALL remover trailing slash (como já faz)
- WHEN `HEADLESS` não é definido THEN config.js SHALL usar `true` como padrão

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---------------|-------|-------|--------|
| BUILD-01 | P1: Build simplificado | Phase 3 | Passed |
| BUILD-02 | P1: Build simplificado | Phase 3 | Passed |
| BUILD-03 | P1: Build simplificado | Phase 3 | Passed |
| BUILD-04 | P1: Build simplificado | Phase 3 | Passed |
| BUILD-05 | P1: Build simplificado | Phase 3 | Passed |
| AUTH-01 | P2: instance_id do server | Phase 2 | Passed |
| AUTH-02 | P2: instance_id do server | Phase 2 | Passed |
| AUTH-03 | P2: instance_id do server | Phase 2 | Passed |
| CFG-01 | P3: Config obsoleto | Phase 1 | Passed |
| CFG-02 | P3: Config obsoleto | Phase 1 | Passed |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped ✅

---

## Success Criteria

- [x] Build gera .exe com apenas `--key` e `--api-url`
- [x] Robô autentica sem enviar `instance_id` (server gera)
- [x] `ROBOT_ID`, `ROBOT_EMAIL`, `ROBOT_PASS` não existem mais no código
- [x] Build existente com múltiplos parâmetros continua funcionando (backward compat via Makefile)
