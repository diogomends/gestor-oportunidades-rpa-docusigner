# Tasks: Extração Headless de Código MFA DocuSign via Protocolo IMAP (T17)

## Protocolo de Execução
- **Linguagem**: JavaScript (Node.js ES Modules)
- **Framework de Testes**: `node:test` + `node:assert`
- **Padrão de Qualidade**: SOLID + PonyTail (sem dependências desnecessárias)

---

## Tasks

### T17.1: Criação do Utilitário de Conexão e Consulta IMAP (`imapClient.js`)
- **Objetivo**: Implementar conexão via socket TLS (`node:tls`) para autenticação IMAP, busca no `INBOX` e extração de texto da mensagem mais recente da DocuSign.
- **Arquivo**: `robot/src/browser/imapClient.js`
- **Ações**:
  1. Conexão TCP/TLS nativa para `host` e `port` com suporte a `tls: true/false`.
  2. Envio de comandos IMAP: `LOGIN`, `SELECT INBOX`, `SEARCH UNSEEN / ALL SUBJECT "Verificar"`, `FETCH BODY[TEXT]`, `LOGOUT`.
  3. Extração regex do código de 6 dígitos.
  4. Retorno estruturado do token `{ code: "123456", success: true }`.

### T17.2: Atualização do Schema Zod e Persistência no Backend Central
- **Objetivo**: Garantir que `token_notification_email` com `host`, `port`, `tls`, `email` e `password` cifrada seja completamente aceito e persistido no `updateConfig` e `getRobotConfig`.
- **Arquivos**:
  - `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`
  - `backend/src/modules/robot-docusign/services/robotOrchestrator.js`
  - `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
- **Ações**:
  1. Adicionar `token_notification_email` no `updateConfigSchema` (Zod).
  2. Aplicar `encryptText` no campo `password` ao persistir em `SystemConfig`.
  3. Propagar as credenciais completas (`host`, `port`, `tls`, `email`, `password`) no `getInstanceConfig` e no payload do job em `getNextJob`.

### T17.3: Integração no Fluxo de Autenticação do Robô Playwright
- **Objetivo**: Chamar o `imapClient.js` quando a tela de MFA for detectada durante o login.
- **Arquivos**:
  - `robot/src/browser/docusign.js`
  - `backend/src/modules/robot-docusign/services/robotSession.js`
- **Ações**:
  1. Ao identificar `input[type='tel']` ou seletor MFA, invocar `fetchMfaCodeViaImap(mailCredentials)`.
  2. Preencher o campo com o código retornado e submeter.
  3. Manter `roundcube.js` como contingência/fallback caso o servidor IMAP não responda.

### T17.4: Testes Unitários e Validação de Regressão
- **Objetivo**: Criar testes com mock de servidor IMAP e verificar integridade com `node --test`.
- **Arquivo**: `robot/src/browser/imapClient.test.js`
- **Critérios**: 100% dos testes passando sem afetar outros fluxos.
