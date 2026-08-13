# Linhas Portadas no Termo de Adesão — Implementation Tasks

## Tasks Overview

- [x] Task 1: Atualizar o template HTML (`termoTemplate.html`) com o placeholder `{{linhasPortadasHtml}}` e reutilizar a classe `.section` existente (sem criar nova classe CSS).
- [x] Task 2: Implementar a função `renderLinhasPortadas(linhasPortadas)` em `termoService.js` com os fallbacks corretos baseados no schema real `Contract.js`.
- [x] Task 3a: Extrair `portabilityLines` de cada `negotiation[]` no serviço de geração sob demanda (`src/modules/gerador-pdf-html/service.js`).
- [x] Task 3b: Extrair `portabilityLines` no script de lote `mapContractToPayload()` em `src/scripts/regenerate-contract-pdfs.js`.
- [x] Task 4: Adicionar `linhasPortadas` no `dummyData` de `tests/test-pdf-html-generation.js` para validar visualmente os quadros via `make test-pdf-html-generation`.
- [x] Task 5: Criar `termoService.test.js` com suite de testes unitários para validar injeção e remoção do bloco de linhas portadas.
- [x] Task 6: Validar a geração de PDF local e a regeneração em lote em produção.

---

## Detailed Task Breakdown

### Task 1: Atualizar `termoTemplate.html`

- **Arquivo**: `src/modules/gerador-pdf-html/submodules/termo/termoTemplate.html`
- **Ações**:
  1. Inserir o placeholder `{{linhasPortadasHtml}}` exatamente entre o `</div>` de fechamento da Seção 2 (linha 291) e o `<!-- Seção 3: Assinaturas -->` (linha 293).
  2. **Não criar** nova classe CSS `.portabilidade-box` — a classe `.section` já possui todos os estilos necessários (`border: 0.75pt solid #888`, `margin-bottom: 6px`, `box-decoration-break: clone`).
- **Critério de Aceite**: O template HTML possui `{{linhasPortadasHtml}}` na posição correta.

---

### Task 2: Implementar Formatação em `termoService.js`

- **Arquivo**: `src/modules/gerador-pdf-html/submodules/termo/termoService.js`
- **Ações**:
  1. Criar helper `renderLinhasPortadas(linhasPortadas)` que recebe um array de linhas portadas.
  2. Mapear cada item com fallback seguro usando os **nomes reais do schema** `Contract.js`:
     - Header: `Número de Acessos:`
     - `Tipo`: `item.tipo || item.tipoCedente ? \`Portabilidade ${item.tipoCedente}\` : "Portabilidade PF/PJ"`
     - `Número`: `item.numero || ""`
     - `Plano`: `item.plano || ""`
     - `Pacotes`: `Array.isArray(item.pacotes) ? item.pacotes.join(" ,") : (item.pacotes || "")`
     - `Op. Doadora`: `item.operadoraDoadora || ""`
     - `Nome do Cliente`: `item.nomeCliente || item.nomeCedente || ""`
     - `CPF do Cliente`: `item.cpfCliente || item.cpfCnpjCedente || ""`
     - `Nº Temporário`: `item.numeroTemporario || "Sim"`
  3. Usar o HTML exato especificado na seção "HTML Exato do Quadro" da spec (classe `.section` + `.section-table` + `.lbl`).
  4. Substituir `{{linhasPortadasHtml}}` pelo HTML gerado (ou `""` se vazio).
- **Critério de Aceite**: Quando informado `data.linhasPortadas`, o HTML final gerado pelo `termoService` contém os quadros formatados com as classes corretas.

---

### Task 3a: Repasse de Dados — Geração Sob Demanda

- **Arquivo**: `src/modules/gerador-pdf-html/service.js` (método `generateContractPDF` → chama `termoService.generate(data)`)
- **Ações**:
  1. O `data` passado ao `termoService` já vem do body do request (frontend). Garantir que o frontend passe `linhasPortadas` como array de objetos mapeados a partir dos campos reais do banco.
  2. Documentar no código o contrato esperado do payload: `data.linhasPortadas[]` com os 9 campos mapeados.
