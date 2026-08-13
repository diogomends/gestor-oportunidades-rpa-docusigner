# Análise do Template — Termo de Contratação TIM

## Metadados do PDF

| Propriedade   | Valor                                          |
|---------------|------------------------------------------------|
| Páginas       | 3                                               |
| Fontes        | Helvetica, Helvetica-Bold |
| Producer      | — |

## Estrutura de Páginas

### Página 1

- **Dimensões:** 595.0 x 842.0 pt (210 x 297 mm)
- **Fontes:** /F1, /F2
- **Imagens:** nenhuma

**Início do texto:**

```
TERMO DE CONTRATAÇÃO - VERSÃO 5.10 1. IDENTIFICAÇÃO DO CLIENTE Razão Social: W A DA SILVA SERVICOS CNPJ: 62.660.580/0001-09 Telefone: \(82\)99321-0839 2. DADOS DA CONTRATAÇÃO Tipo de Contratação: Aditivo Data de Vencimento: Dia 20 Tipo de Fatura: Fatura Eletrônica . Qtd.: 1 DDD: 82 Tipo de Venda: Pr
```

### Página 2

- **Dimensões:** 595.0 x 842.0 pt (210 x 297 mm)
- **Fontes:** /F2, /F1
- **Imagens:** nenhuma

**Início do texto:**

```
contratados neste Termo de Contratação. Não. Consulte os planos compatíveis no site www.tim.com.br. Observação: 3. Assinaturas Representante Legal: ____________________________________________ Nome: WASHINGTON ALBUQUERQUE DA SILVA CPF: 924.150.404-87 Testemunhas: ____________________________________
```

### Página 3

- **Dimensões:** 595.0 x 842.0 pt (210 x 297 mm)
- **Fontes:** /F1, /F2
- **Imagens:** nenhuma

**Início do texto:**

```
O Cliente declara que: Femtocélulas, e/ou acessórios, a Transferência de Titularidade, os Planos de Serviços e os Serviços Adicionais contratados. Tais células e condições encontram-se no Caderno SMP  TIM PME, registrado em Cartório de Títulos e Documentos na cidade do Rio de Janeiro. O Caderno ser
```

## Seções Identificadas

- [x] **IDENTIFICAÇÃO DO CLIENTE** — campos: razaoSocial, cnpj, enderecoCompleto, localidade, cep, repNome, repCpf
- [x] **DADOS DA CONTRATAÇÃO** — campos: tipoContratacao, vencimento, tipoFatura, acessos
- [ ] **DADOS DE CONTATO ADMINISTRATIVO** — campos: admTelefone, admEmail
- [ ] **DADOS DO PRODUTO / SERVIÇO** — campos: ddd, tipoVenda, plano, aparelho
- [ ] **OBSERVAÇÕES** — campos: observacoes
- [x] **ASSINATURAS** — campos: signatures
- [ ] **DETALHAMENTO DE ACESSOS** — campos: tableRows
- [ ] **CLÁUSULAS** — campos: clauses

## Placeholders Identificados

| # | Placeholder      | Tipo     | Valor Exemplo             | Página |
|---|------------------|----------|---------------------------|--------|
| 1 | `title` | text | `TERMO DE CONTRATAÇÃO - VERSÃO 5.10` | 1 |
| 2 | `razaoSocial` | text | `W A DA SILVA SERVICOS` | 1 |
| 3 | `cnpj` | text | `62.660.580/0001-09` | 1 |
| 4 | `enderecoCompleto` | text | (não preenchido) | 1 |
| 5 | `localidade` | text | (não preenchido) | 1 |
| 6 | `cep` | text | (não preenchido) | 1 |
| 7 | `repNome` | text | `____________________________________________ Nome: WASHINGTO` | 2 |
| 8 | `repCpf` | text | (não preenchido) | 1 |
| 9 | `tipoContratacao` | select | `Aditivo` | 1 |
| 10 | `vencimento` | date | `Dia 20` | 1 |
| 11 | `tipoFatura` | select | `Fatura Eletrônica .` | 1 |
| 12 | `acessos` | text | `1` | 3 |
| 13 | `admTelefone` | text | `\(82\)99321-0839 2. DADOS DA CONTRATAÇÃO` | 1 |
| 14 | `admEmail` | text | (não preenchido) | 1 |
| 15 | `ddd` | text | `82` | 1 |
| 16 | `tipoVenda` | select | `Próprio` | 1 |
| 17 | `plano` | select | `TIM Black Empresa III` | 1 |
| 18 | `aparelho` | text | `Nano Chip Oferta: B REG 10GB+20GB BTL TSE_TNE - Conteudo Red` | 1 |
| 19 | `observacoes` | text | `3. Assinaturas` | 1 |
| 20 | `tableRows` | text | (não preenchido) | 1 |
| 21 | `clauses` | text | (não preenchido) | 1 |
| 22 | `signatures` | text | (não preenchido) | 2 |

> **Resumo:** 14 de 22 placeholders com valores extraídos do PDF.
> Análise gerada em: 2026-07-28T16:49:05.303Z
