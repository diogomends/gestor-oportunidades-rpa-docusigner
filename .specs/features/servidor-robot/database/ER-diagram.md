# Diagrama Entidade-Relacionamento

> **Nota de Arquitetura**: Todos os models abaixo pertencem ao **Servidor Central** (`src/`). O **Robô Standalone** (`robot-standalone/`) não possui models próprios — ele se comunica com o servidor via HTTP e opera sobre os mesmos dados através dos endpoints de instância (`/api/robot-docusign/instance/*`).

```mermaid
erDiagram
    %% ===================== DB: db_crm_funil =====================
    %% Entidades do database principal

    User {
        ObjectId _id PK
        string nome "obrigatório"
        string email "obrigatório, unique"
        string cargo "enum: admin|coordenador|supervisor|vendedor|suporte"
        ObjectId equipe_id FK "ref Team, opcional"
        boolean ativo "default true"
    }

    Team {
        ObjectId _id PK
        string nome "obrigatório"
        ObjectId supervisor_id FK "ref User, obrigatório"
        ObjectId coordenador_id FK "ref User, obrigatório"
    }

    Opportunity {
        ObjectId _id PK
        string documento "CPF/CNPJ"
        string nome_razaoSocial
        string uf "enum siglas BR"
        string negociacao "enum: MOVEL|FIXO|RENOVAÇÃO|TIM Fibra + Fixo|TIM Fibra"
        string tipo_negociacao "enum: Cliente Novo|Migração|Portabilidade|Reneg|TT|Ultra Fibra"
        string probabilidade "enum: Baixa|Médio|Alta|Ganho|Perdido"
        string status_negociacao "enum: 16 valores"
        ObjectId responsavel_id FK "ref User, obrigatório"
        ObjectId equipe_id FK "ref Team, opcional"
        ObjectId supervisor_id FK "ref User, opcional"
        ObjectId coordenador_id FK "ref User, opcional"
        ObjectId oferta_id FK "ref Offer, opcional"
        string equipe_venda "enum: SMB|ULTRA"
    }

    Goal {
        ObjectId _id PK
        ObjectId user_id FK "ref User, obrigatório"
        number meta_financeira
        number meta_quantidade "deve ser inteiro"
        date inicio_atuacao
    }

    Offer {
        ObjectId _id PK
        string nome
        number valor
        date dataVencimento
        string sistemaInterno "enum: Easy Vendas|VTME"
    }

    ImportProfile {
        ObjectId _id PK
        string name
        ObjectId createdBy FK "ref User, obrigatório"
        string equipe_venda "enum: SMB|ULTRA"
    }

    AuditLog {
        ObjectId _id PK
        string entidade "enum: SalesCampaign|User"
        ObjectId entidade_id
        string acao
        ObjectId realizado_por FK "ref User, obrigatório"
    }

    WatchlistConfig {
        ObjectId _id PK
        string sellerFilter "enum: all|active|inactive, default all"
        ObjectId updatedBy FK "ref User, opcional"
    }

    %% ===================== DB: crm_contracts =====================
    %% Database separada, mesma instância Mongo

    Contract {
        ObjectId _id PK
        ObjectId opportunityId FK "ref Opportunity, opcional"
        ObjectId createdBy FK "ref User, opcional"
        string status "enum: rascunho|gerado|enviado|assinado|cancelado"
        object client "dados do cliente PJ"
        array negotiation "planos contratados"
    }

    %% ===================== Relacionamentos =====================

    %% Team <-> User
    Team ||--o{ User : "equipe (equipe_id)"
    Team }o--|| User : "supervisor (supervisor_id)"
    Team }o--|| User : "coordenador (coordenador_id)"

    %% Opportunity -> User/Team/Offer
    Opportunity }o--|| User : "responsavel (responsavel_id)"
    Opportunity }o--o| User : "criador (created_by)"
    Opportunity }o--o| User : "supervisor (supervisor_id)"
    Opportunity }o--o| User : "coordenador (coordenador_id)"
    Opportunity }o--o| Team : "equipe (equipe_id)"
    Opportunity }o--o| Offer : "oferta (oferta_id)"

    %% Goal -> User
    Goal }o--|| User : "meta de (user_id)"

    %% ImportProfile -> User
    ImportProfile }o--|| User : "criado por (createdBy)"

    %% AuditLog -> User
    AuditLog }o--|| User : "auditado por (realizado_por)"

    %% WatchlistConfig -> User
    WatchlistConfig }o--o| User : "atualizado por (updatedBy)"

    %% ===================== DB crm_contracts -> db_crm_funil =====
    Contract }o--o| Opportunity : "vinculada a (opportunityId)"
    Contract }o--o| User : "criado por (createdBy)"
```

## Legenda

| Símbolo | Significado              |
| ------- | ------------------------ |
| `||`    | Um (obrigatório)         |
| `o|`    | Zero ou um (opcional)    |
| `}o`    | Zero ou mais (opcional)  |
| `}|`    | Um ou mais (obrigatório) |

## Databases

| Database        | Collection                  | Modelo          | Conexão                      |
| --------------- | --------------------------- | --------------- | ---------------------------- |
| `db_crm_funil`  | `users`                     | User            | `MONGO_URI` (mongoose.connect) |
| `db_crm_funil`  | `teams`                     | Team            | `MONGO_URI`                  |
| `db_crm_funil`  | `opportunities`             | Opportunity     | `MONGO_URI`                  |
| `db_crm_funil`  | `goals`                     | Goal            | `MONGO_URI`                  |
| `db_crm_funil`  | `offers`                    | Offer           | `MONGO_URI`                  |
| `db_crm_funil`  | `perfis_import`             | ImportProfile   | `MONGO_URI`                  |
| `db_crm_funil`  | `auditlogs`                 | AuditLog        | `MONGO_URI`                  |
| `db_crm_funil`  | `watchlistconfigs`          | WatchlistConfig | `MONGO_URI`                  |
| `crm_contracts` | `contracts`                 | Contract        | `useDb("crm_contracts")`     |

> **Nota:** Ambos os databases residem na **mesma instância MongoDB** (porta 27017).
