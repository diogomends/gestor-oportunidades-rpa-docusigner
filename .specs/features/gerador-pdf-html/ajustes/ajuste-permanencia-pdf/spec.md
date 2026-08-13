# Documento de Permanência (Contrato de Permanência) — Specification

## Problem Statement

O documento de **Contrato de Permanência** (`permanenciaTemplate.html` e `geradorPdfHtmlService.js`) gerado via HTML → PDF com Playwright necessita de ajustes estruturais para atender ao padrão visual canônico da operadora (template iTextSharp de referência em `tmp/test-pdfs/templates/permanencia.pdf`).

Atualmente (após regressão do commit `5c8bb10`):
1. Os sub-cabeçalhos `VOZ` e `DADOS` ocupam linhas inteiras (`colspan="6"`), quando deveriam ficar na **primeira coluna** com a descrição do produto abaixo e as demais colunas ocupando o espaço de duas linhas (`rowspan="2"`).
2. A barra de cabeçalho `ADITIVO` (fundo azul `#004691`) não existe no template de referência e deve ser removida.
3. Os cabeçalhos da tabela (`th`) possuem fundo azul `#004691` com texto branco, quando deveriam ter **fundo branco e texto preto** (`#000000`), conforme a referência canônica.
4. O `body` do template usa `color: #1a1a1a` (cinza escuro) em vez de `#000000` (preto puro).
5. A data informada antes da seção de assinaturas deve seguir o modelo padronizado `CIDADE, DD de Mês de YYYY`.
6. O campo **Consultor** deve refletir os dados do usuário cadastrador (`createdBy.nome`).
7. Os campos **CPF do Consultor**, **TBP / Senior Account** e **CNPJ Senior Account** ainda não possuem colunas no schema, necessitando de fallback `""`.

## Goals

- [x] Reposicionar o container da tabela entre a Cláusula 3.1 e a Cláusula 3.1.1 (já implementado).
- [x] Atualizar a injeção da data no `geradorPdfHtmlService.js` (`generatePermanencia()`) para formatar no padrão `CIDADE, DD de Mês de YYYY` via `formatDataExtenso(cidade, dataInput)` (já implementado).
- [x] Substituir `{{cidade}}, {{dataExtenso}}` por `{{dataExtenso}}` no template (já implementado).
- [x] Mapear o nome do consultor (`consultorNome`) a partir de `createdBy.nome` com lookup manual (já implementado).
- [x] Definir fallback `""` para `consultorCpf`, `seniorAccount` e `cnpjAccount` (já implementado).
- [x] Resolver `seniorAccount`/`cnpjAccount` via `contract.tokenInfo` com fallback por `gestorTokenService.resolveToken` no script de lote (já implementado).
- [x] Sincronizar `service.js` e `permanenciaTemplate.html` no `make regenerate-contract-pdfs-prod` (já implementado).
- [x] Reestruturar a tabela: `VOZ` e `DADOS` na **primeira coluna** com a descrição do produto abaixo (`{{planoVoz}}`/`{{planoDados}}`), demais colunas com `rowspan="2"` (conforme template canônico iTextSharp).
- [x] Remover a barra de cabeçalho `ADITIVO` (div azul `#004691`) — não existe na referência canônica.
- [x] Corrigir cores: `body` `#000000`, `th` `color: #000000` sem `background-color: #004691` (fundo branco, texto preto).

## Out of Scope

| Feature | Motivo |
| --- | --- |
| Alteração em outros documentos PDF | Recurso exclusivo do documento Contrato de Permanência |
| Alteração em Schemas do Mongoose (`User.js`, `Contract.js`) nesta etapa | Os campos de CPF do consultor e TBP/Senior Account serão adicionados em demanda futura do banco de dados |
| População dos valores VOZ/DADOS na tabela ADITIVO | Os valores (`planoVoz`, `valorVozSemPerm/ComPerm`, `beneficioVoz`, `multaVoz`, etc.) serão lançados futuramente nos dados da Oferta (`Offer`). Nesta etapa a tabela mantém a estrutura e colunas corretas com valores vazios `""` |
| Modificação de endpoints REST da API | Mantém a retrocompatibilidade da rota `POST /api/contracts/generate-pdf-html` |

---

## Technical Mapping & Layout Specs

