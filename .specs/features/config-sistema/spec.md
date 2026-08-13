# Restrição de Horário de Acesso — Especificação

## Problem Statement
Empresas parceiras e operadores do CRM Funil de Vendas necessitam de controle sobre as janelas de horário em que o sistema está acessível aos operadores. Isso previne passivos trabalhistas com acessos fora da jornada contratual (horas extras indesejadas) e aumenta a segurança. Usuários administradores (`admin`) devem reter acesso permanente (24h).

## Goals
- Definir horário de início e fim permitido para acessos gerais de usuários comuns.
- Controlar se o bloqueio se aplica a finais de semana (Sábado/Domingo).
- Bloquear requisições de API fora do horário permitido com código `403 Forbidden` e mensagem clara.
- Registrar log de todas as tentativas de acesso bloqueadas fora de hora no MongoDB.
- Alertar o administrador visualmente sobre violações de acesso ocorridas desde o último login.
- Disponibilizar interface premium e link na sidebar para gerenciar essas configurações (apenas para `admin`).

## Out of Scope
- Restrição baseada em IP ou geolocalização.
- Restrições de horário personalizadas por usuário individual ou por equipe (a regra é global por enquanto).
- Bloqueio de acesso para o portal público do cliente `/cliente/` (clientes finais podem anexar documentos a qualquer momento).

---

## Requisitos e Critérios de Aceitação (Acceptance Criteria)

### Modelagem de Configurações
- `SYSTEM-CONFIG-01`: O sistema deve manter uma única entrada de configuração sob a chave `access_restriction` na coleção `system-configs` do MongoDB.
- `SYSTEM-CONFIG-02`: A configuração deve conter: `enabled` (boolean), `startHour` (HH:MM), `endHour` (HH:MM) e `applyOnWeekends` (boolean).

### Log de Incidentes
- `SYSTEM-CONFIG-03`: Toda tentativa de requisição ou login de usuário comum bloqueada fora do expediente deve salvar um documento na coleção `access-logs` com: ID do Usuário, Nome, E-mail, Tipo de Evento (Bloqueio), Data/Hora e Detalhes da Requisição (URL ou login).

### Middleware e Restrição no Backend
- `SYSTEM-CONFIG-04`: Um middleware deve validar a hora atual do servidor contra o intervalo de horário ativo.
- `SYSTEM-CONFIG-05`: O middleware deve ignorar usuários com cargo `admin`.
- `SYSTEM-CONFIG-06`: Fora do horário, requisições autenticadas da API devem retornar HTTP `403 Forbidden` com JSON `{ error: "Acesso bloqueado fora do horário de expediente permitido." }`.
- `SYSTEM-CONFIG-07`: O endpoint `/api/auth/login` deve validar a tentativa de login de usuários comuns fora do horário e, se bloqueado, retornar HTTP 403.
- `SYSTEM-CONFIG-08`: Endpoints públicos e do portal de documentos do cliente não devem ser bloqueados.

---

## Visibilidade de Elementos de Interface (Exibir / Ocultar) — Especificação

### Requisitos e Critérios de Aceitação (Acceptance Criteria)

#### Modelagem de Configuração de Visibilidade
- `SYSTEM-CONFIG-VISIBILITY-01`: O sistema deve manter as configurações de visibilidade sob a chave `ui_visibility` na coleção `systemconfigs` (ou `SystemConfig`) do MongoDB.
- `SYSTEM-CONFIG-VISIBILITY-02`: A chave `ui_visibility` deve conter um objeto de flags booleanas, iniciando com `contracts_section` (padrão: `true`) e `watermark_enabled` (padrão: `true`).

#### API e Backend
- `SYSTEM-CONFIG-VISIBILITY-03`: Endpoint `GET /api/system-config/ui-visibility` deve estar disponível para qualquer usuário autenticado (`protect`), retornando as flags de visibilidade atuais.
- `SYSTEM-CONFIG-VISIBILITY-04`: Endpoint `PUT /api/system-config/ui-visibility` deve ser exclusivo para administradores (`protect` + `authorize("admin")`), validado via Zod (`z.object({ contracts_section: z.boolean().optional(), watermark_enabled: z.boolean().optional() })`), e atualizar a configuração no banco.

#### Central de Configurações e Módulo Exibir-Ocultar
- `SYSTEM-CONFIG-VISIBILITY-05`: A Central de Configurações (`public/modules/config-sistema/config-sistema.html`) deve conter um novo minicard intitulado "Exibir / Ocultar Elementos" apontando para `/modules/config-sistema/exibir-ocultar/exibir-ocultar.html`.
- `SYSTEM-CONFIG-VISIBILITY-06`: A nova página `public/modules/config-sistema/exibir-ocultar/exibir-ocultar.html` deve ser restrita ao perfil `admin` e apresentar os switches de controle em um layout modular premium com auto-save.
- `SYSTEM-CONFIG-VISIBILITY-07`: O módulo `exibir-ocultar` deve conter a chave `contracts_section` com switch de ativação/desativação e a chave `watermark_enabled` com switch para controle da marca d'água global em documentos.

#### Garantia e Remoção do Frontend
- `SYSTEM-CONFIG-VISIBILITY-08`: No frontend do módulo de contratos (`public/modules/contratos/contratos.js`), ao carregar a página, a aplicação deve consultar `GET /api/system-config/ui-visibility`.
- `SYSTEM-CONFIG-VISIBILITY-09`: Se `contracts_section === false`, o elemento `.contracts-section` deve ser removido permanentemente do DOM (`element.remove()`), garantindo que em nenhuma hipótese o trecho HTML apareça ou permaneça visível para o usuário final.
- `SYSTEM-CONFIG-VISIBILITY-10`: O sistema deve disponibilizar a chave `watermark_enabled` no painel Exibir/Ocultar sob `ui_visibility`. Quando `watermark_enabled === true`, a marca d'água dinâmica é injetada em arquivos PDF e imagens; quando `false`, a marca d'água é ignorada pelo `WatermarkService` e o arquivo original é servido sem modificações.

