# Sub-Spec: Robot-DocuSigner — Standalone Executável Protegido & Multi-Instância Distribuída

## Problem Statement
O robô RPA DocuSign precisa ser distribuído e executado localmente nas máquinas de vendedores e agentes em múltiplos terminais (ao menos 3 robôs em simultâneo), garantindo:
1. **Proteção de Código**: Impedir leitura ou alteração do código-fonte através de ofuscação, compilação em bytecode V8 (`.jsc`) e empacotamento em `.exe`.
2. **Concorrência Segura**: Operação com fila compartilhada no MongoDB utilizando **lock atômico** para evitar processamento duplicado de contratos.
3. **Comunicação e Rastreabilidade**: Comunicação HTTPS autenticada via JWT, heartbeat periódico e identificação única por máquina (`ROBOT_ID`).
4. **Segurança de Dados**: Download temporário de PDFs com exclusão imediata e credenciais tratadas em memória volátil.

> **Relação com o Servidor**: Este componente (`robot-standalone/`) é o **Robô Standalone** — um executável `.exe` que roda nas máquinas dos agentes. Ele se comunica com o **Servidor Central** (`src/`) via HTTP autenticado. O servidor mantém a fila de jobs (`RobotJob`), autenticação (`RobotInstance`) e monitoramento. O standalone não possui banco de dados próprio — tudo é consultado/alterado via API.

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
- Configuração injetada em tempo de build (credenciais, `ROBOT_ID`, `HEADLESS`, `API_URL`); `config.json` é opcional/fallback apenas para debug.
- Setup via `setup.bat` apenas para instalação do Chromium.
- **Distribuição em 2 arquivos**: o `.exe` (loader) e o `.jsc` (bytecode) DEVEM ser copiados juntos para a mesma pasta na máquina alvo — o `.exe` aborta se o `.jsc` não estiver ao lado.

### [REQ-SMI-04] Pipeline de Build Protegido
- Transpilação via `esbuild` (ESM -> CJS).
- Ofuscação de strings e fluxo de controle via `javascript-obfuscator`.
- Compilação para bytecode nativo V8 com `bytenode` (`.jsc`).
- Empacotamento em binário Windows (`.exe`) via `@yao-pkg/pkg`.
- O build copia o `.jsc` para a pasta de distribuição ao lado do `.exe`; ambos devem ser entregues juntos ao cliente.

### [REQ-SMI-05] Distribuição das Dependências Playwright no Build
- `@yao-pkg/pkg` não inclui dependências com carregamento dinâmico no sistema virtual (`C:\snapshot`), exigindo que `playwright` e `playwright-core` estejam disponíveis no diretório físico (`node_modules/`) ao lado do executável.
- O pipeline de build deve copiar recursivamente `robot/node_modules/playwright` e `robot/node_modules/playwright-core` para `robot/dist/<bundleBase>/node_modules/`.
- Copiar o script `setup.bat` para as pastas de saída do `dist/` para facilitar a instalação do Chromium no ambiente de execução.
- Preservar o esbuild com a flag `--external:playwright`, mantendo a ofuscação e a injeção estática das credenciais por robô.

### [REQ-SMI-06] Script de Setup com Diagnóstico Completo de Ambiente
- `setup.bat` deve remover completamente qualquer menção/cópia de `config.json` e `config.json.example`.
- **Detecção Inteligente do Chromium**: Verificar primeiro se o Chromium já está instalado localmente em `%LOCALAPPDATA%\ms-playwright\chromium-*` antes de tentar qualquer requisição de download. Se já existir, marcar como pronto imediatamente sem bloquear o terminal.
- **Download sob Demanda**: Apenas executar `npx playwright install chromium` caso o navegador realmente não esteja presente na máquina.
- Tratar rigorosamente o `%ERRORLEVEL%` e testar conectividade se houver falha.
- Salvar a saída das operações em `setup.log`.
- Exibir feedback visual de status (`[SUCESSO] O robô está pronto para uso`) ou orientações claras em caso de falha.
