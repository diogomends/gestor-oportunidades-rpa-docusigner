# Especificação de Requisitos — Módulo Gestor de Tokens

## 1. Visão Geral
O módulo **Gestor de Tokens** gerencia o cadastro de logins operacionais por UF/DDD/Supervisor utilizados na emissão de contratos de vendas corporativas nos diferentes estados do Brasil. Os dados do token selecionado alimentam dinamicamente os campos de **TBP / Senior Account** nos contratos e nos PDFs (Termo de Adesão e Contrato de Permanência).

## 2. Requisitos Funcionais

### REQ-001: Cadastro e Armazenamento de Tokens (CRUD)
- Cada token possui vinculação com uma ou mais UFs (`ufs` array, multiselect de 27 UFs).
- Campos do token: `ufs` (`[String]` multiselect das UFs pertencentes ao token, min 1), `ddds` (`[String]` multiselect dos DDDs pertencentes às UFs selecionadas), `login` (`String` obrigatório), `tipoEnvio` (`[String]` enum `["Entrega", "Fast"]`), `nomeTbp` (`String`), `cnpjTbp` (`String`), `supervisores` (`[User._id]`), `ativo` (`Boolean`, default `true`).
- Operações de CRUD restritas aos perfis **Admin** e **Suporte** (`gestor-token:manage`).

### REQ-002: Resolução Dinâmica de Token
- Resolução baseada na configuração `gestor_token` em `SystemConfig`:
  - `criterio_gatilho`: `"uf"` (default), `"ddd"` ou `"supervisor"`.
  - `origem_uf`: `"contrato"` (default) ou `"oportunidade"`.
  - `tipo_envio_padrao`: `"Entrega"`.
- O algoritmo testa o gatilho principal ativo (`ativo: true`). Caso não localize correspondência específica, realiza fallback automático para o estado (`uf` pertencente a `ufs`).

### REQ-003: Persistência no Contrato e Idempotência
- Ao criar ou atualizar um contrato (`createContract` / `updateContract`), o sistema resolve o token ativo e grava os dados no subdocumento `tokenInfo` (`{ _id: false }`) do `Contract`.
- Ao gerar os PDFs de Termo e Permanência (`gerador-pdf-html`), o sistema consome os dados persistidos em `contract.tokenInfo`, garantindo idempotência histórica (se o cadastro do token for alterado no futuro, os contratos antigos mantêm os dados da época da contratação).
- Caso nenhum token ativo seja encontrado para a UF/DDD/Supervisor na emissão de Termo ou Permanência, o sistema bloqueia a operação retornando erro HTTP 400.

### REQ-004: Interface de Gerenciamento e Configuração
- Tela principal de gerenciamento em `public/modules/gestor-token/gestor-token.html` com tabela, seletores multiselect (`#containerUfs`, `#containerDdds`, `#containerSupervisores`) e modal de cadastro.
- Sub-painel de configurações em `public/modules/config-sistema/gestor-token/gestor-token-config.html` para alterar regras do gatilho e visibilidade no Stepper.
- Grupo de campos TBP/Senior Account auto-preenchido no Stepper de Contratos com base no estado e DDD selecionados (detalhes de disparo via CEP e tratamento na UI em [sub-specs/cep-token-trigger/spec.md](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades/.specs/features/modulo-gestor-tokens/sub-specs/cep-token-trigger/spec.md)).

## 3. Requisitos Não-Funcionais
- **SOLID & Modularidade**: Módulo encapsulado em `src/modules/gestor-token/` com separação de responsabilidades (routes, controller, service, models, schemas).
- **Segurança & ACL**: Operações CRUD protegidas por `authorizePermission("gestor-token:manage")`. Endpoints de consulta (`/resolve`, `/ufs`) liberados para usuários autenticados (`protect`).
- **Resiliência**: Fallback gracioso para estado (`uf` pertencente a `ufs`) e validação de schema Zod em todos os dados de entrada.

## 4. Requisitos Corretivos

### REQ-005: Seletor Multiselect de UFs (`#containerUfs`) e Layout do Modal
- O antigo campo `<select id="modalUf">` foi substituído por um container de checkboxes em grade (`#containerUfs`), organizando as 27 UFs em 3 linhas fixas de 9 estados cada (sem scroll).
- O campo **Login de Acesso** (`#modalLogin`) é posicionado ao lado do **CNPJ TBP** (`#modalCnpjTbp`) em um layout compacto de 2 colunas.
- Ao marcar/desmarcar UFs em `#containerUfs`, os DDDs correspondentes são agregados dinamicamente em `#containerDdds`, ficando pré-selecionados (`checked`) por padrão.

### REQ-006: Fonte legível nos containers de DDDs e Supervisores
- As labels de checkboxes dentro de `#containerDdds` e `#containerSupervisores` devem usar `font-size: 1rem` (antes `0.85rem` inline), acompanhando a referência visual de `#containerDdds`.
- Implementação:
  - `public/modules/gestor-token/gestor-token.css`: `.checkbox-group-container label { font-size: 1rem; }`.
  - `public/modules/gestor-token/gestor-token.js`: remover `font-size:0.85rem` inline das labels (supervisores e DDDs).

### REQ-007: Exibição dos nomes reais de supervisores
- O campo real de nome do `User` é `nome` (não `name`). Todos os pontos que populam/selencionam `name` devem usar `nome` para exibir os nomes corretamente (sem `undefined`).
- Implementação:
  - `src/modules/gestor-token/services/gestorTokenService.js`: 7 populates `"supervisores", "name..."` → `"nome..."`.
  - `src/modules/gestor-token/controllers/gestorTokenController.js`: `select("name email cargo")` → `select("nome email cargo")` e `sort({ name: 1 })` → `sort({ nome: 1 })`.
  - `public/modules/gestor-token/gestor-token.js`: `sup.name` → `sup.nome` e `s.name || s` → `s.nome || s`.
