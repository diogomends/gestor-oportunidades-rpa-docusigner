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
  1. Conectar via socket TLS (`node:tls`) ou cliente IMAP ao `host:port` com `tls: true/false`.
  2. Autenticar com `email` e `password`.
  3. Acessar a pasta `INBOX`.
  4. Buscar mensagens não lidas ou recentes com remetente DocuSign (`docusign.net` / `docusign.com`) e/ou assunto `"Verificar um novo dispositivo"`.
  5. Extrair o código de 6 dígitos com regex padrão:
     - `/Seu c[oó]digo de verifica[cç][aã]o da Docusign [eé]:\s*(\d{6})/i`
     - `/\b(\d{6})\b/`
  6. Encerrar a conexão IMAP (`LOGOUT`) e retornar a string do código de 6 dígitos.

### [REQ-MFA-IMAP-02] Fallback e Timeout Resiliente
- Caso o e-mail não tenha chegado imediatamente, realizar polling IMAP a cada 2-3 segundos com timeout máximo de 45 segundos.
- Caso o servidor IMAP esteja inacessível ou as credenciais falhem, registrar log defensivo e tentar fallback ou retornar `null` para propagar erro estruturado `MFA_REQUIRED`.

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
2. **WHEN** o e-mail for localizado, **THEN** o código de 6 dígitos SHALL ser extraído e retornado em menos de 3 segundos.
3. **WHEN** o código for retornado, **THEN** o Playwright SHALL preencher o input MFA e avançar a autenticação sem abrir abas extras no navegador.
4. **WHEN** as credenciais IMAP não estiverem configuradas, **THEN** o sistema SHALL cair em fallback controlado sem quebrar o processo.
