# Feature Specification: Segregação de Dois Robôs (Consulta e Atualização)

## Problem Statement

Atualmente, o robô RPA DocuSigner opera com um único executável genérico que concorre pelo consumo de todas as tarefas da fila (envio de envelopes, download de PDFs, verificação individual e consulta periódica de acordos). Para otimizar a escalabilidade, mitigar bloqueios de sessão na interface web do DocuSign e permitir a distribuição dedicada de tarefas em máquinas ou processos distintos, o sistema deve segregar a operação em dois robôs especializados:
1. **Robô de Consulta (Query):** Dedicado à varredura paginada na DocuSign (`view=agreements`), extração de status de recebedores e conciliação periódica.
2. **Robô de Atualização/Envio (Update):** Dedicado ao fluxo transacional de envio sob demanda, upload de PDFs, preenchimento de campos e submissão de envelopes.

## Out of Scope

- Alteração das regras de negócio de elegibilidade de contratos (`contractEligibility.js`).
- Modificação na infraestrutura de resolução de MFA por IMAP/Roundcube (`imapClient.js` / `roundcube.js`).
- Alteração nos schemas de contratos (`Contract.js`) ou banco de dados externo do CRM.

## Assumptions & Open Questions

| Assumption / Decision | Chosen default | Rationale |
| :--- | :--- | :--- |
| Identificação do papel da instância | Atributo `role: "query" \| "update" \| "all"` no handshake e token | Permite roteamento transparente no backend sem quebrar instâncias existentes (default `"all"`). |
| Isolamento de sessão local | Arquivos de sessão separados (`session-query.json` e `session-update.json`) | Evita corrupção de cookies e storageState caso ambos os robôs rodem na mesma máquina. |
| Distribuição dos executáveis | Pastas separadas em `dist/robot-query/` e `dist/robot-update/` | Facilita deploy e manutenção independente dos pacotes de execução. |
| Compatibilidade retroativa | Instâncias sem `role` assumem `"all"` e recebem qualquer job disponível | Garante operação ininterrupta durante migração gradual dos executáveis. |

Open questions: none (todas as decisões foram estabelecidas com valores padrão seguros).

## User Stories

### US-01: Roteamento Especializado de Jobs no Backend
As an API orchestrator  
I want to deliver jobs filtered by the connecting robot's role  
So that query robots only receive agreement scans and update robots only receive envelope transmissions.

#### Acceptance Criteria
- **AC-01.1**: When a robot instance requests `/api/robot-docusign/instance/next-job` with `role="query"`, the system SHALL return only pending jobs where action is `"query_agreements"` or `"status"`.
- **AC-01.2**: When a robot instance requests `/api/robot-docusign/instance/next-job` with `role="update"`, the system SHALL return only pending jobs where action is `"send"`.
- **AC-01.3**: When a robot instance requests without specifying role (or `role="all"`), the system SHALL maintain legacy behavior and return the first available pending job of any action.
- **AC-01.4**: When storing instances in `RobotInstance`, the system SHALL persist the `role` and expose it in instance metrics and monitoring endpoints.

### US-02: Especialização dos Executáveis Standalone
As a DevOps engineer / Agent operator  
I want to run dedicated robot executables for query and update  
So that workload is isolated and resource consumption is optimized per process.

#### Acceptance Criteria
- **AC-02.1**: When starting the robot with `--role=query` or `ROBOT_ROLE=query`, the system SHALL load query-specific routines and use `session-query.json` for storageState.
- **AC-02.2**: When starting the robot with `--role=update` or `ROBOT_ROLE=update`, the system SHALL load send-specific routines and use `session-update.json` for storageState.
- **AC-02.3**: When building binaries via build pipeline, the build script SHALL support targets `build:robot:query`, `build:robot:update` and `build:robot:all`, generating isolated bundles in `dist/robot-query/` and `dist/robot-update/`.

## Requirement Traceability

| Requirement ID | Description | Status |
| :--- | :--- | :--- |
| ROB2-01 | Modelagem do campo `role` em `RobotInstance` e indexação de `action` em `RobotJob` | in tasks |
| ROB2-02 | Filtro por `role` no endpoint `/instance/next-job` em `robotInstanceController.js` | in tasks |
| ROB2-03 | Suporte a `ROBOT_ROLE` / `--role` e caminhos de sessão dedicados em `config.js` | in tasks |
| ROB2-04 | Entrypoints dedicados `main-query.js` e `main-update.js` com dispatch em `main.js` | in tasks |
| ROB2-05 | Segregação e desacoplamento de execução de rotinas em `job-runner.js` | in tasks |
| ROB2-06 | Pipeline de compilação parametrizado por papel em `build.js` | in tasks |
| ROB2-07 | Scripts no `package.json` e `Makefile` para build individual e conjunto | in tasks |