### 1. Posição da Tabela (Cláusula Terceira)
```html
CLÁUSULA TERCEIRA - CANCELAMENTO
3.1 O cancelamento antecipado ao tempo da Permanência, sujeitará o CLIENTE ao pagamento de multa, proporcional ao tempo restante da Permanência e ao valor do benefício oferecido, observando os valores das tabelas abaixo.

<!-- TABELA (SEM barra ADITIVO — removida conforme referência canônica) -->
<div style="margin: 10pt 0; page-break-inside: avoid;">
  <table style="width:100%; border-collapse:collapse; border:0.75pt solid #000; margin:8px 0;">
    <thead>
      <tr>
        <th style="color:#000000; ...">Plano/Pacote/Serviço</th>
        <th style="color:#000000; ...">Valor Mensal Sem Permanência</th>
        ...
      </tr>
    </thead>
    <tbody>
      <tr>
        <td rowspan="2"><b>VOZ</b></td>
        <td rowspan="2">{{valorVozSemPerm}}</td>
        ...
      </tr>
      <tr>
        <td>{{planoVoz}}</td>
      </tr>
      <tr>
        <td rowspan="2"><b>DADOS</b></td>
        <td rowspan="2">{{valorDadosSemPerm}}</td>
        ...
      </tr>
      <tr>
        <td>{{planoDados}}</td>
      </tr>
    </tbody>
  </table>
</div>

3.1.1 Para cálculo do valor devido em caso de cancelamento deve ser multiplicado o valor da multa pela quantidade de meses faltantes.
```

### 2. Estrutura da Tabela (Layout Canônico iTextSharp)
| Coluna | Descrição / Exemplo | Fonte no Payload |
| --- | --- | --- |
| **Plano/Pacote/Serviço** | 1ª coluna: `VOZ`/`DADOS` (bold, border-bottom) + descrição do plano abaixo | `planoVoz` / `planoDados` |
| **Valor Mensal Sem Permanência** | Valor cheio sem desconto (ex: `R$ 255,90`) — `rowspan="2"` | `valorVozSemPerm` / `valorDadosSemPerm` |
| **Valor Mensal Com Permanência** | Valor com desconto (ex: `R$ 14,48`) — `rowspan="2"` | `valorVozComPerm` / `valorDadosComPerm` |
| **Benefício Mensal Concedido** | Desconto mensal (ex: `R$ 241,42`) — `rowspan="2"` | `beneficioVoz` / `beneficioDados` |
| **Multa por mês faltante** | Multa proporcional (ex: `R$ 23,99`) — `rowspan="2"` | `multaVoz` / `multaDados` |
| **Tempo de permanência** | Meses (ex: `24`) — `rowspan="2"` | Fixo `24` |

> **Referência canônica**: template iTextSharp em `tmp/test-pdfs/templates/permanencia.pdf` — fundo branco, bordas cinza, texto preto `#000000`, sem barra `ADITIVO`, sem `background-color` azul nos `th`.

> **Fonte dos valores (futura)**: os valores das colunas acima serão lançados nos dados da Oferta (`Offer`) em demanda futura. Nesta etapa o payload pode vir sem esses campos — o serviço injeta `""` e a tabela mantém a estrutura e colunas corretas.

### 3. Modelo da Data de Assinatura
- **Formato**: `CIDADE, DD de Mês de YYYY`
- **Exemplo**: `RECIFE, 22 de Junho de 2026`
- **Regra de Conversão**: `data.cidade.toUpperCase() + ', ' + dia + ' de ' + mesExtensoCapitalizado + ' de ' + ano`.
- **Template**: a linha `{{cidade}}, {{dataExtenso}}` deve virar apenas `{{dataExtenso}}` (a cidade já compõe a string completa), evitando duplicação de cidade no PDF.
- **Serviço**: `generatePermanencia()` calcula `{{dataExtenso}}` via `formatDataExtenso(data.cidade, data.dataExtenso || data.dataGerada || new Date())`, sem confiar em `dataExtenso` pré-formatado recebido no payload (aceita `Date` ou string `DD/MM/YYYY`).

### 4. Bloco de Assinaturas & Dados do Consultor
- **Data**: Exibida antes da seção `REPRESENTANTES LEGAIS:`.
- **Consultor**: Exibe o nome do usuário que efetuou o cadastro (`consultorNome = data.userNome || contract.createdBy.nome || ""`). No `regenerate-contract-pdfs.js`, **não usar `populate("createdBy")`** (gera `MissingSchemaError` porque `User` é registrado apenas na conexão padrão `db_crm_funil`, enquanto `Contract` usa a conexão `crm_contracts`). Em vez disso, realizar **lookup manual em duas consultas**: coletar os `createdBy` ObjectIds dos contratos, buscar `User.find({ _id: { $in: userIds } }).select("nome")` e montar um mapa `id → nome` para resolver `consultorNome`.
- **TBP/Senior Account**: Preenchido a partir de `contract.tokenInfo` (`nomeTbp`/`cnpjTbp`). Se ausente, o script de lote resolve via `gestorTokenService.resolveToken({ uf, ddd })` e usa os dados do token (fallback `""` se não houver token).
- **Campos Pendentes de Schema**: Rótulos mantidos com valor vazio:
  - `TBP/Senior Account:` `{{seniorAccount}}` (default: `""`)
  - `CNPJ:` `{{cnpjAccount}}` (default: `""`)
  - `CPF:` `{{consultorCpf}}` (default: `""`)

