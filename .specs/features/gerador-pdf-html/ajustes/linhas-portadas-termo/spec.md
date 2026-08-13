# Linhas Portadas no Termo de Adesão — Specification

## Problem Statement

Ao gerar o PDF do contrato tipo **Termo de Adesão**, o documento necessita receber, após a **Seção 2 (Dados da Contratação)** e antes da **Seção 3 (Assinaturas)**, um ou mais quadros contendo as informações detalhadas de cada linha portada do cliente.

Atualmente, o template `termoTemplate.html` e o serviço `termoService.js` renderizam apenas os dados cadastrais da Seção 1, Seção 2, ofertas e assinaturas, mas não possuem o bloco/quadro dedicado para apresentar o detalhamento individual de cada linha portada (Número de Acessos, Tipo, Número, Plano, Pacotes, Operadora Doadora, Nome do Cliente, CPF e Nº Temporário).

As portabilidades ficam armazenadas no banco em `negotiation[].portabilityLines[]` no schema `Contract.js` (modelo `crm_contracts`). O payload para o gerador de PDF é montado pelo `src/modules/gerador-pdf-html/service.js` e pelo script de lote `src/scripts/regenerate-contract-pdfs.js` — nenhum dos dois extrai `portabilityLines` atualmente.

## Goals

- [x] Atualizar o template HTML (`termoTemplate.html`) e o serviço (`termoService.js`) no módulo `src/modules/gerador-pdf-html/submodules/termo/` para suportar a injeção dos quadros de linhas portadas.
- [x] Garantir que cada linha portada seja apresentada em um quadro individual com estilo e espaçamento idênticos ao PDF de referência (`Termo_de_Contratação_-_VERTICAL_AUTOMOTIVO_COMERCIO_DE_PECAS_LTDA_(1).pdf`).
- [x] Aplicar borda `0.75pt solid #888`, margem inferior de `6px` e `-webkit-box-decoration-break: clone; box-decoration-break: clone;` para que as bordas sigam visíveis caso o quadro sofra quebra de página.
- [x] Mapear os 9 campos solicitados no quadro e verificar sua integração com o modelo de dados e steps de cadastro de oportunidade/contrato do CRM.
- [x] Disponibilizar a lista de tarefas atômicas e script de verificação visual/produção via `make test-pdf-html-generation` e `make regenerate-contract-pdfs-prod`.

## Out of Scope

| Feature | Motivo |
| --- | --- |
| Alteração no layout de Propostas ou Permanência | Recurso exclusivo do documento Termo de Adesão |
| Modificação estrutural nas Seções 1, 2 ou 3 existente | Apenas a inserção dos quadros de linhas portadas entre a Seção 2 e a Seção 3 será alterada |

---

## Field Mapping & Verification — Schema Real (`Contract.js`)

As portabilidades são persistidas em `negotiation[].portabilityLines[]` no schema do `Contract.js`. Campos reais do schema:

```js
portabilityLines: [
  {
    tipoCedente: { type: String, enum: ["PF", "PJ"] },  // "Tipo" no PDF
    operadoraDoadora: String,                             // "Op. Doadora"
    nomeCedente: String,                                  // "Nome do Cliente"
    cpfCnpjCedente: String,                               // "CPF do Cliente"
    numero: String,                                       // "Número"
  }
]
```

Análise dos 9 campos exigidos no quadro de cada linha portada (com fallback correto para o schema real):

| Campo no PDF | Descrição / Exemplo | Chave no Payload (`data.linhasPortadas[]`) | Fonte no Schema `Contract.js` | Fallback |
| --- | --- | --- | --- | --- |
| **Título do Quadro** | `Número de Acessos:` | Fixo (cabeçalho) | N/A | N/A |
| **Tipo** | `Portabilidade PF/PJ` | `item.tipo` | `portabilityLines[].tipoCedente` (`"PF"` / `"PJ"`) | `"Portabilidade PF/PJ"` |
| **Número** | `(81)97310-1591` | `item.numero` | `portabilityLines[].numero` | `""` |
| **Plano** | `TIM Black Empresa III` | `item.plano` | `negotiation[].plano` | `""` |
| **Pacotes** | `Bonus Especial 20GB ,800 SMS/MMS` | `item.pacotes` | Não há campo direto — derivado de `negotiation[].itensCombo` | `""` |
| **Op. Doadora** | `CLARO` | `item.operadoraDoadora` | `portabilityLines[].operadoraDoadora` | `""` |
| **Nome do Cliente** | `RODRIGO FERREIRA CAMPOS DA SILVA` | `item.nomeCliente` | `portabilityLines[].nomeCedente` | `""` |
| **CPF do Cliente** | `060.781.574-42` | `item.cpfCliente` | `portabilityLines[].cpfCnpjCedente` | `""` |
| **Nº Temporário** | `Sim` | `item.numeroTemporario` | Sem campo no schema — valor fixo | `"Sim"` |

---

## User Stories & Acceptance Criteria

