# Database Schema Documentation

> **Data**: 2026-07-20
> **Atualizado em**: 2026-08-11
> **Cobertura**: 11 modelos, 2 databases

> **Nota de Arquitetura**: Este projeto possui **2 componentes** — o Servidor Central (`src/`) e o Robô Standalone (`robot-standalone/`). Os modelos abaixo pertencem ao **Servidor Central**. O Robô Standalone não possui models próprios — ele se comunica com o servidor via HTTP e opera sobre os mesmos dados através dos endpoints da API.

---

## Databases

| Database                   | URI / Conexão                              | Coleções                                     |
| -------------------------- | ------------------------------------------ | -------------------------------------------- |
| `db_crm_funil` (padrão)    | `MONGO_URI` → `mongoose.connect()`         | users, teams, opportunities, goals, offers, perfis_import, auditlogs, watchlistconfigs |
| `crm_contracts` (secundário)| `mongoose.connection.useDb("crm_contracts")` | contracts, docusign_envelopes                |

**Config**: `src/config/database.js` — mesma instância MongoDB (porta 27017), databases separados.

---

## Índice

| #  | Modelo          | Collection             | Database        | Página |
| -- | --------------- | ---------------------- | --------------- | ------ |
| 1  | User            | `users`                | `db_crm_funil`  | ↓      |
| 2  | Team            | `teams`                | `db_crm_funil`  | ↓      |
| 3  | Opportunity     | `opportunities`        | `db_crm_funil`  | ↓      |
| 4  | Goal            | `goals`                | `db_crm_funil`  | ↓      |
| 5  | Offer           | `offers`               | `db_crm_funil`  | ↓      |
| 6  | ImportProfile   | `perfis_import`        | `db_crm_funil`  | ↓      |
| 7  | AuditLog        | `auditlogs`            | `db_crm_funil`  | ↓      |
| 8  | WatchlistConfig | `watchlistconfigs`     | `db_crm_funil`  | ↓      |
| 9  | Contract        | `contracts`            | `crm_contracts` | ↓      |
| 10 | DocusignEnvelope| `docusign_envelopes`   | `crm_contracts` | ↓      |
| 11 | RobotJob        | `robot_jobs`           | `crm_contracts` | ↓      |

---

# Database `db_crm_funil`

---

## 1. User (`users`)

**Arquivo**: `src/models/User.js`

### Campos

| Campo | Tipo | Obrigatório | Unique | Default | Descrição |
| ----- | ---- | ----------- | ------ | ------- | --------- |
| `nome` | `String` | ✅ | ❌ | — | Nome do usuário, `trim: true` |
| `email` | `String` | ✅ | ✅ | — | Email, `lowercase: true`, `trim: true` |
| `senha` | `String` | ✅ | ❌ | — | Armazena bcrypt hash |
| `cargo` | `String` | ✅ | ❌ | — | `enum` (ver Enums) |
| `equipe_id` | `ObjectId` → `Team` | ❌ | ❌ | `null` | Referência à equipe |
| `ativo` | `Boolean` | ❌ | ❌ | `true` | Soft delete |

### Enums

| Campo | Valores |
| ----- | ------- |
| `cargo` | `admin`, `coordenador`, `supervisor`, `vendedor`, `suporte` |

### Índices

| Index   | Campo   | Unique |
| ------- | ------- | ------ |
| Padrão  | `email` | ✅     |

### Hooks & Métodos

- `pre("save")`: gera hash bcrypt (10 rounds) se `senha` foi modificada
- `matchPassword(password)`: compara senha com hash via `bcrypt.compare`

### Relacionamentos

| Campo         | Ref  | Tipo     | Cardinalidade |
| ------------- | ---- | -------- | ------------- |
| `equipe_id`   | Team | opcional | Muitos Users → 1 Team |

---

## 2. Team (`teams`)

**Arquivo**: `src/models/Team.js`

### Campos

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `nome` | `String` | ✅ | Nome da equipe, `trim: true` |
| `supervisor_id` | `ObjectId` → `User` | ✅ | Supervisor responsável |
| `coordenador_id` | `ObjectId` → `User` | ✅ | Coordenador responsável |

### Índices

Nenhum índice explícito além de `_id`.

### Relacionamentos