- **Critério de Aceite**: Requisições de geração de contrato com portabilidade alimentam `data.linhasPortadas` corretamente.

---

### Task 3b: Repasse de Dados — Script de Lote (Produção)

- **Arquivo**: `src/scripts/regenerate-contract-pdfs.js` — função `mapContractToPayload(contract)`
- **Ações**:
  1. Iterar `contract.negotiation[]` e, para cada item com `tipoLinha === "port-in"`, extrair `portabilityLines[]`.
  2. Mapear cada `portabilityLine` para o formato `data.linhasPortadas[]` usando os campos reais:
     ```js
     linhasPortadas: negotiation
       .filter(neg => neg.tipoLinha === 'port-in')
       .flatMap(neg => (neg.portabilityLines || []).map(line => ({
         tipo: line.tipoCedente ? `Portabilidade ${line.tipoCedente}` : 'Portabilidade PF/PJ',
         numero: line.numero || '',
         plano: neg.plano || '',
         pacotes: '',
         operadoraDoadora: line.operadoraDoadora || '',
         nomeCliente: line.nomeCedente || '',
         cpfCliente: line.cpfCnpjCedente || '',
         numeroTemporario: 'Sim',
       })))
     ```
  3. Incluir `linhasPortadas` no objeto retornado por `mapContractToPayload`.
- **Critério de Aceite**: `make regenerate-contract-pdfs-prod` regera PDFs com os quadros de portabilidade preenchidos.

---

### Task 4: Massa de Teste Local (`test-pdf-html-generation.js`)

- **Arquivo**: `tests/test-pdf-html-generation.js`
- **Ações**:
  1. Adicionar a chave `linhasPortadas` no objeto `dummyData` com 2 itens de exemplo:
     ```js
     linhasPortadas: [
       {
         tipo: 'Portabilidade PJ',
         numero: '(81) 97310-1591',
         plano: 'TIM Black Empresa III',
         pacotes: 'Bonus Especial 20GB ,800 SMS/MMS',
         operadoraDoadora: 'CLARO',
         nomeCliente: 'RODRIGO FERREIRA CAMPOS DA SILVA',
         cpfCliente: '060.781.574-42',
         numeroTemporario: 'Sim',
       },
       {
         tipo: 'Portabilidade PF',
         numero: '(11) 98765-4321',
         plano: 'TIM Black Empresa II',
         pacotes: '',
         operadoraDoadora: 'VIVO',
         nomeCliente: 'MARIA SOUZA',
         cpfCliente: '123.456.789-00',
         numeroTemporario: 'Sim',
       },
     ]
     ```
- **Critério de Aceite**: `make test-pdf-html-generation` gera o PDF do termo com os 2 quadros de portabilidade visíveis e com layout idêntico ao modelo de referência.

---

### Task 5: Testes Unitários

- **Arquivo**: `src/modules/gerador-pdf-html/submodules/termo/termoService.test.js` (**criar arquivo**)
- **Ações**:
  1. Criar o arquivo de teste usando o padrão nativo `node:test` + `node:assert` (mesmo padrão do projeto).
  2. Adicionar teste que envia `linhasPortadas` com 2 itens e verifica se o HTML gerado contém `Número de Acessos:` duas vezes e os campos `nomeCliente`/`cpfCliente` corretos.
  3. Adicionar teste que envia `linhasPortadas: []` e verifica que o placeholder `{{linhasPortadasHtml}}` é completamente removido do HTML.
- **Critério de Aceite**: `npm test` executa os testes com sucesso (sem rodar agora — conforme regra do projeto).

---

### Task 6: Validação Visual e Produção

- **Comandos**:
  - Local: `make test-pdf-html-generation` (gera PDF em `tmp/test-pdfs/html_termo_TESTE.pdf` — validar visualmente a presença e layout dos quadros).
  - Produção: `make regenerate-contract-pdfs-prod` (executa regeneração em lote no container `app_gestor` via SSH).
- **Critério de Aceite**: PDF gerado inspecionado visualmente e idêntico ao modelo de referência.
