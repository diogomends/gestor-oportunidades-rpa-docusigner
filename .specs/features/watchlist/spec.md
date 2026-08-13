# Módulo Watchlist & Componente Watchlist UI — Especificação

## Problem Statement
No CRM Funil de Vendas, oportunidades paradas por longos períodos sem interação ou atualização de estágio correm o risco de abandono e perda de negócios. Gestores e vendedores necessitam de um mecanismo automático de monitoramento em tempo real (Tabela de Atenção / Watchlist) que destaque oportunidades críticas com base em regras configuráveis de dias sem atualização.

---

## Separação de Arquitetura (SOLID)

Para garantir desacoplamento, separação de responsabilidades (SRP) e facilidade de manutenção, o sistema divide essa funcionalidade em duas camadas distintas:

1. **Módulo Backend (`modulo-watchlist`)**: Responsável pela modelagem no MongoDB, regras de negócio de cálculo de inatividade, endpoints REST protegidos por RBAC e persistência das configurações.
2. **Componente Frontend (`componente-watchlist-ui`)**: Componente de interface responsável pelo elemento `#watchlistSection` no Dashboard, renderização da tabela de atenção, modal de configuração (`#watchlistConfigModal`) e requisições HTTP defensivas.

---

## Goals
- Permitir que administradores configurem o limite de dias sem interação para categorizar oportunidades sob atenção ou congeladas.
- Calcular dinamicamente no backend as oportunidades elegíveis à Watchlist com base na data da última atualização (`updatedAt`).
- Fornecer API REST para leitura e atualização das regras de parametrização da Watchlist.
- Exibir no Dashboard o componente visual `#watchlistSection` apenas para usuários com permissão e com dados carregados.
- Tratar a inicialização do modal de configuração de forma defensiva no frontend, evitando exceções no console (`TypeError: Cannot set properties of null`).

## Out of Scope
- Envio de notificações por e-mail ou push automático sobre itens congelados (gerenciado por `notificacoes-internas`).
- Alteração automática de status de oportunidade no banco sem ação do usuário.
- Filtro de restrição de horário (gerenciado por `modulo-config-sistema`).

---

## Requisitos e Critérios de Aceitação (Acceptance Criteria)

### Parte 1: Módulo Backend (`modulo-watchlist`)

#### Modelagem e Persistência (`WatchlistConfig`)
- `WATCHLIST-BACKEND-01`: O backend deve utilizar o schema `WatchlistConfig` na coleção `watchlistconfigs` do MongoDB (`db_crm_funil`), contendo os campos:
  - `diasAtencao` (Number, padrão `3`): Dias sem atualização para marcar como atenção.
  - `diasCongelamento` (Number, padrão `7`): Dias sem atualização para marcar como congelada.
  - `updatedBy` (ObjectId ref `User`, opcional): Usuário admin que realizou a última alteração.
  - `timestamps` (`createdAt`, `updatedAt`).

#### Endpoints e Regras de Negócio REST
- `WATCHLIST-BACKEND-02`: Endpoint `GET /api/opportunities/watchlist` deve listar as oportunidades que excederam o limite de `diasAtencao` configurado, respeitando as restrições de permissão do usuário logado (Supervisor/Vendedor vêm apenas suas respectivas equipes/oportunidades).
- `WATCHLIST-BACKEND-03`: Endpoint `GET /api/opportunities/watchlist/config` deve ser restrito a administradores (`authorize("admin")`) e retornar as configurações vigentes de tempo ou os valores padrão (3/7 dias) caso nenhuma configuração exista no banco.
- `WATCHLIST-BACKEND-04`: Endpoint `PUT /api/opportunities/watchlist/config` deve ser exclusivo para administradores, validar os dados de entrada via Zod (`diasAtencao` ≥ 1 e `diasCongelamento` ≥ `diasAtencao`), e efetuar `upsert` na coleção `watchlistconfigs`.

---

### Parte 2: Componente Frontend (`componente-watchlist-ui`)