| Campo            | Ref  | Tipo     | Cardinalidade      |
| ---------------- | ---- | -------- | ------------------ |
| `supervisor_id`  | User | obrigatório | 1 Team → 1 User   |
| `coordenador_id` | User | obrigatório | 1 Team → 1 User   |

---

## 3. Opportunity (`opportunities`)

**Arquivo**: `src/models/Opportunity.js`

### Campos — Identificação

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `documento` | `String` | ✅ | CPF/CNPJ, `trim: true` |
| `nome_razaoSocial` | `String` | ✅ | Nome ou razão social |
| `uf` | `String` | ✅ | `enum` siglas estados BR (AC-TO) |

### Campos — Dados Pessoais (PF)

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `identidade` | `String` | ❌ | — | RG |
| `orgao_expedidor` | `String` | ❌ | — | Órgão emissor RG |
| `data_emissao` | `Date` | ❌ | — | Data de emissão RG |
| `identidade_uf` | `String` | ❌ | — | UF do RG, `enum` AC-TO |
| `sexo` | `String` | ❌ | — | `enum`: M, F |
| `data_nascimento` | `Date` | ❌ | — | |
| `nacionalidade` | `String` | ❌ | `"Brasileira"` | |
| `nome_mae` | `String` | ❌ | — | Nome da mãe |
| `email` | `String` | ❌ | — | `lowercase: true`, `trim: true` |

### Campos — Endereço de Instalação (`endereco_instalacao`)

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `endereco_instalacao.logradouro` | `String` | ❌ | |
| `endereco_instalacao.numero` | `String` | ❌ | |
| `endereco_instalacao.complemento` | `String` | ❌ | |
| `endereco_instalacao.bairro` | `String` | ❌ | |
| `endereco_instalacao.cidade` | `String` | ❌ | |
| `endereco_instalacao.uf` | `String` | ❌ | `enum` AC-TO |
| `endereco_instalacao.cep` | `String` | ❌ | |
| `endereco_instalacao.ponto_referencia` | `String` | ❌ | |

### Campos — Negociação

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `negociacao` | `String` | ✅ | `enum` (ver Enums) |
| `tipo_negociacao` | `String` | ✅ | `enum` (ver Enums) |
| `probabilidade` | `String` | ✅ | `enum`: Baixa, Médio, Alta, Ganho, Perdido |
| `status_negociacao` | `String` | ✅ | `enum` (16 valores, ver Enums) |
| `previsao_fechamento` | `Number` | ✅ | Semana do ano (1-52) |
| `origem_negociacao` | `String` | ✅ | Origem da negociação |

### Campos — Valores

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `quantidade_acessos` | `Number` | ✅ | — | |
| `receita` | `String` | ✅ | — | Armazenado como string |
| `forma_pagamento` | `String` | ❌ | — | |
| `credito` | `Boolean` | ❌ | `false` | |
| `quantidade_aparelhos` | `Number` | ❌ | `0` | |
| `modalidade_venda` | `String` | ✅ | — | `enum`: ComodatoVenda, Facilitada |

### Campos — Contatos (condicional para PJ)

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `contato_nome` | `String` | ✅ se `tipo_cliente === "PJ"` | |
| `cargo` | `String` | ✅ se `tipo_cliente === "PJ"` | |
| `departamento` | `String` | ❌ | |

### Campos — Telefones

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `ddd_profissional` | `String` | ✅ | — | |
| `telefone_profissional` | `String` | ✅ | — | |
| `is_whatsapp_profissional` | `Boolean` | ❌ | `false` | |
| `ddd_particular` | `String` | ❌ | — | |
| `telefone_particular` | `String` | ❌ | — | |
| `is_whatsapp_particular` | `Boolean` | ❌ | `false` | |

### Campos — Sistema / Metadados

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `responsavel_id` | `ObjectId` → `User` | ✅ | — | Vendedor responsável |
| `created_by` | `ObjectId` → `User` | ❌ | — | Quem criou a oportunidade |
| `responsavel_vtme` | `String` | ❌ | — | Responsável no sistema VTME |
| `equipe_id` | `ObjectId` → `Team` | ❌ | — | Equipe |
| `supervisor_id` | `ObjectId` → `User` | ❌ | — | Supervisor |
| `coordenador_id` | `ObjectId` → `User` | ❌ | — | Coordenador |
| `equipe_venda` | `String` | ❌ | — | `enum`: SMB, ULTRA |
| `tipo_cliente` | `String` | ❌ | — | `enum`: PF, PJ |
| `tipo_formulario` | `String` | ❌ | `"Oportunidade"` | `enum`: Oportunidade, Venda |
| `proximo_contato` | `Date` | ❌ | — | Data do próximo contato |
| `oferta_id` | `ObjectId` → `Offer` | ❌ | — | Oferta vinculada |

