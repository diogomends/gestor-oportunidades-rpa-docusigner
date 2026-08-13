# Database Specification

## Problem Statement

A documentação dos schemas do MongoDB está espalhada por múltiplos arquivos (`docs/features/`, `.specs/features/`, `AGENTS.md`, `STATE.md`). Não há um diagrama entidade-relacionamento nem um documento centralizado que mostre todos os modelos, seus campos, índices e relacionamentos. Isso dificulta onboarding, análise de impacto de mudanças e manutenção do schema.

## Goals

- [ ] Centralizar a documentação de todos os 9+ modelos em um único lugar
- [ ] Criar um diagrama ER visual (Mermaid) das duas databases
- [ ] Documentar campos, tipos, enums, índices e relacionamentos de cada schema

> **⚠️ NÃO IMPLEMENTADO**: O diretório `.specs/database/` não existe. Os arquivos `schema.md` e `ER-diagram.md` nunca foram criados. Os models (~15) estão espalhados em `src/models/` e `src/modules/*/models/` sem documentação centralizada.

## Out of Scope

| Item                  | Reason                                |
| --------------------- | ------------------------------------- |
| Modelo Campaign       | Vive no módulo de comissões, não mapeado |
| Diagrama físico       | Apenas lógico (nível de schema Mongoose) |
| Geração automática    | Documento estático, mantido manualmente |

---

## User Stories

### P1: Database Schema Documentation ⭐ MVP

**User Story**: As a developer, I want a centralized document describing all Mongoose schemas so that I can understand the data model without reading 9+ source files.

**Why P1**: Core need — sem isso não há spec de banco.

**Acceptance Criteria**:

1. WHEN a developer reads `.specs/database/schema.md` THEN it SHALL document all 9 models (User, Opportunity, Team, Goal, Offer, ImportProfile, AuditLog, WatchlistConfig, Contract)
2. WHEN a model has fields THEN each field SHALL list: name, type, required/optional, default, enum values (if applicable), refs
3. WHEN a model has indexes THEN they SHALL be documented
4. WHEN a model has relationships THEN they SHALL be documented with source and target model

**Independent Test**: Open `.specs/database/schema.md` and verify each model section contains all required field information.

### P1: ER Diagram ⭐ MVP

**User Story**: As a developer, I want an entity-relationship diagram so that I can visualize how models connect across the two databases.

**Why P1**: Visual understanding is faster than reading field tables.

**Acceptance Criteria**:

1. WHEN a developer reads `.specs/database/ER-diagram.md` THEN it SHALL render a Mermaid ER diagram
2. WHEN the diagram is rendered THEN all 9 entities SHALL be present
3. WHEN entities have relationships THEN the diagram SHALL show them with labeled edges
4. WHEN entities belong to different databases THEN the diagram SHALL visually separate `db_crm_funil` and `crm_contracts`

**Independent Test**: Open `.specs/database/ER-diagram.md` in GitHub/VS Code and verify the Mermaid renders correctly showing all models and relationships.

---

## Requirement Traceability

| ID   | Story           | Description                        | Status |
| ---- | --------------- | ---------------------------------- | ------ |
| DB-01 | Schema Docs     | Documentar todos os 9+ modelos     | ❌ Não implementado — arquivo/schema.md não existe |
| DB-02 | Schema Docs     | Documentar campos com tipo/req/etc | ❌ Não implementado — arquivo/schema.md não existe |
| DB-03 | Schema Docs     | Documentar índices                 | ❌ Não implementado — arquivo/schema.md não existe |
| DB-04 | Schema Docs     | Documentar relacionamentos         | ❌ Não implementado — arquivo/schema.md não existe |
| DB-05 | ER Diagram      | Diagrama Mermaid com 9+ entidades  | ❌ Não implementado — arquivo/ER-diagram.md não existe |
| DB-06 | ER Diagram      | Relacionamentos com arestas        | ❌ Não implementado — arquivo/ER-diagram.md não existe |
| DB-07 | ER Diagram      | Separação visual por database      | ❌ Não implementado — arquivo/ER-diagram.md não existe |

**Status values**: Pending → Verifying → Verified

---

## Success Criteria

- [ ] `.specs/database/schema.md` exists with all 9+ models documented
- [ ] `.specs/database/ER-diagram.md` exists with Mermaid diagram rendering correctly

> **Status**: ❌ Nenhum dos critérios foi atendido. Os arquivos nunca foram criados.
