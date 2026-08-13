# Documento de Permanência — Implementation Tasks

## Tasks Overview

| Task ID | Descrição | Componente | Status |
| --- | --- | --- | --- |
| TASK-PERM-01 | Reorganizar posição da tabela entre Cláusula 3.1 e 3.1.1 | Template HTML | Done |
| TASK-PERM-02 | Reestruturar VOZ/DADOS na 1ª coluna com descrição abaixo e valores com rowspan=2; remover barra ADITIVO; th preto sem fundo azul | Template HTML | Done |
| TASK-PERM-03 | Implementar formatador de data extensa (`formatDataExtenso`) | Backend Service | Done |
| TASK-PERM-04 | Mapear `consultorNome` via lookup manual em `User` | Script & Controller | Done |
| TASK-PERM-05 | Configurar fallbacks para `consultorCpf`, `seniorAccount` e `cnpjAccount` | Backend Service | Done |
| TASK-PERM-06 | Validar geração do PDF via `make test-pdf-html-generation` | Validação / QA | Done |
| TASK-PERM-07 | Remover `rowspan="2"` das células `VOZ`/`DADOS` para eliminar a 7ª coluna fantasma após "Tempo de permanência" | Template HTML | Done |
| TASK-PERM-08 | Resolver `seniorAccount`/`cnpjAccount` via `gestorTokenService.resolveToken` no script de lote | Script & Gestor de Tokens | Done |
| TASK-PERM-09 | Sincronizar `service.js` e `permanenciaTemplate.html` no `make regenerate-contract-pdfs-prod` | Makefile | Done |

---

## Detailed Task Breakdown

### TASK-PERM-01: Posicionamento da Tabela
- **Arquivo**: `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaTemplate.html`
- **Ação**: Tabela posicionada logo após o parágrafo `3.1` e antes do parágrafo `3.1.1`.
- **Status**: Done (commit `5c8bb10`).

### TASK-PERM-02: Layout da Tabela (Correção de Regressão do `5c8bb10`)
- **Arquivo**: `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaTemplate.html`
- **Problema**: O commit `5c8bb10` introduziu: (a) barra azul `ADITIVO` inexistente na referência canônica; (b) `th` com `background-color: #004691` e `color: #ffffff`; (c) `VOZ`/`DADOS` como `colspan="6"` em linhas separadas com `background-color: #e6f0fa`.
- **Ação**:
  - Remover a `<div>` da barra `ADITIVO` (fundo azul `#004691`).
  - `th`: remover `background-color: #004691`, mudar `color: #ffffff` → `#000000` (fundo branco, texto preto).
  - `body`: `color: #1a1a1a` → `#000000` (preto puro).
  - `tbody`: remover `<tr>` `colspan="6"` de `VOZ`/`DADOS`; reestruturar com `<b>VOZ</b>`/`<b>DADOS</b>` (bold, `border-bottom`) na 1ª célula com `rowspan="2"`, `{{planoVoz}}`/`{{planoDados}}` na 2ª linha da 1ª coluna, e 5 colunas de valores com `rowspan="2"`.
- **Referência**: template iTextSharp canônico em `tmp/test-pdfs/templates/permanencia.pdf` (página 3: fundo branco, bordas cinza, texto preto, `VOZ` na 1ª coluna com descrição abaixo).
- **Critério de Aceite**: Layout idêntico ao template canônico — sem barra ADITIVO, th preto, VOZ/DADOS empilhados com descrição na 1ª coluna, valores com rowspan=2.
- **Status**: Done.

### TASK-PERM-03: Formatador de Data Extensa
- **Arquivo**: `src/modules/gerador-pdf-html/service.js`
- **Ação**: Função `formatDataExtenso(cidade, dataInput)` retorna `"CIDADE, DD de Mês de YYYY"`. Template usa `{{dataExtenso}}` (sem `{{cidade}}`).
- **Status**: Done (commit `5c8bb10`).

### TASK-PERM-04 & TASK-PERM-05: Consultor e Fallback
- **Arquivos**: `service.js`, `src/scripts/regenerate-contract-pdfs.js`
- **Ação**: Lookup manual `User.find` (sem `populate` cross-DB). Fallback `""` para `consultorCpf`, `seniorAccount`, `cnpjAccount`.
- **Status**: Done (commit `5c8bb10`).

### TASK-PERM-08: Resolução de TBP/Senior Account via Gestor de Tokens
- **Arquivo**: `src/scripts/regenerate-contract-pdfs.js`
- **Ação**: Em `mapContractToPayload()`, `seniorAccount`/`cnpjAccount` passam a sair de `contract.tokenInfo` (`nomeTbp`/`cnpjTbp`). Quando ausentes, o script consulta `gestorTokenService.resolveToken({ uf, ddd })` e preenche com os dados do token resolvido (fallback `""` se não houver).
- **Status**: Done.

### TASK-PERM-09: Sync de Permanência no Deploy de Regeneração
- **Arquivo**: `Makefile` (`regenerate-contract-pdfs-prod`)
- **Ação**: Além do script e dos arquivos de `termo/`, o target agora envia via SCP `gerador-pdf-html/service.js` e `submodules/permanencia/permanenciaTemplate.html` e os copia para o container `app_gestor` via `docker cp`, garantindo que a regeneração em produção use a versão mais recente do serviço e do template de permanência.
- **Status**: Done.

### TASK-PERM-06: Validação
- **Comando**: `make test-pdf-html-generation`
- **Critério de Aceite**: PDF de permanência com tabela na posição correta, VOZ/DADOS na 1ª coluna, th preto sem fundo azul, sem barra ADITIVO, data formatada, consultor preenchido.
- **Status**: Done.

### TASK-PERM-07: Eliminar 7ª Coluna Fantasma após "Tempo de permanência"
- **Arquivo**: `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaTemplate.html`
- **Problema**: No PDF gerado, após o `24` (coluna *Tempo de permanência*) aparece `TIM BLACK`/`Dados II` (a descrição do plano) em uma **7ª coluna** (x≈493-499). No template canônico iTextSharp, a descrição fica **abaixo** de VOZ/DADOS na 1ª coluna (`getTable` da referência: `["VOZ", val1..val5]` + linha seguinte só com a descrição).
- **Causa raiz**: As células `VOZ` (linha 327) e `DADOS` (linha 419) possuem `rowspan="2"`, ocupando as 2 linhas da coluna 1. O `<td>{{planoVoz}}`/`{{planoDados}}` da 2ª linha não tem onde caber na coluna 1 e o navegador cria uma 7ª coluna.
- **Ação**: Remover `rowspan="2"` das células `VOZ` e `DADOS`. As 5 colunas de valor mantêm `rowspan="2"`. Resultado esperado: `VOZ` (col 1, linha 1) + valores (cols 2-6, rowspan=2); `{{planoVoz}}` (col 1, linha 2).
- **Critério de Aceite**: PDF gerado com 6 colunas; descrição do plano abaixo de VOZ/DADOS na 1ª coluna; nenhum texto além do `24` na coluna *Tempo de permanência*.
- **Status**: Done.