### Subdocumento — `observacoes_gerais[]`

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `texto` | `String` | ✅ | — | Conteúdo da observação |
| `data` | `Date` | ❌ | `Date.now` | |
| `autor` | `String` | ❌ | — | |
| `contato_falado` | `String` | ❌ | — | |
| `tipo` | `String` | ❌ | `"MANUAL"` | `enum`: MANUAL, SISTEMA, LEGADO |

### Campos — Dados de Sócio / Venda

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `cpf_socio` | `String` | ❌ | |
| `nome_socio` | `String` | ❌ | |
| `email_socio` | `String` | ❌ | |
| `ddd_socio` | `String` | ❌ | |
| `celular_socio` | `String` | ❌ | |
| `data_vencimento` | `Number` | ❌ | 1-31 |
| `parque_portado` | `Number` | ❌ | |

### Subdocumento — `dados_concorrencia`

| Campo | Tipo | Obrigatório |
| ----- | ---- | ----------- |
| `parque_concorrencia` | `String` | ❌ |
| `valor_fatura` | `String` | ❌ |
| `operadora` | `String` | ❌ |
| `data_inicio_contrato` | `Date` | ❌ |

### Subdocumento — `itens[]`

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `tabela_preco` | `String` | ❌ | — | |
| `cpf` | `String` | ❌ | — | |
| `email` | `String` | ❌ | — | |
| `ddd` | `String` | ❌ | — | |
| `numero_portado` | `String` | ❌ | — | |
| `vendedor` | `String` | ❌ | — | |
| `quantidade` | `Number` | ❌ | `1` | |
| `receita` | `String` | ❌ | — | |
| `tipo_chip` | `String` | ❌ | — | |

### Campo — `imported_data` (dados de importação)

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `imported_data` | `Schema.Types.Mixed` | ❌ | `null` | Dados de sistemas externos (XLSX/CSV). Estrutura flexível: `produto`, `contrato`, `cliente`, `pedido`, `client_document`, `order_id`, etc. |

### Índices

| Index                                                      | Unique | Sparse |
| ---------------------------------------------------------- | ------ | ------ |
| `{ imported_data: 1 }`                                     | ❌     | ✅     |
| `{ documento: 1, "imported_data.client_document": 1 }`     | ❌     | ✅     |
| `{ "imported_data.order_id": 1 }`                          | ✅     | ✅     |

### Enums

| Campo | Valores |
| ----- | ------- |
| `uf` / `identidade_uf` / `endereco_instalacao.uf` | AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO |
| `negociacao` | MOVEL, FIXO, RENOVAÇÃO, TIM Fibra + Fixo, TIM Fibra |
| `tipo_negociacao` | Cliente Novo, Migração PF/PJ, Portabilidade, Reneg, TT, Ultra Fibra |
| `probabilidade` | Baixa, Médio, Alta, Ganho, Perdido |
| `status_negociacao` | Em Negociação, Fechado, Aguardando Documentação, Aguardando Imput, Imputado, Concluido, Reprovado por Crédito, Reprovado, Debito na TIM, Aguardando Análise Anti-Fraude, Aguardando Entrega, Aguardando Check, Aguardando correção de consultor, Erro Portabilidade, Cancelado, Em Processo de Ativação |
| `modalidade_venda` | ComodatoVenda, Facilitada |
| `equipe_venda` | SMB, ULTRA |
| `tipo_cliente` | PF, PJ |
| `tipo_formulario` | Oportunidade, Venda |
| `sexo` | M, F |
| `observacoes_gerais.tipo` | MANUAL, SISTEMA, LEGADO |

### Relacionamentos

