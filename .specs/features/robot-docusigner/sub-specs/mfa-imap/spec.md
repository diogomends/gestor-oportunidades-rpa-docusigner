# Sub-Spec: Extração Headless de Código MFA DocuSign via Protocolo IMAP (T17)

## 1. Visão Geral e Contexto

Ao realizar o login automatizado na DocuSign pelo robô RPA (`robot/src/browser/docusign.js`), o sistema pode exigir verificação em duas etapas (MFA / Two-Factor Authentication). A DocuSign envia um e-mail de segurança com o assunto `"Verificar um novo dispositivo"` contendo um código numérico temporário de 6 dígitos.

Atualmente, o painel do `gestor-oportunidades` já coleta e persiste no `SystemConfig` (`key: "robot_docusign"`) as credenciais completas de e-mail de notificação (`token_notification_email`):
- `email`: Endereço de e-mail (ex: `notificacao@unitynordeste.com.br`)
- `password`: Senha da conta de e-mail (armazenada com cifra AES-256)
- `host`: Endereço do servidor IMAP (ex: `unitynordeste.com.br` ou `mail.unitynordeste.com.br`)
- `port`: Porta de conexão (default: `993`)
- `tls`: Flag booleana indicando TLS/SSL (default: `true`)

Esta especificação define a substituição/evolução da extração via navegador webmail (`roundcube.js`) por uma rotina **Headless via Protocolo IMAP nativo/TLS**, consumindo diretamente os parâmetros configurados no `gestor-oportunidades` e obtendo o código de 6 dígitos em ~1 segundo.

---

## 2. Requisitos Funcionais

### [REQ-MFA-IMAP-01] Módulo de Consulta IMAP Headless (`imapClient.js` / `imapMfaService.js`)
- **Localização**: `robot/src/browser/imapClient.js` e/ou `backend/src/services/imapMfaService.js`
- **Comportamento**:
  1. Conectar via socket TLS (`node:tls`) ou socket TCP limpo ao `host:port` com `tls: true/false` e opção `{ rejectUnauthorized: false }` para tolerância de certificados autoassinados em servidores próprios.
  2. Autenticar com `email` e `password` via comando `LOGIN`.
  3. Acessar a pasta `INBOX` via `SELECT INBOX`.
  4. Buscar mensagens não lidas ou recentes com remetente DocuSign (`docusign.net` / `docusign.com`) e/ou assunto `"Verificar um novo dispositivo"`, priorizando o UID mais recente.
  5. Decodificar automaticamente o corpo do e-mail caso venha em `Content-Transfer-Encoding: quoted-printable` ou `base64` antes de aplicar a busca.
  6. Extrair o código de 6 dígitos com regex padrão:
     - `/Seu c[oó]digo de verifica[cç][aã]o da Docusign [eé]:\s*(\d{6})/i`
     - `/\b(\d{6})\b/`
  7. Marcar mensagem processada como lida (`STORE <uid> +FLAGS (\Seen)`), encerrar a conexão IMAP (`LOGOUT`) e retornar a string do código de 6 dígitos.

### [REQ-MFA-IMAP-02] Fallback e Timeout Resiliente
- Caso o e-mail não tenha chegado imediatamente, realizar polling IMAP com `pollIntervalMs: 3000`, `backoffFactor: 1.2`, `maxPollIntervalMs: 6000` e timeout máximo `maxWaitMs: 30000` (30s). O fallback visual `roundcube.js` mantém `45000ms` como contingência.
- Suportar TLS implícito direto (porta 993) e conexão padrão (porta 143).
- Caso o servidor IMAP esteja inacessível ou as credenciais falhem, registrar log defensivo e tentar fallback ou retornar `null` para propagar erro estruturado `MFA_REQUIRED`.

### [REQ-MFA-IMAP-03] Compatibilidade com Build e Bytecode do Robô
- A implementação deve utilizar exclusivamente módulos nativos do Node.js (`node:tls`, `node:net`, `node:crypto`, `node:buffer`), garantindo 100% de compatibilidade com o pipeline de ofuscação (`bytenode`), empacotamento (`@yao-pkg/pkg`) e geração do executável `.exe` sem dependências binárias externas.

### [REQ-MFA-IMAP-04] Detecção de Tela MFA por Texto e Novos Atributos de Input
- O robô Playwright deve detectar a exigência de MFA através do texto visível *"Get Code From Your Email"* ou da presença dos campos de código.
- Se houver botão/opção intermediária para solicitar envio do código para o e-mail (`Get Code From Your Email`), o robô deve clicar no elemento antes de aguardar o input.
- Os seletores de input devem abranger: `name="security_code"`, `placeholder="Enter code"`, `pattern="[0-9]{6}"`, além dos seletores legados (`input[type='tel']`, `input[data-testid='mfa-code']`, `#code`).

---

## 3. Preservação de Escopo e Componentes Intocados (Impact Protector)

| Componente | Status | Motivo |
|---|---|---|
| `backend/src/modules/robot-docusign/routes.js` | **Intocado** | Rotas e middlewares REST existentes preservados |
| `backend/src/models/Contract.js` | **Intocado** | Schema e dados de contratos preservados |
| `backend/src/modules/robot-docusign/models/RobotJob.js` | **Intocado** | Estrutura de jobs e fila preservada |
| `public/` (`gestor-oportunidades`) | **Intocado** | Telas, formulários e auto-save já configurados e mantidos |

---

## 4. Critérios de Aceite

1. **WHEN** a tela de MFA aparecer no login DocuSign, **THEN** o robô SHALL invocar a rotina IMAP com `host`, `port`, `tls`, `email` e `password`.
2. **WHEN** o e-mail for localizado (inclusive codificado em Quoted-Printable/Base64), **THEN** o código de 6 dígitos SHALL ser decodificado e extraído em menos de 3 segundos.
3. **WHEN** múltiplos e-mails existirem na caixa, **THEN** o robô SHALL considerar apenas o e-mail mais recente (maior UID).
4. **WHEN** o código for retornado, **THEN** o Playwright SHALL preencher o input MFA e avançar a autenticação sem abrir abas extras no navegador.
5. **WHEN** as credenciais IMAP não estiverem configuradas ou o servidor falhar, **THEN** o sistema SHALL cair em fallback controlado sem quebrar o processo.
