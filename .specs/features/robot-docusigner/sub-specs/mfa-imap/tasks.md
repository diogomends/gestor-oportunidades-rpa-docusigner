# Tasks: Extração Headless de Código MFA DocuSign via Protocolo IMAP (T17)

## Protocolo de Execução
- **Linguagem**: JavaScript (Node.js ES Modules)
- **Framework de Testes**: `node:test` + `node:assert`
- **Padrão de Qualidade**: SOLID + PonyTail (sem dependências desnecessárias)

---

## Tasks

### [x] T17.1: Criação do Utilitário de Conexão e Consulta IMAP (`imapClient.js`) (2026-08-27)
- **Objetivo**: Implementar conexão via socket TLS (`node:tls`) nativo para autenticação IMAP, busca no `INBOX`, decodificação MIME (Quoted-Printable/Base64) e extração de texto da mensagem mais recente da DocuSign.
- **Arquivo**: `robot/src/browser/imapClient.js`
- **Ações**:
  1. [x] Conexão TCP/TLS nativa para `host` e `port` com suporte a `tls: true/false` e tolerância a certificados autoassinados (`rejectUnauthorized: false`).
  2. [x] Envio de comandos IMAP: `LOGIN`, `SELECT INBOX`, `UID SEARCH UNSEEN / ALL SUBJECT "Verificar"`, `UID FETCH <id> BODY[TEXT]`, `STORE +FLAGS (\Seen)`, `LOGOUT`.
  3. [x] Decodificador MIME leve integrado para `quoted-printable` e `base64`.
  4. [x] Extração regex do código de 6 dígitos.
  5. [x] Retorno estruturado do token `{ code: "123456", success: true }`.

### [x] T17.2: Atualização do Schema Zod e Persistência no Backend Central (2026-08-27)
- **Objetivo**: Garantir que `token_notification_email` com `host`, `port`, `tls`, `email` e `password` cifrada seja completamente aceito e persistido no `updateConfig` e `getRobotConfig`.
- **Arquivos**:
  - `backend/src/modules/robot-docusign/controllers/robotDocusignController.js`
  - `backend/src/modules/robot-docusign/services/robotOrchestrator.js`
  - `backend/src/modules/robot-docusign/controllers/robotInstanceController.js`
- **Ações**:
  1. [x] Adicionar `token_notification_email` no `updateConfigSchema` (Zod).
  2. [x] Aplicar `encryptText` no campo `password` ao persistir em `SystemConfig`.
  3. [x] Propagar as credenciais completas (`host`, `port`, `tls`, `email`, `password`) no `getInstanceConfig` e no payload do job em `getNextJob`.

### [x] T17.3: Integração no Fluxo de Autenticação do Robô Playwright (2026-08-27)
- **Objetivo**: Chamar o `imapClient.js` quando a tela de MFA for detectada durante o login.
- **Arquivos**:
  - `robot/src/browser/docusign.js`
  - `backend/src/modules/robot-docusign/services/robotSession.js`
- **Ações**:
  1. [x] Ao identificar `input[type='tel']` ou seletor MFA, invocar `fetchMfaCodeViaImap(mailCredentials)`.
  2. [x] Preencher o campo com o código retornado e submeter.
  3. [x] Manter `roundcube.js` como contingência/fallback caso o servidor IMAP não responda.

### [x] T17.4: Testes Unitários e Validação de Regressão (2026-08-27)
- **Objetivo**: Criar testes com mock de servidor IMAP testando fluxos com TLS direto, encoding Quoted-Printable, Base64 e verificação de integridade com `node --test`.
- **Arquivo**: `robot/src/browser/imapClient.test.js` e `backend/src/modules/robot-docusign/services/imapClient.test.js`
- **Critérios**: [x] 100% dos testes passando (100/100 testes, 0 falhas).

---

### [x] T18: Hardening e Resiliência do Cliente IMAP Nativo (2026-08-27)
- **Objetivo**: Implementar melhorias de robustez para tratamento imediato de desconexões, controle de rate-limit com backoff e filtro temporal `SINCE`.
- **Arquivos**:
  - `robot/src/browser/imapClient.js`
  - `robot/src/browser/imapClient.test.js`
  - `backend/src/modules/robot-docusign/services/imapClient.test.js`
- **Ações**:
  1. [x] **T18.1**: Adicionar listeners temporários de `error` e `close` durante `sendCommand` no `ImapClient` para abortar imediatamente caso a conexão caia.
  2. [x] **T18.2**: Configurar suporte a backoff adaptativo e reuso de sessão no polling de `fetchMfaCodeViaImap`.
  3. [x] **T18.3**: Incluir critério temporal `SINCE <data_hoje>` na busca `UID SEARCH` do protocolo IMAP.
  4. [x] **T18.4**: Validar resiliência e ausência de regressão com testes unitários `node --test`.

---

### [x] T19: Correção de Conexão, Parsing e Sanitização no Cliente IMAP (2026-08-27)
- **Objetivo**: Corrigir bugs de handshake (E1), regex de tagged response (E2), escape de strings RFC 3501 no login (E3) e formatação de datas IMAP com zero-padding (E4).
- **Arquivos**:
  - `robot/src/browser/imapClient.js`
  - `robot/src/browser/imapClient.test.js`
  - `backend/src/modules/robot-docusign/services/imapClient.test.js`
- **Ações**:
  1. [x] **E1**: Manter timeout ativo em `connect()` até o recebimento do greeting `* OK` e rejeitar se o socket fechar prematuramente.
  2. [x] **E2**: Ajustar regex de tag no `sendCommand` para limites de linha `(?:^|\r?\n)${tag}` e retornar objeto compatível com JSDoc `{ tag, response, raw }`.
  3. [x] **E3**: Implementar utilitário `escapeImapString` para escapar `\` e `"` no comando `LOGIN`.
  4. [x] **E4**: Adicionar zero-padding no dia da data (`padStart(2, '0')`) em `formatImapDate`.
  5. [x] Atualizar suíte de testes unitários cobrindo todos os cenários.