| Campo | Ref  | Tipo | Cardinalidade |
| ----- | ---- | ---- | ------------- |
| `responsavel_id` | User | obrigatório | Muitas Opportunities → 1 User |
| `created_by` | User | opcional | Muitas Opportunities → 1 User |
| `equipe_id` | Team | opcional | Muitas Opportunities → 1 Team |
| `supervisor_id` | User | opcional | Muitas Opportunities → 1 User |
| `coordenador_id` | User | opcional | Muitas Opportunities → 1 User |
| `oferta_id` | Offer | opcional | Muitas Opportunities → 1 Offer |

---

## 4. Goal (`goals`)

**Arquivo**: `src/models/Goal.js`

### Campos

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `user_id` | `ObjectId` → `User` | ✅ | — | Usuário dono da meta |
| `meta_financeira` | `Number` | ✅ | — | Valor financeiro da meta |
| `campaign_id` | `ObjectId` → `Campaign` | ❌ | — | Campanha (modelo externo no módulo de comissões) |
| `meta_quantidade` | `Number` | ✅ | — | Quantidade, validada com `Number.isInteger` |
| `inicio_atuacao` | `Date` | ✅ | — | Data de início |

### Índices

Nenhum índice explícito além de `_id`.

### Relacionamentos

| Campo | Ref | Tipo | Cardinalidade |
| ----- | --- | ---- | ------------- |
| `user_id` | User | obrigatório | Muitas Goals → 1 User |
| `campaign_id` | Campaign | opcional | Muitas Goals → 1 Campaign |

---

## 5. Offer (`offers`)

**Arquivo**: `src/models/Offer.js`

### Campos

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `nome` | `String` | ✅ | — | Nome da oferta |
| `valor` | `Number` | ✅ | — | Valor monetário |
| `dataVencimento` | `Date` | ✅ | — | Data de vencimento |
| `produto` | `String` | ❌ | — | Produto associado |
| `sistemaInterno` | `String` | ❌ | `"Easy Vendas"` | `enum`: Easy Vendas, VTME |
| `criadoEm` | `Date` | ❌ | `Date.now` | Data de criação manual |

### Enums

| Campo | Valores |
| ----- | ------- |
| `sistemaInterno` | Easy Vendas, VTME |

### Índices

Nenhum índice explícito além de `_id`.

### Observações

- Schema **não** possui `timestamps: true` — `criadoEm` é manual.
- Relacionamento com Opportunity é **reverso** (Opportunity.oferta_id → Offer).

---

## 6. ImportProfile (`perfis_import`)

**Arquivo**: `src/models/ImportProfile.js`

### Campos

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `name` | `String` | ✅ | — | Nome do perfil |
| `description` | `String` | ❌ | — | Descrição |
| `mapping` | `Array` | ❌ | `[]` | Mapeamento colunas → campos (ver subdoc) |
| `equipe_venda` | `String` | ✅ | — | `enum`: SMB, ULTRA |
| `createdBy` | `ObjectId` → `User` | ✅ | — | Quem criou o perfil |
| `createdAt` | `Date` | ❌ | `Date.now` | Data de criação manual |

### Subdocumento — `mapping[]`

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `fileHeader` | `String` | ✅ | Nome da coluna no arquivo |
| `dbField` | `String` | ✅ | Campo correspondente no banco |

### Enums

| Campo | Valores |
| ----- | ------- |
| `equipe_venda` | SMB, ULTRA |

### Índices

Nenhum índice explícito além de `_id`.

### Observações

- **Collection**: `perfis_import` (nome em português, definido explicitamente no schema)
- Schema sem `timestamps: true`

### Relacionamentos

| Campo | Ref | Tipo | Cardinalidade |
| ----- | --- | ---- | ------------- |
| `createdBy` | User | obrigatório | Muitos Perfis → 1 User |

---

## 7. AuditLog (`auditlogs`)

**Arquivo**: `src/models/AuditLog.js`

### Campos

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `entidade` | `String` | ✅ | `"SalesCampaign"` | `enum`: SalesCampaign, User |
| `entidade_id` | `ObjectId` | ✅ | — | ID genérico (sem `ref`, pode referenciar qualquer coleção) |
| `acao` | `String` | ✅ | — | Ex: CREATE, UPDATE_STATUS, PARALYZE, SUSPEND |
| `status_anterior` | `String` | ❌ | — | Status antes da mudança |
| `novo_status` | `String` | ❌ | — | Status depois da mudança |
| `realizado_por` | `ObjectId` → `User` | ✅ | — | Usuário que executou a ação |
| `timestamp` | `Date` | ❌ | `Date.now` | Momento da ação |

