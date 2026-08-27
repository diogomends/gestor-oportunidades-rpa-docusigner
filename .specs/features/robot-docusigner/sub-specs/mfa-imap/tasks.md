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

---

### [x] T20: Otimização PonyTail e Redução de Roundtrips IMAP (2026-08-27)
- **Objetivo**: Reduzir roundtrips desnecessários, reusar conexão IMAP no polling, eliminar duplicação de testes e alinhar intervalos com spec.
- **Arquivos**:
  - `robot/src/browser/imapClient.js`
  - `robot/src/browser/imapClient.test.js`
  - `backend/src/modules/robot-docusign/services/imapClient.test.js`
 - **Ações**:
   1. [x] **M1**: Reduzir 8 buscas sequenciais `UID SEARCH` para 2 padrões (`SINCE <data>` com fallback `ALL`), filtrando assunto no cliente com iteração descending por UIDs.
   2. [x] **M2**: Manter e reutilizar a mesma conexão IMAP autenticada durante o polling em `fetchMfaCodeViaImap`.
   3. [x] **M3**: Eliminar duplicação de arquivos de teste apontando `backend/.../imapClient.test.js` para `robot/.../imapClient.test.js`.
   4. [x] **M4**: Alinhar constantes padrão de polling (`pollIntervalMs: 3000`, `backoffFactor: 1.2`, `maxPollIntervalMs: 6000`, `maxWaitMs: 30000`).

---

### [x] T21: Detecção de MFA por Texto e Novos Atributos de Input (2026-08-27)
- **Objetivo**: Identificar tela de MFA através do texto *"Get Code From Your Email"* com acionamento do botão correspondente e suportar inputs com `name="security_code"`, `placeholder="Enter code"` e `pattern="[0-9]{6}"`.
- **Arquivos**:
  - `robot/src/browser/selectors.js`
  - `robot/src/browser/docusign.js`
  - `backend/src/modules/robot-docusign/selectors/docusign-ui.json`
  - `backend/src/modules/robot-docusign/services/robotSelectors.js`
  - `backend/src/modules/robot-docusign/services/robotSession.js`
- **Ações**:
  1. [x] **T21.1**: Adicionar seletores para `name="security_code"`, `placeholder="Enter code"`, `pattern="[0-9]{6}"` e botão `Get Code From Your Email`.
  2. [x] **T21.2**: Implementar verificação por texto (`page.locator("text=/Get Code From Your Email/i")`) e clique preparatório antes de aguardar o input.
  3. [x] **T21.3**: Sincronizar fallbacks no backend (`robotSession.js`, `robotSelectors.js`, `docusign-ui.json`).

---

### [x] T22: Padronização e Ajuste do Botão de Confirmação MFA (verify-code / Verify) (2026-08-27)
- **Objetivo**: Integrar os seletores do botão de confirmação MFA `<button data-qa="verify-code">...<span data-qa="verify-code-text">Verify</span></button>` no robô e no servidor central, com priorização e fallback robusto.
- **Arquivos**:
  - `robot/src/browser/selectors.js`
  - `backend/src/modules/robot-docusign/selectors/docusign-ui.json`
  - `backend/src/modules/robot-docusign/services/robotSelectors.js`
  - `backend/src/modules/robot-docusign/services/robotSession.js`
  - `AGENTS.md`
  - `README.md`
- **Ações**:
  1. [x] **T22.1**: Adicionar `button[data-qa='verify-code']`, `button:has-text('Verify')`, `[data-qa='verify-code']` em `selectors.mfa.verify_button`.
  2. [x] **T22.2**: Sincronizar `docusign-ui.json` e `robotSelectors.js` com o novo seletor de confirmação.
  3. [x] **T22.3**: Ajustar `robotSession.js` para priorizar `selectors.mfa.verify_button` no envio do `otpCode`.
  4. [x] **T22.4**: Atualizar documentação e especificações.

---

### [x] T23: Tratamento de Código MFA Inválido e Retentativa Automática (2026-08-27)
- **Objetivo**: Detectar a mensagem *"The code entered is invalid. Please try again."* na tela de MFA da DocuSign, limpar o input e executar polling por novo código recebido no IMAP/Webmail, descartando tokens rejeitados.
- **Arquivos**:
  - `robot/src/browser/selectors.js`
  - `robot/src/browser/imapClient.js`
  - `robot/src/browser/docusign.js`
- **Ações**:
  1. [x] **T23.1**: Adicionar seletor `error_invalid` no objeto `selectors.mfa` de `selectors.js`.
  2. [x] **T23.2**: Suportar parâmetro `excludedCodes` em `fetchLatestMfaCode` e `fetchMfaCodeViaImap` para ignorar códigos rejeitados.
  3. [x] **T23.3**: Implementar loop com até 3 tentativas em `ensureAuthenticated`, com detecção visual de erro, limpeza de campo e nova busca de código.

