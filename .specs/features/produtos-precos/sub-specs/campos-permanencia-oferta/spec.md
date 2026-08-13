# Campos de Permanência no `#offerModal` (campos-permanencia-oferta) — Specification

## Problem Statement

O modal `#offerModal` (módulo Produtos e Preços) permite gerenciar ofertas simples e combos, mas não captura os valores de **permanência** necessários para o Contrato de Permanência PDF.

O documento de permanência (`permanenciaTemplate.html` + `geradorPdfHtmlService.js`) possui uma tabela ADITIVO com **duas linhas — VOZ e DADOS** — cada uma com as colunas *Plano/Pacote/Serviço*, *Valor Mensal Sem Permanência*, *Valor Mensal Com Permanência*, *Benefício Mensal Concedido*, *Multa por mês faltante* e *Tempo de permanência*. Atualmente os placeholders desses dados (`{{planoVoz}}`, `{{valorVozSemPerm}}`, `{{beneficioVoz}}`, etc.) são injetados com fallback `""` no `service.js:101-113`, pois a origem dos valores nos dados da Oferta (`Offer`) foi adiada (AD-047 / PERM-08).

Este ajuste implementa a **origem desses dados**: adiciona os campos de permanência ao `#offerModal` e à persistência da Oferta, de modo que sejam capturados por VOZ e DADOS com máscara de moeda e tempo de permanência com default `24`.

## Goals

- [x] Adicionar ao `#offerModal` os novos campos de permanência, separados em dois blocos **VOZ** e **DADOS**.
- [x] Cada bloco recebe: `Plano/Pacote/Serviço`, `Valor Mensal Sem Permanência`, `Valor Mensal Com Permanência`, `Benefício Mensal Concedido`, `Multa por mês faltante`.
- [x] Campo **Tempo de permanência (meses)** único, com valor padrão `24`.
- [x] Aplicar **máscara de moeda** (`data-mask="currency"`, formato pt-BR) nos 8 campos de valor (4 VOZ + 4 DADOS).
- [x] Persistir os novos campos no schema Mongoose `Offer` e validá-los no Zod (`createOfferSchema`), mantendo retrocompatibilidade do CRUD `/api/offers`.
- [x] Preencher os campos ao editar oferta existente e converter os valores antes do envio à API.

## Out of Scope

| Funcionalidade | Motivo |
| --- | --- |
| Mapeamento dos campos da Oferta para o PDF de permanência (`service.js`/`permanenciaTemplate.html`) | Demanda futura; este ajuste apenas captura e persiste os dados na Oferta |
| Alterações no template/placeholder `{{tempoPermanencia}}` do PDF | O tempo segue fixo em `24` no template até o mapeamento futuro |
| Modificação de rotas, contratos de API ou fluxo de combo | Retrocompatibilidade total de `/api/offers` e do modal |
| Alterações em outros módulos ou PDFs (termo/proposta) | Escopo exclusivo do modal de ofertas |
| Campos de permanência por item de combo | Decisão: campos apenas no nível da oferta (escopo 6A) |
| Implementação duplicada órfã do frontend (`public/modules/produtos-precos/js/index.js` + `js/features/offers/modal.js`) | Não carregada por nenhuma página; permanece intocada (impact-protector) |

## Technical Mapping

### 1. Campos no Schema `Offer` (`src/models/Offer.js`) — todos opcionais

| Campo | Tipo | Regras |
| --- | --- | --- |
| `planoVoz` | `String` | `trim`, opcional |
| `valorVozSemPerm` | `Number` | `min 0`, opcional |
| `valorVozComPerm` | `Number` | `min 0`, opcional |
| `beneficioVoz` | `Number` | `min 0`, opcional |
| `multaVoz` | `Number` | `min 0`, opcional |
| `planoDados` | `String` | `trim`, opcional |
| `valorDadosSemPerm` | `Number` | `min 0`, opcional |
| `valorDadosComPerm` | `Number` | `min 0`, opcional |
| `beneficioDados` | `Number` | `min 0`, opcional |
| `multaDados` | `Number` | `min 0`, opcional |
| `tempoPermanencia` | `Number` | `int >= 1`, **default `24`** |