### Enums

| Campo | Valores |
| ----- | ------- |
| `entidade` | SalesCampaign, User |

### Índices

Nenhum índice explícito além de `_id`.

### Relacionamentos

| Campo | Ref | Tipo | Cardinalidade |
| ----- | --- | ---- | ------------- |
| `realizado_por` | User | obrigatório | Muitos Logs → 1 User |

---

## 8. WatchlistConfig (`watchlistconfigs`)

**Arquivo**: `src/models/WatchlistConfig.js`

### Campos

| Campo | Tipo | Obrigatório | Default | Min | Max | Descrição |
| ----- | ---- | ----------- | ------- | --- | --- | --------- |
| `sellerFilter` | `String` | ❌ | `"all"` | — | — | Filtro de vendedores (`"all"`, `"active"`, `"inactive"`) |
| `minDaysSinceLastOp` | `Number` | ❌ | `1` | 0 | 365 | Dias mínimos sem criar oportunidades |
| `warningOpsDesatualizadas` | `Number` | ❌ | `1` | 1 | 100 | Mínimo de ops desatualizadas (alerta amarelo) |
| `warningDiasSemOps` | `Number` | ❌ | `1` | 1 | 365 | Dias mínimos sem ops (alerta amarelo) |
| `criticalOpsDesatualizadas` | `Number` | ❌ | `3` | 1 | 100 | Mínimo de ops desatualizadas (alerta vermelho) |
| `criticalDiasSemOps` | `Number` | ❌ | `3` | 1 | 365 | Dias mínimos sem ops (alerta vermelho) |
| `updatedBy` | `ObjectId` → `User` | ❌ | — | — | — | Quem atualizou a config |

### Índices

Nenhum índice explícito além de `_id`.

### Relacionamentos

| Campo | Ref | Tipo | Cardinalidade |
| ----- | --- | ---- | ------------- |
| `updatedBy` | User | opcional | Muitas Configs → 1 User |

---

# Database `crm_contracts`

---

## 9. Contract (`contracts`)

**Arquivo**: `src/modules/contract/models/Contract.js`
**Conexão**: `getContractsConnection()` → `mongoose.connection.useDb("crm_contracts")`

### Campos — Relacionamentos

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `opportunityId` | `ObjectId` → `Opportunity` | ❌ | `null` | Oportunidade vinculada |
| `createdBy` | `ObjectId` → `User` | ❌ | — | Usuário que criou |

### Subdocumento — `client`

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `client.razaoSocial` | `String` | ❌ | |
| `client.cnpj` | `String` | ❌ | |
| `client.inscricaoEstadual` | `String` | ❌ | |
| `client.ramoAtividade` | `String` | ❌ | |
| `client.tipoEmpresa` | `String` | ❌ | |

#### Sub-subdocumentos de `client`

| Caminho | Tipo | Conteúdo |
| ------- | ---- | -------- |
| `client.endereco` | `Object` | cep, logradouro, numero, complemento, bairro, cidade, estado |
| `client.admin` | `Object` | nome, rg, orgao, cpf, email, telefone |
| `client.representante` | `Object` | nome, rg, orgao, cpf, email, telefone |
| `client.socios[]` | `Array` | nome, rg, cpf, isPJ, telefone, email |
| `client.testemunhas[]` | `Array` | nome, cpf |
| `client.recebedor` | `Object` | nome, rg, orgao, cpf, telefone |

### Subdocumento — `negotiation[]`

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `tipoContratacao` | `String` | ❌ | — | |
| `tipoVenda` | `String` | ❌ | — | |
| `acessos` | `Number` | ❌ | — | |
| `ddd` | `String` | ❌ | — | |
| `plano` | `String` | ❌ | — | |
| `oferta` | `String` | ❌ | — | |
| `aparelho` | `String` | ❌ | — | |
| `roaming` | `Boolean` | ❌ | — | |
| `valorMensal` | `Number` | ❌ | — | |
| `perfil` | `String` | ❌ | — | |
| `isCombo` | `Boolean` | ❌ | `false` | Se a oferta é um combo |
| `itensCombo[]` | `Array` | ❌ | — | Itens desestruturados do combo (`item`, `valor`, `percentual`) |
| `tipoLinha` | `String` | ❌ | `"linha-nova"` | `enum`: port-in, linha-nova |
| `portabilityLines[]` | `Array` | ❌ | — | Linhas portadas (ver abaixo) |