### P1: Injeção dos Quadros de Linha Portada no PDF Termo

**User Story**: Como consultor comercial, quero que cada linha portada seja apresentada em um quadro individual logo após a Seção 2 do Termo de Adesão para atender às normas da operadora TIM e apresentar as informações claras ao cliente.

**Acceptance Criteria**:

1. WHEN `data.linhasPortadas` (array de objetos) for fornecido ao `termoService.generate(data)` THEN o serviço SHALL substituir o placeholder `{{linhasPortadasHtml}}` no `termoTemplate.html` pelos quadros HTML correspondentes.
2. WHEN `data.linhasPortadas` for nulo, indefinido ou array vazio THEN `{{linhasPortadasHtml}}` SHALL ser substituído por string vazia `""`, sem deixar espaços em branco extras entre a Seção 2 e a Seção 3.
3. cada quadro de linha portada SHALL possuir a classe `.section` (ou `.portabilidade-box`) com bordas `0.75pt solid #888`, margem inferior `6px` e `-webkit-box-decoration-break: clone; box-decoration-break: clone;`.
4. cada quadro SHALL ter o cabeçalho `<div style="font-weight:bold;padding:4px 7px 2px 7px;">Número de Acessos:</div>` seguido da tabela de dados contendo os 8 campos de atributos.
5. o layout de texto dos rótulos e valores SHALL utilizar fonte `Helvetica, Arial, sans-serif` tamanho `8.5pt`, cor `#1a1a1a` e padding vertical de `2px 7px`.

---

## Requirement Traceability

| ID | História / Componente | Arquivo Alvo | Status |
| --- | --- | --- | --- |
| PORT-01 | Placeholder e Estilos CSS | `submodules/termo/termoTemplate.html` | Implemented |
| PORT-02 | Lógica de Formatação dos Quadros | `submodules/termo/termoService.js` | Implemented |
| PORT-03a | Repasse no serviço de geração (geração sob demanda) | `src/modules/gerador-pdf-html/service.js` → `termoService.generate(data)` | Implemented |
| PORT-03b | Repasse no script de lote (regeneração em produção) | `src/scripts/regenerate-contract-pdfs.js` → `mapContractToPayload()` | Implemented |
| PORT-04 | Massa de Teste Local | `tests/test-pdf-html-generation.js` — adicionar `linhasPortadas` no `dummyData` | Implemented |
| PORT-05 | Testes Unitários de Renderização | `submodules/termo/termoService.test.js` (criar arquivo) | Implemented |
| PORT-06 | Validação Visual e Produção | `make test-pdf-html-generation` + `make regenerate-contract-pdfs-prod` | Pendente (validação em produção) |

---

## Layout Measurements & Visual Specs

| Propriedade | Valor | Observação |
| --- | --- | --- |
| Container | `div.section` | Reutiliza a classe existente do template |
| Border | `0.75pt solid #888` | Idêntico às Seções 1 e 2 |
| Box Decoration Break | `clone` | Preserva a borda em quebras de página |
| Margin Bottom | `6px` | Espaçamento uniforme entre quadros |
| Font Family | `Helvetica, Arial, sans-serif` | Tipografia padrão do Termo |
| Font Size | `8.5pt` | Tamanho padrão de dados do Termo |
| Width Rótulo (`.lbl`) | `110pt` | Alinhamento vertical com tabelas acima |

### HTML Exato do Quadro (padrão obrigatório)

Cada quadro de linha portada deve seguir **exatamente** esta estrutura, reutilizando as classes CSS já existentes no template (`.section`, `.section-table`, `.lbl`):

```html
<div class="section">
  <div style="font-weight:bold;padding:4px 7px 2px 7px;">Número de Acessos:</div>
  <table class="section-table">
    <tr>
      <td class="lbl">Tipo:</td>
      <td>{{item.tipo}}</td>
    </tr>
    <tr>
      <td class="lbl">Número:</td>
      <td>{{item.numero}}</td>
    </tr>
    <tr>
      <td class="lbl">Plano:</td>
      <td>{{item.plano}}</td>
    </tr>
    <tr>
      <td class="lbl">Pacotes:</td>
      <td>{{item.pacotes}}</td>
    </tr>
    <tr>
      <td class="lbl">Op. Doadora:</td>
      <td>{{item.operadoraDoadora}}</td>
    </tr>
    <tr>
      <td class="lbl">Nome do Cliente:</td>
      <td>{{item.nomeCliente}}</td>
    </tr>
    <tr>
      <td class="lbl">CPF do Cliente:</td>
      <td>{{item.cpfCliente}}</td>
    </tr>
    <tr>
      <td class="lbl">Nº Temporário:</td>
      <td>{{item.numeroTemporario}}</td>
    </tr>
  </table>
</div>
```

> **Nota**: A classe `.section` já possui `border: 0.75pt solid #888`, `margin-bottom: 6px` e `box-decoration-break: clone` definidos no CSS do template. Não é necessário criar `.portabilidade-box`.