> Os nomes espelham os placeholders do PDF (`service.js` `generatePermanencia()`), facilitando o mapeamento futuro Oferta → PDF.

### 2. Validação Zod (`src/modules/produtos-precos/produtosPrecosSchemas.js`)

- Campos de valor: `z.number().min(0).optional()`.
- Campos de plano: `z.string().optional()`.
- `tempoPermanencia`: `z.number().int().min(1).optional().default(24)`.
- `updateOfferSchema` herda via `createOfferSchema.partial()` — sem mudanças adicionais.
- **Ponto de verificação**: confirmar em teste que `createOfferSchema.partial()` mantém `.default(24)` no `updateOfferSchema` (Zod v3); no create o default é garantido por `createOfferSchema.parse`.
  - **Resultado (Zod 3.25)**: `partial()` NÃO mantém o default no `updateOfferSchema` (`parse({})` → `{}`). Comportamento desejado: no update o `tempoPermanencia` só é alterado se presente no payload; o default 24 vale no create e no modal (`value="24"`).

### 2.1 Persistência Backend (`offerRepository.js`)

- `offerRepository.update(id, data)` deve atribuir os 11 campos novos quando presentes em `data` (`planoVoz`, `valorVozSemPerm`, `valorVozComPerm`, `beneficioVoz`, `multaVoz`, `planoDados`, `valorDadosSemPerm`, `valorDadosComPerm`, `beneficioDados`, `multaDados`, `tempoPermanencia`), seguindo o padrão das linhas 34-43 do arquivo atual.
- `controller` e `service` NÃO mudam: repassam `req.body` integral ao repositório; no create a persistência já ocorre via `new Offer(data).save()`.

### 3. Modal Frontend (`public/modules/produtos-precos/components/modal/`)

**HTML (`modal-produtos-precos.html`):**
- Novo bloco "Dados de Permanência" com 3 seções: **VOZ**, **DADOS** e **Tempo de permanência**.
- Cada seção VOZ/DADOS com 5 campos: Plano (`name="planoVoz"` / `name="planoDados"`) + 4 campos de moeda (`name="valorVozSemPerm"`, `valorVozComPerm`, `beneficioVoz`, `multaVoz` e equivalentes DADOS) com `data-mask="currency"` e `placeholder="0,00"`.
- Campo `name="tempoPermanencia"` do tipo `number`, com `value="24"`.

**JS (`modal-produtos-precos.js`):**
- `populateForm(offer)`: preencher `planoVoz`/`planoDados` e os 8 campos de valor **já formatados** (padrão `1.234,56`), e `tempoPermanencia` (default `24` quando ausente).
- `handleSubmit(e)`: converter os 8 campos de valor via `parseCurrencyString` — campos vazios/inválidos são **omitidos do payload** (chave removida, nunca `0`) — e `tempoPermanencia` via `Number`, incluindo-os no payload enviado a `/api/offers`.

> A máscara de moeda já é aplicada pela delegação de eventos no `body` (`produtos-precos.js:44-48`), sem listener novo.

## Edge Cases

| Caso | Comportamento Esperado |
| --- | --- |
| Campo de valor vazio ou em estado intermediário da máscara (`"1,234,56"`) | `parseCurrencyString` converte corretamente (última vírgula = decimal); vazio → enviado como `0` (nunca omitido) |
| `tempoPermanencia` ausente no payload | Zod aplica default `24` |
| Edição de oferta antiga sem campos de permanência | Campos de valor exibem `0,00` por padrão (zero default) e são enviados como `0`; `tempoPermanencia` mostra `24`; salvar não quebra payload |
| Valor negativo em qualquer campo de moeda | Zod rejeita (400) |
| Oferta combo | Campos de permanência convivem com `itensCombo` sem conflito (nível da oferta) |

### Ajuste pós-implantação (2026-08-04)