#### Seção do Dashboard e Renderização
- `WATCHLIST-FRONTEND-01`: O elemento `#watchlistSection` em `public/dashboard.html` deve atuar como o container principal da tabela de atenção, sendo gerenciado pelo script de inicialização [init-controls.js](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/watchlist/js/logic/init-controls.js).
- `WATCHLIST-FRONTEND-02`: A renderização da tabela ([render-table.js](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/watchlist/js/ui/render-table.js)) deve formatar os dados e aplicar destaques visuais (badges/tags de aviso) conforme a quantidade de dias que a oportunidade está estagnada.

#### Modal de Configuração e Programação Defensiva
- `WATCHLIST-FRONTEND-03`: O modal de configuração ([config-modal.js](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/watchlist/js/ui/config-modal.js)) deve preencher os campos formulários com as configurações retornadas da API.
- `WATCHLIST-FRONTEND-04`: Ao manipular elementos DOM do modal, as funções em `config-modal.js` devem verificar a existência previa dos elementos antes de atribuir `.value` ou `addEventListener`, garantindo zero exceções `null` em páginas onde a Watchlist não está presente (detalhes na sub-especificação em [sub-specs/config-modal-guards/spec.md](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/.specs/features/modulo-watchlist/sub-specs/config-modal-guards/spec.md)).
- `WATCHLIST-FRONTEND-05`: O cliente HTTP ([watchlist-api.js](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/watchlist/js/services/watchlist-api.js)) deve utilizar `fetch` encapsulado para realizar requisições a `/api/opportunities/watchlist*`, propagando cabeçalhos de autenticação JWT e tratando erros HTTP 403 e 500 com mensagens amigáveis.

---

## Arquitetura Físico-Lógica de Arquivos

### Módulo Backend (`src/modules/watchlist/`)
```
src/
├── models/
│   └── WatchlistConfig.js                     # Model Mongoose registrado no MongoDB
├── modules/
│   └── watchlist/
│       ├── controllers/
│       │   ├── get-watchlist.js               # Controller de busca de oportunidades em atenção
│       │   ├── get-watchlist-config.js        # Controller de leitura da configuração
│       │   └── update-watchlist-config.js     # Controller de atualização da configuração
│       ├── services/                          # Regras de cálculo de dias de estagnação
│       └── shared/                            # Constantes e helpers do módulo
└── routes/
    └── opportunityRoutes.js                   # Montagem das rotas /watchlist e /watchlist/config
```

### Componente Frontend (`public/modules/watchlist/`)
```
public/
├── dashboard.html                             # Container HTML (#watchlistSection)
└── modules/
    └── watchlist/
        ├── index.js                           # Entrypoint público do componente frontend
        └── js/
            ├── logic/
            │   └── init-controls.js           # Inicialização de controles e listeners do container
            ├── ui/
            │   ├── config-modal.js            # Lógica defensiva do modal de configuração
            │   └── render-table.js            # Renderização dinâmica da tabela de atenção
            └── services/
                └── watchlist-api.js           # Client HTTP para consumo da API do backend
```

---

## Matriz de Cobertura de Testes

| ID do Requisito | Tipo de Teste | Arquivo de Teste Recomendado | Foco do Teste |
| :--- | :--- | :--- | :--- |
| `WATCHLIST-BACKEND-01` | Integration (DB) | `tests/watchlist-model.test.js` | Schema e validação de padrões Mongoose |
| `WATCHLIST-BACKEND-02` | Unit / Controller | `tests/get-watchlist.test.js` | Cálculo de dias de inatividade e filtros RBAC |
| `WATCHLIST-BACKEND-03` | Integration API | `tests/get-watchlist-config.test.js` | Retorno de config padrão quando banco vazio |
| `WATCHLIST-BACKEND-04` | Integration API | `tests/update-watchlist-config.test.js` | Validação Zod e atualização com perfil admin |
| `WATCHLIST-FRONTEND-04` | UI / DOM | `tests/config-modal.test.js` | Garantia de não lançamento de erros quando elementos DOM forem nulos |
