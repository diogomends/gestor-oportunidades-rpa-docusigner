# Sub-Spec: Robot-DocuSigner — Standalone Executável Protegido & Multi-Instância Distribuída

## Problem Statement
O robô RPA DocuSign precisa ser distribuído e executado localmente nas máquinas de vendedores e agentes em múltiplos terminais (ao menos 3 robôs em simultâneo), garantindo:
1. **Proteção de Código**: Impedir leitura ou alteração do código-fonte através de ofuscação, compilação em bytecode V8 (`.jsc`) e empacotamento em `.exe`.
2. **Concorrência Segura**: Operação com fila compartilhada no MongoDB utilizando **lock atômico** para evitar processamento duplicado de contratos.
3. **Comunicação e Rastreabilidade**: Comunicação HTTPS autenticada via JWT, heartbeat periódico e identificação única por máquina (`ROBOT_ID`).
4. **Segurança de Dados**: Download temporário de PDFs com exclusão imediata e credenciais tratadas em memória volátil.

---

## Requisitos Funcionais

### [REQ-SMI-01] Modelo e Concorrência Atômica na Fila
- Campos de concorrência no modelo `RobotJob`: `locked_by`, `lock_expires_at`, `instance_metadata`.
- Modelo `RobotInstance` para monitoramento de saúde e heartbeat dos executáveis.
- Busca atômica via `findOneAndUpdate` com liberação automática de locks expirados (> 10min).

### [REQ-SMI-02] Endpoints da Instância (`/api/robot-docusign/instance/*`)
- `POST /auth`: Autenticação e geração de JWT de 30 dias.
- `GET /config`: Consulta de restrições de horário de expediente e parâmetros de retry.
- `GET /next-job`: Busca atômica com atribuição de lock à máquina solicitante.
- `PATCH /job/:jobId/status`: Atualização de progresso e finalização de contratos.
- `POST /heartbeat`: Ping de vida e status da máquina.
- `GET /contracts/:contractId/pdf`: Download autenticado do arquivo PDF temporário.

### [REQ-SMI-03] Cliente Autônomo Standalone
- Arquitetura baseada em `ApiClient`, `Scheduler`, `JobRunner` e `Browser/Playwright`.
- Leitura de configuração de `config.json` local.
- Setup simplificado via `setup.bat` para instalação do Chromium.

### [REQ-SMI-04] Pipeline de Build Protegido
- Transpilação via `esbuild` (ESM -> CJS).
- Ofuscação de strings e fluxo de controle via `javascript-obfuscator`.
- Compilação para bytecode nativo V8 com `bytenode` (`.jsc`).
- Empacotamento em binário Windows (`.exe`) via `@yao-pkg/pkg`.