#### Sub-subdocumento — `negotiation[].portabilityLines[]`

| Campo | Tipo | Enum |
| ----- | ---- | ---- |
| `tipoCedente` | `String` | PF, PJ |
| `operadoraDoadora` | `String` | — |
| `nomeCedente` | `String` | — |
| `cpfCnpjCedente` | `String` | — |
| `numero` | `String` | — |

### Subdocumento — `documents[]`

| Campo | Tipo | Obrigatório | Default | Enum |
| ----- | ---- | ----------- | ------- | ---- |
| `type` | `String` | ❌ | — | termo, proposta, permanencia |
| `originalUrl` | `String` | ❌ | — | |
| `generatedAt` | `Date` | ❌ | `Date.now` | |

### Campo — `status`

| Campo | Tipo | Obrigatório | Default | Enum |
| ----- | ---- | ----------- | ------- | ---- |
| `status` | `String` | ❌ | `"rascunho"` | rascunho, gerado, enviado, assinado, cancelado |

### Índices

Nenhum índice explícito além de `_id`.

### Enums

| Campo | Valores |
| ----- | ------- |
| `status` | rascunho, gerado, enviado, assinado, cancelado |
| `negotiation[].tipoLinha` | port-in, linha-nova |
| `negotiation[].portabilityLines[].tipoCedente` | PF, PJ |
| `documents[].type` | termo, proposta, permanencia |

### Relacionamentos

| Campo | Ref | Tipo | Cardinalidade |
| ----- | --- | ---- | ------------- |
| `opportunityId` | Opportunity | opcional | Muitos Contracts → 1 Opportunity |
| `createdBy` | User | opcional | Muitos Contracts → 1 User |

---

## 10. DocusignEnvelope (`docusign_envelopes`)

**Database**: `crm_contracts` (conexão secundária via `getContractsConnection()`)
**Arquivo**: `src/modules/docusign/models/DocusignEnvelope.js`

---

## 11. RobotJob (`robot_jobs`)

**Database**: `crm_contracts` (conexão secundária via `getContractsConnection()`)
**Arquivo**: `src/modules/robot-docusign/models/RobotJob.js`
**Componente**: Servidor Central — o Robô Standalone consome esta fila via endpoints de instância (`/instance/next-job`)

### Campos — Identificação e Relacionamento

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `contract_id` | `ObjectId` → `Contract` | ✅ | — | ID do contrato vinculado |
| `contractId` | `ObjectId` → `Contract` | ❌ | — | Alias para contract_id (sincronizado via pre-save) |

### Campos — Ação e Status

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `action` | `String` | ✅ | — | `enum`: send, status, download, resend, reports |
| `status` | `String` | ❌ | `"pending"` | `enum`: pending, processing, running, completed, success, failed, retrying |

### Campos — Modo de Operação

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `robot_mode` | `Boolean` | ❌ | `false` | Flag de modo robô |
| `mode` | `String` | ❌ | `"robot"` | `enum`: robot, api |

### Campos — Tentativas e Retry

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `attempts` | `Number` | ❌ | `0` | Número de tentativas |
| `retryCount` | `Number` | ❌ | `0` | Alias para attempts (sincronizado via pre-save) |
| `max_attempts` | `Number` | ❌ | `3` | Máximo de tentativas |
| `next_retry_at` | `Date` | ❌ | — | Próxima tentativa agendada |

### Campos — Timestamps de Ciclo de Vida

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `startedAt` | `Date` | ❌ | Data/hora de início da execução |
| `completedAt` | `Date` | ❌ | Data/hora de conclusão da execução |

### Campos — Logs e Erros

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `error` | `String` | ❌ | Mensagem de erro atual |
| `lastError` | `String` | ❌ | Última mensagem de erro (sincronizado via pre-save) |

### Subdocumento — `steps[]` (Log de Execução por Passo)

