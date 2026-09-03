# Domínio: robot

Executável standalone `.exe` que roda nas máquinas dos agentes. Polling autenticado, Playwright, MFA, heartbeat.

## Sub-features

| Sub-feature | Origem legada | Conteúdo |
|---|---|---|
| `autenticacao-mfa-imap` | `robot-docusigner/sub-specs/mfa-imap` | Autenticação MFA: IMAP/TLS headless + fallback Roundcube, persistência de sessão storageState (AD-018) |
| `provisionamento-automatico-chromium` | `robot-auto-provision-chromium` | Provisionamento automático do navegador: verificação `%LOCALAPPDATA%\ms-playwright` + download sob demanda |
| `consulta-acordos-navegador` | `docusign-agreements-query` (fatia robot) | Consulta de acordos no navegador: navegação OneDS, seletores e extração de dados da tabela (AD-042/043/044) |
| `dois-robos-consulta-atualizacao` | novo | Segregação do executável standalone em 2 robôs especializados: Consulta e Atualização/Envio |

> Consumo da fila: validado em `servidor-robot/envio-sob-demanda` mas executado aqui via `robot/src/job-runner.js`.
