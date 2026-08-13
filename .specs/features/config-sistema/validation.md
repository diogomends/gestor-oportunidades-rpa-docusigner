# Validação — Restrição de Horário de Acesso e Configurações

## Status Geral: PASS

## Acceptance Criteria Verification

| ID | Critério | Resultado | Evidência |
| -- | -------- | --------- | --------- |
| `SYSTEM-CONFIG-01` | Única entrada de configuração sob a chave `access_restriction` no MongoDB | **[PASS]** | `src/modules/config-sistema/models/SystemConfig.js` + Seed em `src/server.js` |
| `SYSTEM-CONFIG-02` | Estrutura de campos com `enabled`, `startHour`, `endHour` e `applyOnWeekends` | **[PASS]** | `src/modules/config-sistema/models/SystemConfig.js` define o objeto value |
| `SYSTEM-CONFIG-03` | Log de incidentes com ID, nome, e-mail, ação, data/hora e detalhes da tentativa | **[PASS]** | `src/modules/config-sistema/models/AccessLog.js` define o schema e middlewares gravam logs |
| `SYSTEM-CONFIG-04` | Middleware de validação da hora atual do servidor contra horário ativo | **[PASS]** | `src/middlewares/timeRestrictionMiddleware.js` decodifica a data e valida o expediente |
| `SYSTEM-CONFIG-05` | Bypass automático para usuários com cargo `admin` | **[PASS]** | Validação `req.user.cargo === "admin"` no início do middleware e `loginController.js` |
| `SYSTEM-CONFIG-06` | Retorno de HTTP 403 e JSON com erro explicativo para requisições fora de expediente | **[PASS]** | Middleware retorna status 403 com `{ error: "Acesso bloqueado fora do horário de expediente permitido." }` |
| `SYSTEM-CONFIG-07` | Validação de logins de usuários normais fora de hora com retorno de HTTP 403 no controller | **[PASS]** | `src/controllers/auth/loginController.js` executa a checagem no fluxo de login |
| `SYSTEM-CONFIG-08` | Bypass de endpoints públicos e do portal de documentos do cliente | **[PASS]** | Middleware ignora requisições com caminhos que começam com `/api/auth/login` ou incluem `/portal/` |
| `SYSTEM-CONFIG-09` | Endpoint `GET /api/system-config/access-violations` retorna violações recentes | **[PASS]** | Rota configurada em `src/modules/config-sistema/routes.js` apontando para `getAccessViolations` |
| `SYSTEM-CONFIG-10` | Notificação com modal de incidentes `accessViolationsModal` e dispensa individual por admin no `#btnDismissViolations` | **[PASS]** | `public/js/pages/dashboard.js` exibe modal com ID `accessViolationsModal` e salva `dismissedViolations_${userId}` no `localStorage` |
| `SYSTEM-CONFIG-11` | Item de menu na sidebar exibido exclusivamente para o cargo `admin` | **[PASS]** | ID `#navSystemConfig` adicionado em `sidebar.html` e no array `admin` em `sidebar.js` |
| `SYSTEM-CONFIG-12` | Interface do usuário premium contendo form de horários e tabela de auditoria | **[PASS]** | Criados `controle-horario.html`, `controle-horario.js` e `controle-horario.css` sob a subpasta `controle-horario` |
| `SYSTEM-CONFIG-14` | Encerramento de sessão `clearSession()` e redirecionamento no frontend ao receber HTTP 403 por restrição de horário | **[PASS]** | `public/js/core/request.js` intercepta HTTP 403 de restrição de horário e revoga o token |
| `SYSTEM-CONFIG-VISIBILITY-10` | Switch `watermark_enabled` no painel Exibir/Ocultar para controle global da injeção de marca d'água | **[PASS]** | `public/modules/config-sistema/exibir-ocultar/exibir-ocultar.html` + `src/modules/watermark/services/watermarkService.js` |

## Test Coverage
- Executados 6 testes unitários isolados em `tests/timeRestriction.test.js`.
- Cobertura completa de cenários de bypass de admin, restrição de dias comerciais, restrição de finais de semana e rotas públicas.
- Todos os testes passaram com sucesso em menos de 1 segundo.

## Correções e Melhorias (Julho/2026)
- **Timezone e Suporte Docker Alpine**: Corrigido o fuso horário no middleware e loginController para ler explicitamente em `America/Sao_Paulo` usando `Intl.DateTimeFormat` no `timeRestrictionService.js`.
- **tzdata no Dockerfile**: Instalado o pacote `tzdata` no Dockerfile da aplicação principal para garantir que o processo do Node.js consiga mapear fuso horários baseados em string no Alpine e respeitar `TZ=America/Sao_Paulo`.
- **Modal ID & Dispensa por Admin**: Atribuído ID `accessViolationsModal` ao modal de alerta e persistida a dispensa no `localStorage` por administrador ao clicar em `#btnDismissViolations`.
- **Bloqueio Efetivo em 403**: Atualizado `public/js/core/request.js` para revogar o token e redirecionar para `index.html` em caso de erro 403 de restrição de horário.
