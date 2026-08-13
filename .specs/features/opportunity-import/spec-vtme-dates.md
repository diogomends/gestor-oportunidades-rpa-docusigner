# Especificação: Campos de Datas VTME na Importação de Oportunidades

> Adição de dois campos de data do sistema VTME (Inserção e Ativação) ao módulo de importação de oportunidades.

---

## Visão Geral

O módulo de importação de oportunidades atualmente suporta a atualização de campos como negociação, tipo_negociacao, quantidade_acessos, receita, status_negociacao e quantidade_aparelhos. 

Esta especificação adiciona dois novos campos de data específicos do sistema VTME que precisam ser importados e mapeados:

1. **Data Inserção VTME** (`data_insercao_vtme`) - Data e hora em que a oportunidade foi inserida no sistema VTME
2. **Data Ativação VTME** (`data_ativacao_vtme`) - Data em que a oportunidade foi ativada no sistema VTME

---

## Requisitos Funcionais

### [REQ-001] Novos Campos no Model Opportunity
- **Descrição**: Adicionar dois campos de tipo Date ao schema do modelo Opportunity
- **Campos**:
  - `data_insercao_vtme`: `{ type: Date }` - Data/hora da inserção no VTME
  - `data_ativacao_vtme`: `{ type: Date }` - Data da ativação no VTME
- **Critérios de Aceite**:
  - Campos são opcionais (não required)
  - Campos aceitam formato ISO de data
  - Campos são persistidos corretamente no MongoDB
  - Campos existentes no schema são preservados

### [REQ-002] Campos Permitidos para Atualização
- **Descrição**: Adicionar os novos campos à lista de campos permitidos para atualização via importação
- **Arquivo**: `src/modules/import-opportunities/services/update-opportunity-fields.js`
- **Campos a adicionar**:
  - `data_insercao_vtme`
  - `data_ativacao_vtme`
- **Critérios de Aceite**:
  - Campos são atualizados apenas quando presentes no mappedData
  - Campos são comparados corretamente (String vs Date)
  - Mudanças são registradas no log de auditoria

### [REQ-003] Mapeamento no Frontend (constants.js)
- **Descrição**: Adicionar os novos campos ao array DB_FIELDS para mapeamento
- **Arquivo**: `public/modules/import-profile/constants.js`
- **Campos a adicionar**:
  - `{ value: "data_insercao_vtme", label: "Data Inserção VTME" }`
  - `{ value: "data_ativacao_vtme", label: "Data Ativação VTME" }`
- **Critérios de Aceite**:
  - Campos aparecem na lista de campos disponíveis para mapeamento
  - Labels são claros e descritivos
  - Campos estão na seção apropriada (campos nativos)

### [REQ-004] Parse de Datas no Frontend
- **Descrição**: Garantir que as datas da planilha sejam parseadas corretamente
- **Formato Esperado**: 
  - Inserção: `DD/MM/YYYY HH:MM` (ex: 03/08/2026 10:47)
  - Ativação: `DD/MM/YYYY` (ex: 06/08/2026)
- **Critérios de Aceite**:
  - Datas no formato brasileiro são convertidas para ISO corretamente
  - Timezone é tratado (usar parsing local, não UTC)
  - Datas vazias ou inválidas são ignoradas

### [REQ-005] Auto-mapeamento para Campos VTME
- **Descrição**: Adicionar sinônimos no auto-mapper para mapeamento automático dos campos VTME
- **Arquivo**: `public/modules/import-profile/auto-mapper.js`
- **Sinônimos a adicionar**:
  - `insercaovtme`, `datainsercaovtme`, `datainsercao` → `data_insercao_vtme`
  - `ativacaovtme`, `dataativacaovtme`, `dataativacao` → `data_ativacao_vtme`
- **Critérios de Aceite**:
  - Mapeamentos legados preservados: `ativacao` → `imported_data.activation_date`, `data` → `imported_data.insertion_date`
  - Função `findBestMatch` continua funcionando corretamente
  - Sinônimos normalizados (lowercase, sem acentos, sem espaços)

---

## Estrutura de Arquivos Afetados

```
src/
├── models/
│   └── Opportunity.js                    # Adicionar campos data_insercao_vtme e data_ativacao_vtme
└── modules/
    └── import-opportunities/
        └── services/
            └── update-opportunity-fields.js  # Adicionar campos à allowedFields

public/
└── modules/
    └── import-profile/
        ├── constants.js                    # Adicionar campos ao DB_FIELDS
        └── auto-mapper.js                  # Adicionar sinônimos para mapeamento automático
```

---

## Restrições & Preservação (Impact Protector)

- **Módulos Legados Preservados**: Todos os módulos existentes permanecem intactos
- **Schema Existente**: Campos existentes no Opportunity schema não são removidos ou alterados
- **Backward Compatibility**: Dados existentes continuam funcionando normalmente
- **Campos Protegidos**: Apenas os dois novos campos são adicionados à lista de permitidos
- **Apenas Importação**: Campos `data_insercao_vtme` e `data_ativacao_vtme` são preenchidos **exclusivamente via importação** — não são editáveis em nenhum formulário UI

---

## Exemplo de Uso

**Planilha Excel**:
| CPF/CNPJ | Inserção | Ativação |
|----------|----------|----------|
| 12345678901 | 03/08/2026 10:47 | 06/08/2026 |

**Mapeamento (Opção 1 - VTME)**:
- Coluna "Inserção" → Campo `data_insercao_vtme`
- Coluna "Ativação" → Campo `data_ativacao_vtme`

**Mapeamento (Opção 2 - Legado)**:
- Coluna "Inserção" → Campo `imported_data.insertion_date`
- Coluna "Ativação" → Campo `imported_data.activation_date`

**Resultado no MongoDB (Opção 1)**:
```json
{
  "documento": "12345678901",
  "data_insercao_vtme": "2026-08-03T10:47:00.000Z",
  "data_ativacao_vtme": "2026-08-06T00:00:00.000Z"
}
```

**Resultado no MongoDB (Opção 2)**:
```json
{
  "documento": "12345678901",
  "imported_data": {
    "insertion_date": "03/08/2026 10:47",
    "activation_date": "06/08/2026"
  }
}
```