### Notificações de Auditoria
- `SYSTEM-CONFIG-09`: O backend deve disponibilizar um endpoint `GET /api/system-config/access-violations` que retorna as violações de acesso recentes.
- `SYSTEM-CONFIG-10`: No frontend, ao iniciar uma sessão de administrador no painel, deve ocorrer uma chamada ao endpoint de violações e, se houver registros novos não dispensados pelo administrador atual, exibir o modal com ID `accessViolationsModal` listando os usuários e datas/horas das tentativas bloqueadas. O modal contém o botão `#btnDismissViolations` ("Ciente"), que salva o registro de dispensa no `localStorage` por usuário (`dismissedViolations_${userId}`).
- `SYSTEM-CONFIG-14`: No frontend (`request.js`), ao receber resposta HTTP `403` de restrição de horário em requisições autenticadas da API, o sistema deve executar `clearSession()`, revogando o token, deslogando o usuário e redirecionando para a tela de login (`/index.html`) com o alerta explicativo.

### Interface de Configuração
- `SYSTEM-CONFIG-11`: A sidebar deve conter um item de navegação "Configuração do Sistema" exibido apenas para o cargo `admin`, apontando para a Central de Configurações (`config-sistema.html`).
- `SYSTEM-CONFIG-12`: A Central de Configurações (`config-sistema.html`) deve possuir uma interface modular baseada em minicards de design premium. O primeiro minicard deve ser "Horários funcionamento", abrindo a página de controle de horário em uma nova aba.
- `SYSTEM-CONFIG-13`: A página `/modules/config-sistema/controle-horario/controle-horario.html` deve exibir os controles de restrição agrupados em um único elemento visual `.multi-toggle` (unificando os switches "Habilitar Restrição" e "Permitir Acesso aos Finais de Semana" em linhas internas), seguidos pelos inputs de horário e a tabela com a lista histórica de logs de violações de acesso. O sistema deve efetuar o salvamento automático (auto-save) das configurações imediatamente a cada mudança nos switches ou inputs de horário, sem a necessidade de um botão de salvamento manual.

---

## Arquitetura, Nomenclatura e Estrutura SOLID

Para respeitar os princípios do SOLID SRP (Single Responsibility Principle) e manter o alinhamento com a modularidade do CRM, a lógica de negócio foi organizada sob o módulo principal `config-sistema` e o submódulo `controle-horario`, conforme o mapeamento abaixo:

### 1. Estrutura Física de Arquivos (Frontend)
- **`public/modules/config-sistema/`**: Diretório principal de configurações gerais do sistema.
  - **[config-sistema.html](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/config-sistema/config-sistema.html)**: Central com layout de minicards interativos.
  - **[config-sistema.css](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/config-sistema/config-sistema.css)**: Estilização dos cards, efeitos de hover e animações.
  - **[config-sistema.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/config-sistema/config-sistema.js)**: Validação de segurança (cargo admin) e inicialização da sidebar.
  - **`controle-horario/`**: Submódulo específico para gerenciamento de restrição de expediente.
    - **[controle-horario.html](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/config-sistema/controle-horario/controle-horario.html)**: Interface visual premium responsiva com switches unificados em container `.multi-toggle`.
    - **[controle-horario.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/config-sistema/controle-horario/controle-horario.js)**: Orquestrador de requisições de frontend e renderização de tabelas.
    - **[controle-horario.css](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/config-sistema/controle-horario/controle-horario.css)**: Customizações estéticas e regras do novo container `.multi-toggle`.

### 2. Estrutura Física de Arquivos (Backend)
- **`src/modules/config-sistema/`**: Módulo encapsulado contendo o domínio de configurações.
  - **[index.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/config-sistema/index.js)**: Entrypoint que unifica e expõe as rotas do módulo.
  - **[routes.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/config-sistema/routes.js)**: Rotas privadas protegidas sob ACL do `admin`.
  - **`controllers/`**:
    - **[systemConfigController.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/config-sistema/controllers/systemConfigController.js)**: Controlador para leitura/gravação das configurações e violações de acesso.
  - **`models/`**:
    - **[SystemConfig.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/config-sistema/models/SystemConfig.js)**: Schema do banco MongoDB para configurações globais.
    - **[AccessLog.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/config-sistema/models/AccessLog.js)**: Schema para auditoria das violações bloqueadas.
  - **`controle-horario/`**: Submódulo contendo a lógica de negócios da restrição.
    - **`services/`**:
      - **[timeRestrictionService.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/config-sistema/controle-horario/services/timeRestrictionService.js)**: Centraliza a validação lógica e matemática pura das janelas de horários e restrições de finais de semana.

### 3. Integração com Autenticação e Layout
- **[loginController.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/controllers/auth/loginController.js)**: Consome o serviço de restrição para bloquear e registrar logins em horários indevidos para usuários normais.
- **[token.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/utils/token.js)**: Responsável exclusivo por gerar tokens JWT.
- **[sidebar.html](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/sidebar/sidebar.html) & [sidebar.js](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/js/core/ui/sidebar.js)**: Menu lateral que expõe a tela de configurações para administradores.

