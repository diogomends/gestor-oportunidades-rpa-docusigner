# Robot Auto-Provision Chromium Specification

## Problem Statement

Atualmente, o robô RPA depende de um script externo (`setup.bat` ou comando manual) para verificar e instalar o navegador Chromium gerenciado pelo Playwright nas máquinas dos operadores. Quando o ambiente está limpo ou o script batch falha na detecção, o executável `.exe` não consegue abrir o browser e quebra. A solução é embutir a verificação e o auto-download do Chromium diretamente no ciclo de inicialização do executável.

## Goals

- [ ] [PROV-G1] Permitir que o binário `.exe` do robô detecte automaticamente a ausência do Chromium no boot.
- [ ] [PROV-G2] Realizar o download e instalação silenciosa/assistida do Chromium via API do Playwright em runtime sem requerer scripts `.bat` adicionais.
- [ ] [PROV-G3] Notificar o operador via log e console sobre o progresso do download e tratar falhas de rede com feedback claro.

## Out of Scope

- Substituição do Playwright por outro mecanismo de automação.
- Empacotamento completo do navegador de 150MB+ dentro do binário `.exe` único (evitar footprint excessivo no instalador/distribuição).
- Suporte a navegadores alternativos (Firefox, WebKit) no runtime do DocuSign.

---

## User Stories & Acceptance Criteria

### [PROV-01] Verificação Prévia de Existência do Chromium
**Story**: Como operador iniciando o robô, o sistema deve verificar instantaneamente se o Chromium já está presente em `%LOCALAPPDATA%\ms-playwright` para evitar qualquer atraso desnecessário na inicialização.

- **AC 1.1**: WHEN o executável do robô inicia THEN o módulo `chromiumProvisioner` SHALL verificar a existência do executável do Chromium retornado por `playwright.chromium.executablePath()`.
- **AC 1.2**: WHEN o executável já existe no caminho local THEN o sistema SHALL registrar log informativo e prosseguir imediatamente com a autenticação e agendamento de jobs sem acionar download.

### [PROV-02] Auto-Download e Instalação em Runtime
**Story**: Como operador em uma máquina nova sem Chromium instalado, o robô deve baixar e registrar o navegador automaticamente ao ser executado.

- **AC 2.1**: WHEN o executável do Chromium não for detectado THEN o robô SHALL invocar a rotina de instalação do Playwright (`installBrowsers` / subprocesso `playwright install chromium`).
- **AC 2.2**: WHEN o download for iniciado THEN o sistema SHALL exibir mensagens de progresso no console informando que o ambiente está sendo preparado.
- **AC 2.3**: WHEN a instalação for concluída com sucesso THEN o robô SHALL validar o caminho gerado e prosseguir com o fluxo de execução normal.

### [PROV-03] Tratamento de Falhas e Resiliência de Conexão
**Story**: Como suporte técnico, se o operador não tiver conexão com a internet durante o primeiro provisionamento, o robô deve apresentar uma mensagem orientativa e segura.

- **AC 3.1**: WHEN o download falhar por erro de rede, timeout ou falta de permissão THEN o robô SHALL capturar o erro, exibir mensagem amigável no console orientando a verificação da conexão e encerrar com código de status apropriado.
- **AC 3.2**: WHEN ocorrer falha de download THEN o sistema SHALL registrar o erro detalhado no arquivo de log do robô.

---

## Implicit-Requirement Dimensions

| Dimension | Resolution / Coverage |
| --------- | --------------------- |
| Input validation & bounds | N/A — o módulo valida caminhos do filesystem local. |
| Failure / partial-failure states | Rollback e limpeza de downloads corrompidos gerenciados pela engine do Playwright; timeout configurado para evitar travamento indefinido. |
| Idempotency / retry / duplicate handling | Idempotente: se a pasta/binário já existir, o instalador não reexecuta. |
| Auth boundaries & rate limits | N/A — download direto dos repositórios oficiais de release do Playwright/CDN. |
| Concurrency / ordering | Executado de forma estritamente síncrona/bloqueante antes da criação de instâncias de browser e loops de polling. |
| Data lifecycle / expiry | N/A — binários do navegador residem no diretório padrão `%LOCALAPPDATA%\ms-playwright`. |
| Observability | Logs estruturados com timestamps no console e no arquivo de log local da instância. |
| External-dependency failure | Captura de falhas de DNS, firewall corporativo e proxy HTTP/HTTPS. |
| State-transition integrity | O robô permanece em estado `INITIALIZING` até o provisionamento do browser estar `READY`. |

---

## Assumptions & Open Questions

- **Assumption 1**: O runtime do Node/pkg possui permissão de escrita em `%LOCALAPPDATA%\ms-playwright` (padrão de usuário sem necessidade de privilégios de Administrador).
- **Assumption 2**: O pacote `@yao-pkg/pkg` continuará empacotando os módulos auxiliares necessários para invocar o CLI de instalação do Playwright ou a biblioteca interna de download.