- **Zero default**: os 8 campos de valor de permanência e os campos de valor/percentual dos itens do combo passam a iniciar em `0,00` (em vez de vazios) e são **sempre** enviados como número (vazio → `0`), nunca omitidos.
- **Correção de combos legados**: ao editar uma oferta combo, os percentuais são **recalculados a partir dos valores** (`round(valor_i / somaValores * 100, 2)`), pois dados importados via `insertMany` ignoram o `pre("save")` e podem ter percentuais que não somam 100% (ex.: 10%), causando `400 "Erro ao atualizar oferta"` no hook `Offer.js:105-111`.
- **Paridade de validação na UI**: `updateComboValidation` agora também exige `|somaPercentuais - 100| <= 0.1` (além da soma do valor R$0,01), desabilitando Salvar em combos inválidos.
- **Script de reparo**: `src/scripts/repair-combos-percentuais.js` recomputa percentuais dos combos existentes com `|somaPerc - 100| > 0.1` (pulando combos com valores inválidos ou cujo `save()` rejeite).

---

## User Stories & Acceptance Criteria

### P1: Captura e Persistência dos Campos de Permanência

**User Story:** Como gestor comercial, quero informar os valores de permanência (VOZ e DADOS) ao cadastrar/editar uma oferta, para que os dados alimentem futuramente o Contrato de Permanência.

**Acceptance Criteria:**

1. **PERM-OF-01**: WHEN `#offerModal` abre para nova oferta THEN o campo `tempoPermanencia` SHALL iniciar com o valor `24`.
2. **PERM-OF-02**: WHEN usuário digita nos campos `valorVozSemPerm`, `valorVozComPerm`, `beneficioVoz`, `multaVoz`, `valorDadosSemPerm`, `valorDadosComPerm`, `beneficioDados`, `multaDados` THEN máscara de moeda (`data-mask="currency"`, formato `1.234,56`) SHALL ser aplicada automaticamente.
3. **PERM-OF-03**: WHEN o formulário do modal é submetido com dados de permanência THEN os 11 campos (`planoVoz`..`multaDados` + `tempoPermanencia`) SHALL ser enviados à API `/api/offers` como números (sem "R$") e persistidos na Oferta.
4. **PERM-OF-04**: WHEN um payload sem `tempoPermanencia` passa pela validação Zod THEN o schema SHALL aplicar o default `24`.
5. **PERM-OF-05**: WHEN um campo de valor é negativo THEN Zod SHALL rejeitar o payload (400).
6. **PERM-OF-06**: WHEN uma oferta existente com campos de permanência é aberta para edição THEN `populateForm` SHALL preencher VOZ/DADOS (valores formatados) e `tempoPermanencia` corretamente.
7. **PERM-OF-07**: WHEN o modal salva uma oferta com os novos campos THEN os campos existentes (nome, produto, valor, dataVencimento, sistemaInterno, isCombo, itensCombo) SHALL permanecer intactos e funcionais (retrocompatibilidade).

---

## Requirement Traceability

| ID | Requisito / Componente | Arquivo Alvo | Status |
| --- | --- | --- | --- |
| PERM-OF-01 | Tempo de permanência com default 24 no modal e schema | `modal-produtos-precos.html`, `Offer.js`, `produtosPrecosSchemas.js` | Implemented |
| PERM-OF-02 | Máscara de moeda nos 8 campos de valor | `modal-produtos-precos.html` | Implemented |
| PERM-OF-03 | Envio e persistência dos 11 campos via `/api/offers` | `modal-produtos-precos.js`, `Offer.js`, `produtosPrecosSchemas.js`, `offerRepository.js` | Implemented |
| PERM-OF-04 | Default 24 no Zod | `produtosPrecosSchemas.js` | Implemented |
| PERM-OF-05 | Rejeição de valores negativos | `produtosPrecosSchemas.js` | Implemented |
| PERM-OF-06 | Preenchimento do modal na edição + persistência no update | `modal-produtos-precos.js` (`populateForm`), `offerRepository.js` | Implemented |
| PERM-OF-07 | Retrocompatibilidade do CRUD e combo | Todos | Implemented |

## Testes

Adicionar a `tests/produtos-precos.test.js` (padrão `node --test` + `node:assert`):

1. `createOfferSchema.parse` com os novos campos preserva os valores e aplica `tempoPermanencia: 24` quando ausente.
2. `createOfferSchema.parse` rejeita `valorVozSemPerm: -1` (e equivalentes).
3. Checks de servimento existentes permanecem (`id="offerModal"`, `/api/offers`).
4. `offerRepository.update` (via `mock.method` de `node:test`) persiste os 11 campos novos ao atualizar oferta existente e mantém os campos legados intactos.
