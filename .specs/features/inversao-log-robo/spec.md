# Inversão Log Robô + Renomeio Robot-Enviar Specification

## Problem Statement
O endpoint `GET /api/robot-docusign/logs/:jobId` e o stream SSE `GET /api/robot-docusign/jobs/:jobId/stream` retornam o array `steps` em ordem cronológica (mais antigo primeiro). Operadores precisam rolar até o final para ver o passo mais recente/falha. Adicionalmente, o artefato de distribuição `robot-update` deve ser renomeado para `robot-enviar` (pastas, executáveis, scripts) para alinhar nomenclatura com domínio de envio.

## Goals
- [ ] `GET /api/robot-docusign/logs/:jobId` retorna `steps` com mais recente primeiro (ordem descendente por inserção) sem mutar documento Mongoose.
- [ ] `GET /api/robot-docusign/jobs/:jobId/stream` e eventos `job:progress` espelham a mesma ordem descendente.
- [ ] Artefatos de distribuição `robot-update-*` renomeados para `robot-enviar-*` (build, Makefile, package.json) mantendo `role=update` interno com alias `enviar`.

## Out of Scope
| Feature | Reason |
| ------- | ------ |
| Mudar persistência `RobotJob.steps` (`$push` com `$position: 0`) | Reescreve histórico e invalida índice `createdAt`; risco desnecessário |
| Parâmetro `?order=asc|desc` | YAGNI — adicionar quando segundo consumidor exigir compatibilidade |
| Alteração no frontend `gestor-oportunidades` | Fix centralizado no backend cobre todos consumidores; frontend já tolera ordem |
| Biblioteca de ordenação externa | Stdlib `[...].reverse()` suficiente |

---

## Assumptions & Open Questions
| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Ordem descendente = `reverse()` da inserção cronológica (`push`) | Sim | `RobotJob.steps` preenchido via `push` em `seletorApiRobot/index.js:90,138,171,193` — ordem de inserção é cronológica | n |
| Não mutar array persistido | `[...(job.steps\|\|[])].reverse()` | Evita dirty Mongoose e efeitos colaterais | n |
| `steps` vazio/null/undefined retorna `[]` | Sim | Contrato atual `job.steps \|\| []` em `robotDocusignController.js:478` | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Visualizar log com mais recente no topo ⭐ MVP

**User Story**: Como operador do robô DocuSign, quero que a execução do log (`steps`) seja exibida com o mais recente acima para que eu diagnostique falhas sem rolar até o final.

**Why P1**: Atende pedido direto do usuário; impacto mínimo (1-2 arquivos, stdlib).

**Acceptance Criteria** (EARS):
1. WHEN `GET /api/robot-docusign/logs/:jobId` é chamado THEN o sistema SHALL retornar `steps` em ordem descendente onde `steps[0].timestamp >= steps[1].timestamp`.
2. WHEN `GET /api/robot-docusign/jobs/:jobId/stream` envia payload inicial THEN o sistema SHALL incluir `steps` em ordem descendente.
3. WHEN `robotEvents` emite `job:progress` THEN o sistema SHALL transmitir `data.steps` em ordem descendente via SSE.
4. IF `job.steps` é `null`, `undefined` ou vazio THEN o sistema SHALL retornar `[]` sem erro.
5. The system SHALL não mutar o array `job.steps` persistido no MongoDB ao inverter (usar cópia).

**Independent Test**: Criar job com `steps=[init(0s), attempt_1(1s), robot_send(2s)]`, chamar `GET /logs/:jobId` e assert `steps[0].name === "robot_send"` e `steps[2].name === "init"`.

### P2: Renomeio robot-update → robot-enviar

**User Story**: Como operador, quero que o robô de envio seja distribuído como `robot-enviar-*` em vez de `robot-update-*` para que a nomenclatura reflita a ação de envio.

**Why P2**: Alinhar nome do artefato com domínio (`enviar`), solicitado explicitamente.

**Acceptance Criteria** (EARS):
1. WHEN `node build/build.js --role=update` ou `--role=enviar` é executado THEN o sistema SHALL gerar `dist/robot-enviar-1/robot-enviar-1.exe` (não `robot-update`).
2. WHEN `node build/build.js --role=all` é executado THEN o sistema SHALL gerar `dist/robot-query-1/` e `dist/robot-enviar-1/`.
3. WHEN `make build-robot ROLE=enviar` ou `ROLE=update` é executado THEN o sistema SHALL repassar `--role` normalizado e gerar artefato `robot-enviar-*`.
4. WHEN `make execute-robot-enviar` ou `make execute-robot-update` é executado THEN o sistema SHALL iniciar `robot/dist/robot-enviar-1/run.bat` (alias mantido).
5. The system SHALL manter `RobotInstance.role=update` interno e aceitar `role=enviar` como alias (não quebrar fila existente).

**Independent Test**: `node robot/build/build.js --key rf_test --role enviar --headless true` → `dist/robot-enviar-1/robot-enviar-1.exe` existe e `dist/robot-update-1` não é criado.

---

## Edge Cases
- IF `jobId` inválido (CastError) THEN o sistema SHALL retornar `404 Job não encontrado` (comportamento existente `robotDocusignController.js:458` preservado).
- IF job sem `steps` THEN o sistema SHALL retornar `steps: []` com status `200`.
- WHEN job em `retrying` com múltiplos pushes de `robot_<action>_attempt_N` THEN o sistema SHALL manter ordem descendente entre tentativas (mais recente primeiro).

---

## Requirement Traceability
| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| INV-01 | P1: Inversão GET /logs | Execute | Pending |
| INV-02 | P1: Inversão SSE inicial | Execute | Pending |
| INV-03 | P1: Inversão job:progress | Execute | Pending |
| INV-04 | P1: steps vazio → [] | Execute | Pending |
| INV-05 | P1: não mutar persistência | Execute | Pending |
| REN-01 | P2: build role alias enviar | Execute | Pending |
| REN-02 | P2: dist folder robot-enviar | Execute | Pending |
| REN-03 | P2: Makefile envia | Execute | Pending |
| REN-04 | P2: alias compatível | Execute | Pending |

**Coverage:** 9 total, 0 mapped to tasks, 9 unmapped (Small — tasks skipados, inline verify).

---

## Success Criteria
- [ ] `GET /logs/:jobId` com 3 steps retorna `steps[0]` = mais recente (asserção em teste).
- [ ] SSE stream inicial e evento `job:progress` retornam mesma ordem descendente.
- [ ] Nenhum teste existente quebrado (`tests/backend/controllers/robotDocusignController.test.js` logs).
- [ ] `validate_spec.py` passa sem erro.