---

## User Stories & Acceptance Criteria

### P1: Layout da Tabela conforme Referência Canônica
**User Story**: Como gestor comercial, quero que a tabela do Contrato de Permanência siga o layout canônico da operadora (iTextSharp) — fundo branco, texto preto, VOZ/DADOS na primeira coluna com descrição abaixo.

**Acceptance Criteria**:
1. WHEN o `permanenciaTemplate.html` for renderizado THEN NÃO SHALL haver barra de cabeçalho `ADITIVO` (div azul removida).
2. WHEN o PDF for gerado THEN os `th` SHALL ter `color: #000000` e `background-color` removido (fundo branco, texto preto).
3. WHEN o PDF for gerado THEN `VOZ` e `DADOS` SHALL estar na primeira coluna (bold, `border-bottom`) com `{{planoVoz}}`/`{{planoDados}}` abaixo, e as 5 colunas de valores com `rowspan="2"`.
4. WHEN o PDF for gerado THEN o `body` SHALL usar `color: #000000` (preto puro, sem cinza `#1a1a1a`).

---

### P2: Formatação da Data e Injeção dos Dados do Consultor
**User Story**: Como consultor e emissor de contrato, quero a data no formato oficial (com cidade em maiúsculas e mês por extenso) e meu nome como consultor responsável na seção de assinaturas.

**Acceptance Criteria**:
1. WHEN o serviço `geradorPdfHtmlService.generatePermanencia(data)` for executado THEN a variável `{{dataExtenso}}` SHALL ser substituída pela string formatada no padrão `CIDADE, DD de Mês de YYYY` (ex: `RECIFE, 22 de Junho de 2026`).
2. WHEN a requisição for processada THEN a variável `{{consultorNome}}` SHALL ser preenchida com o nome do usuário cadastrador.
3. WHEN os campos `seniorAccount`, `cnpjAccount` e `consultorCpf` não forem fornecidos THEN o template SHALL exibir apenas os rótulos de assinatura com valores em branco `""`, sem gerar erros de runtime.
4. WHEN `contract.tokenInfo` não existir no script de lote THEN `seniorAccount`/`cnpjAccount` SHALL ser resolvido via `gestorTokenService.resolveToken({ uf, ddd })`, com fallback `""` quando não houver token.

---

## Requirement Traceability

| ID | Requisito / Componente | Arquivo Alvo | Status |
| --- | --- | --- | --- |
| PERM-01 | Reposicionamento da Tabela (Cláusula 3.1) | `submodules/permanencia/permanenciaTemplate.html` | Implemented |
| PERM-02 | VOZ/DADOS na 1ª coluna, descrição abaixo, valores com rowspan=2, th preto sem fundo azul, sem barra ADITIVO | `submodules/permanencia/permanenciaTemplate.html` | Implemented |
| PERM-03 | Formatação de Data Extensa (`RECIFE, DD de Mês de YYYY`) via `formatDataExtenso` | `src/modules/gerador-pdf-html/service.js` | Implemented |
| PERM-04 | Mapeamento do Nome do Consultor + lookup manual em `User` (sem `populate` cross-DB) | `src/scripts/regenerate-contract-pdfs.js` e `service.js` | Implemented |
| PERM-05 | Fallback para Campos Ausentes no Schema | `src/modules/gerador-pdf-html/service.js` | Implemented |
| PERM-06 | Remoção do prefixo `{{cidade}}, ` na linha da data (evita duplicação) | `submodules/permanencia/permanenciaTemplate.html` | Implemented |
| PERM-07 | Não injetar `dataExtenso` pré-formatado no script (deixar o serviço formatar) | `src/scripts/regenerate-contract-pdfs.js` | Implemented |
| PERM-09 | Resolução de `seniorAccount`/`cnpjAccount` via `contract.tokenInfo` + `gestorTokenService.resolveToken` no lote | `src/scripts/regenerate-contract-pdfs.js` | Implemented |
| PERM-10 | Sync de `service.js` e `permanenciaTemplate.html` no `make regenerate-contract-pdfs-prod` | `Makefile` | Implemented |
| PERM-08 | Fonte futura dos valores VOZ/DADOS via Oferta (`Offer`) — fallback `""` nesta etapa | Documental / Out of Scope | Specified |
