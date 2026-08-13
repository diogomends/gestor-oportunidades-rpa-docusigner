# Spec: Regeração de PDFs de Contratos em Lote (`spec-regeracao-lote`)

## Problem Statement

Após os ajustes no layout do Termo de Contratação e no mapeamento de dados de ofertas/combos (`gerador-pdf-html`), os contratos salvos anteriormente no banco de dados (`crm_contracts`) possuem PDFs antigos armazenados no disco (`uploads/`) sem as novas melhorias visuais (como o detalhamento de ofertas abaixo de Aparelho, correção do vencimento e formatação monetária R$).

É necessário um script automatizado de regeração em lote para atualizar todos os contratos rascunhados e gerados no banco de dados e no storage de arquivos.

---

## Target Architecture & Workflow

```text
┌──────────────────────────────┐
│  MongoDB (crm_contracts)     │
│  Contracts [rascunho,gerado] │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  regenerate-contract-pdfs.js │
│  - Conecta via Mongoose      │
│  - Mapeia client/negotiation │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  geradorPdfHtmlService       │
│  - Playwright HTML → PDF     │
│  - (termo, proposta, perm.)  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  storageService.saveFile()   │
│  - Sobrescreve em uploads/   │
│  - Atualiza generatedAt      │
└──────────────────────────────┘
```

---

## Requirements & Agreed Decisions

### [REQ-REGEN-001] Escopo de Contratos Elegíveis
- **Filtro**: Apenas contratos com `status: { $in: ["rascunho", "gerado"] }` na collection `contracts` do database `crm_contracts`.
- **Proteção**: Contratos com status `assinado` ou `cancelado` NÃO devem ser alterados sob hipótese alguma.

### [REQ-REGEN-002] Documentos Regerados
- Para cada contrato elegível, regerar os 3 tipos de documentos:
  - `termo` (Termo de Contratação)
  - `proposta` (Proposta Comercial)
  - `permanencia` (Contrato de Permanência)

### [REQ-REGEN-003] Mapeamento de Dados do Payload
- Mapear a estrutura do modelo `Contract` (`client`, `negotiation`, `createdBy`) para o formato esperado por `geradorPdfHtmlService.generateContractPDF(type, data)`:
  - `razaoSocial`, `cnpj`, `endereco`, `admTelefone`, `repNome`, `repCpf`, etc.
  - `vencimento`, `tipoFatura`, `tipoContratacao`, `plano`, `aparelho`, `tipoChip`.
  - `ofertas` / `negotiation` (garantindo que ofertas e combos sejam extraídos corretamente).

### [REQ-REGEN-004] Atualização de Storage e Banco
- Sobrescrever o PDF no caminho relativo original (armazenado em `document.originalUrl`) através do `storageService.saveFile(originalUrl, pdfBuffer)`.
- Atualizar a propriedade `generatedAt` de cada documento no array `documents` do contrato no MongoDB.

### [REQ-REGEN-005] Relatório de Execução
- Exibir tabela no terminal ao finalizar a execução contendo:
  - Contrato ID
  - Razão Social / CNPJ
  - Status do Contrato
  - Quantidade de PDFs regerados
  - Status da operacao (OK / ERRO)

### [REQ-REGEN-006] Comandos no Makefile
- `make regenerate-contract-pdfs`: Executa localmente `node src/scripts/regenerate-contract-pdfs.js`.
- `make regenerate-contract-pdfs-prod`: Envia o script via SCP e executa no container de produção (`app_gestor`) via SSH.

---

## Out of Scope (Escopo Protegido - Impact Protector)

| Componente | Status | Motivo |
|---|---|---|
| Contratos com status `assinado` ou `cancelado` | Intocado | Integridade jurídica dos contratos assinados |
| Schemas Mongoose / Estrutura do BD | Intocado | Sem alterações em campos ou índices de modelos |
| Frontend em `public/` | Intocado | Operação 100% server-side / script CLI |