| Campo | Tipo | Obrigatório | Default | Descrição |
| ----- | ---- | ----------- | ------- | --------- |
| `name` | `String` | ✅ | — | Nome do passo |
| `status` | `String` | ❌ | `"pending"` | `enum`: pending, running, success, failed |
| `timestamp` | `Date` | ❌ | `Date.now` | Momento da execução |
| `duration` | `Number` | ❌ | `0` | Duração em milissegundos |
| `error` | `String` | ❌ | — | Erro específico do passo |

### Campos — Dados de Retorno DocuSign

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `envelopeId` | `String` | ❌ | ID do envelope retornado pela DocuSign |
| `signedDocPath` | `String` | ❌ | Caminho do arquivo PDF baixado |
| `result` | `Mixed` | ❌ | Dados de retorno genéricos |

### Campo — Auditoria

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `created_by` | `ObjectId` → `User` | ❌ | Usuário que criou o job |

### Índices

| Index | Campo(s) | Tipo |
| ----- | -------- | ---- |
| Padrão | `contract_id` | Simples |
| Padrão | `status` | Simples |
| Padrão | `next_retry_at` | Simples |
| Composto | `{ contractId: 1, status: 1 }` | Composto |
| Composto | `{ createdAt: -1 }` | Ordenação descendente |

### Enums

| Campo | Valores |
| ----- | ------- |
| `action` | send, status, download, resend, reports |
| `status` | pending, processing, running, completed, success, failed, retrying |
| `mode` | robot, api |
| `steps[].status` | pending, running, success, failed |

### Hooks

- `pre("save")`: Sincroniza aliases de convenção:
  - `contract_id` ↔ `contractId`
  - `attempts` ↔ `retryCount`
  - `error` ↔ `lastError`

### Relacionamentos

| Campo | Ref | Tipo | Cardinalidade |
| ----- | --- | ---- | ------------- |
| `contract_id` | Contract | obrigatório | Muitos RobotJobs → 1 Contract |
| `created_by` | User | opcional | Muitos RobotJobs → 1 User |

### Campos

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `contractId` | `ObjectId` (ref Contract) | ✅ | Vínculo com o contrato |
| `envelopeId` | `String` | ❌ | ID do envelope no DocuSign |
| `status` | `String` | ❌ | `enum`: rascunho, created, sent, delivered, completed, declined, voided |
| `signer` | `Object` | ❌ | `{ nome, email, cpf }` |
| `sentAt` | `Date` | ❌ | Data de envio |
| `completedAt` | `Date` | ❌ | Data de conclusão |
| `webhookEvents[]` | `Array` | ❌ | `{ event: String, timestamp: Date }` |
| `accessHash` | `String` | ❌ | Hash de acesso ao documento |
| `signedDocPath` | `String` | ❌ | Caminho do documento assinado |
| `clientDocs[]` | `Array` | ❌ | Documentos enviados pelo cliente (ver abaixo) |

### Subdocumento — `clientDocs[]`

| Campo | Tipo | Descrição |
| ----- | ---- | --------- |
| `type` | `String` (`{ type: String }`) | Tipo do documento (ex: rg, cpf, contrato_social) |
| `originalName` | `String` | Nome original do arquivo |
| `filePath` | `String` | Caminho no disco |
| `uploadedAt` | `Date` | Data de upload (default: `Date.now`) |

### Relacionamentos

| Campo | Ref | Tipo | Cardinalidade |
| ----- | --- | ---- | ------------- |
| `contractId` | Contract | obrigatório | 1 DocusignEnvelope → 1 Contract |

---

# Mapa de Relacionamentos Completo

| Origem | Campo | Destino | Tipo | Database |
| ------ | ----- | ------- | ---- | -------- |
| User | `equipe_id` | Team | opcional (M→1) | db_crm_funil |
| Team | `supervisor_id` | User | obrigatório (1→1) | db_crm_funil |
| Team | `coordenador_id` | User | obrigatório (1→1) | db_crm_funil |
| Opportunity | `responsavel_id` | User | obrigatório (M→1) | db_crm_funil |
| Opportunity | `created_by` | User | opcional (M→1) | db_crm_funil |
| Opportunity | `supervisor_id` | User | opcional (M→1) | db_crm_funil |
| Opportunity | `coordenador_id` | User | opcional (M→1) | db_crm_funil |
| Opportunity | `equipe_id` | Team | opcional (M→1) | db_crm_funil |
| Opportunity | `oferta_id` | Offer | opcional (M→1) | db_crm_funil |
| Goal | `user_id` | User | obrigatório (M→1) | db_crm_funil |
| Goal | `campaign_id` | Campaign | opcional (M→1) | db_crm_funil |
| ImportProfile | `createdBy` | User | obrigatório (M→1) | db_crm_funil |
| AuditLog | `realizado_por` | User | obrigatório (M→1) | db_crm_funil |
| WatchlistConfig | `updatedBy` | User | opcional (M→1) | db_crm_funil |
| Contract | `opportunityId` | Opportunity | opcional (M→1) | crm_contracts → db_crm_funil |
| Contract | `createdBy` | User | opcional (M→1) | crm_contracts → db_crm_funil |
| DocusignEnvelope | `contractId` | Contract | obrigatório (1→1) | crm_contracts |
| RobotJob | `contract_id` | Contract | obrigatório (M→1) | crm_contracts |
| RobotJob | `created_by` | User | opcional (M→1) | crm_contracts → db_crm_funil |

---

# Resumo de Enums por Modelo

| Modelo | Campo | Enumeradores |
| ------ | ----- | ------------ |
| **User** | `cargo` | admin, coordenador, supervisor, vendedor, suporte |
| **Opportunity** | `uf` | AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO |
| **Opportunity** | `negociacao` | MOVEL, FIXO, RENOVAÇÃO, TIM Fibra + Fixo, TIM Fibra |
| **Opportunity** | `tipo_negociacao` | Cliente Novo, Migração PF/PJ, Portabilidade, Reneg, TT, Ultra Fibra |
| **Opportunity** | `probabilidade` | Baixa, Médio, Alta, Ganho, Perdido |
| **Opportunity** | `status_negociacao` | Em Negociação, Fechado, Aguardando Documentação, Aguardando Imput, Imputado, Concluido, Reprovado por Crédito, Reprovado, Debito na TIM, Aguardando Análise Anti-Fraude, Aguardando Entrega, Aguardando Check, Aguardando correção de consultor, Erro Portabilidade, Cancelado, Em Processo de Ativação |
| **Opportunity** | `modalidade_venda` | ComodatoVenda, Facilitada |
| **Opportunity** | `equipe_venda` | SMB, ULTRA |
| **Opportunity** | `tipo_cliente` | PF, PJ |
| **Opportunity** | `tipo_formulario` | Oportunidade, Venda |
| **Opportunity** | `sexo` | M, F |
| **Opportunity** | `observacoes_gerais.tipo` | MANUAL, SISTEMA, LEGADO |
| **Offer** | `sistemaInterno` | Easy Vendas, VTME |
| **ImportProfile** | `equipe_venda` | SMB, ULTRA |
| **AuditLog** | `entidade` | SalesCampaign, User |
| **WatchlistConfig** | `sellerFilter` | all, active, inactive |
| **Contract** | `status` | rascunho, gerado, enviado, assinado, cancelado |
| **DocusignEnvelope** | `status` | rascunho, created, sent, delivered, completed, declined, voided |
| **Contract** | `negotiation[].tipoLinha` | port-in, linha-nova |
| **Contract** | `negotiation[].portabilityLines[].tipoCedente` | PF, PJ |
| **Contract** | `documents[].type` | termo, proposta, permanencia |

---

# ADRs Relacionados

| ADR   | Título | Relação |
| ----- | ------ | ------- |
| AD-002 | Databases separadas (`db_crm_funil` + `crm_contracts`) | Separação de databases por domínio |
| AD-003 | Vínculo Contract ↔ Opportunity via `opportunityId` (sem cascade) | Referência sem cascade delete |
| AD-011 | Parsing manual de datas com `new Date(year, month-1, day)` | Evita discrepância UTC vs America/Sao_Paulo |
| AD-017 | `negotiation` como array de objetos no schema Contract | Schema design do Contract |
| AD-021 | Renomear `MONGO_URI_CRM_CONTRACTS` para `MONGO_URI_CLIENT_SERVER` | Infraestrutura / conexão |
| AD-022 | Separação de specs por Bounded Context | Extração do módulo DocuSign |
