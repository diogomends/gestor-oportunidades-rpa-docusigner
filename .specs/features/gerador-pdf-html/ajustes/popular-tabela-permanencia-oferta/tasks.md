# Tasks — População da Tabela do Contrato de Permanência via Coleção Offer

## Visão Geral

Implementação do preenchimento automático da tabela do Contrato de Permanência a partir dos dados comerciais cadastrados na coleção `Offer` do MongoDB, com refatoração do submódulo de Permanência e substituição dinâmica da tag `{{tempoPermanencia}}`.

---

## Tasks

### Task 1: Criar `permanenciaService.js` em `submodules/permanencia/`
- [x] Criar o arquivo `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaService.js`.
- [x] Mover a função `formatDataExtenso` de `service.js` para `permanenciaService.js`.
- [x] Implementar a classe `PermanenciaService` com o método `async generate(data)`:
  - Formatação da data estensa.
  - Resolução de dados do consultor.
  - Extração do nome da oferta de `data.negotiation`, `data.oferta`, `data.plano` ou `data.ofertas`.
  - Lookup na coleção `Offer` via Mongoose (`Offer.findOne({ nome })`) quando houver conexão com o banco e o payload não contiver todos os dados.
  - Aplicação da precedência: *Payload* > *Offer DB* > *Fallback `""`*.
  - Formatação monetária com `formatCurrency()` (`R$ X,XX`).
  - Injeção das tags de substituição (`{{planoVoz}}`, `{{valorVozSemPerm}}`, ..., `{{tempoPermanencia}}`).
  - Renderização via `htmlRenderer.render`.
- [x] Gate de Verificação: Executar `npm test` para garantir que não houve erros de sintaxe ou importação.

### Task 2: Refatorar `service.js` principal para delegação
- [x] Em `src/modules/gerador-pdf-html/service.js`:
  - Importar `permanenciaService` de `./submodules/permanencia/permanenciaService.js`.
  - Atualizar o construtor de `GeradorPdfHtmlService` para incluir `this.services.permanencia = permanenciaService`.
  - Atualizar `generatePermanencia(data)` para delegar a chamada para `permanenciaService.generate(data)`.
  - Atualizar `generateContractPDF(type, data)` para utilizar `this.services[t]`.
  - Remover a função `formatDataExtenso` duplicada de `service.js` (e re-exportar de `permanenciaService.js` para manter compatibilidade, se necessário).
- [x] Gate de Verificação: Executar `npm test`.

### Task 3: Atualizar `permanenciaTemplate.html` com `{{tempoPermanencia}}`
- [x] Em `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaTemplate.html`:
  - Localizar a célula da tabela referente à linha VOZ contendo a permanência estática `24`.
  - Substituir por `{{tempoPermanencia}}`.
  - Localizar a célula da tabela referente à linha DADOS contendo a permanência estática `24`.
  - Substituir por `{{tempoPermanencia}}`.
- [x] Gate de Verificação: Verificar via diff visual que nenhum estilo ou tag HTML vizinha foi alterada.

### Task 4: Atualizar `index.js` e `tests/gerador-pdf-html.test.js`
- [x] Em `src/modules/gerador-pdf-html/index.js`:
  - Importar `permanenciaService` de `./submodules/permanencia/permanenciaService.js`.
  - Incluir `permanencia: permanenciaService` no objeto `submodules`.
- [x] Em `tests/gerador-pdf-html.test.js`:
  - Adicionar asserção `assert.ok(mod.default.submodules.permanencia)` no teste de integração do `index.js`.
- [x] Gate de Verificação: Executar `npm test`.

### Task 5: Criar suíte de testes unitários `permanenciaService.test.js`
- [x] Criar `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaService.test.js`.
- [x] Implementar testes utilizando o runner nativo Node.js (`node:test` + `node:assert` + `mock`):
  - **AC1 / AC2**: Testar busca de oferta no banco via mock de `Offer.findOne`.
  - **AC3**: Testar precedência de payload (dados explicitamente passados no payload não são sobrescritos pelo banco).
  - **AC4**: Testar formatação de moeda (números `14.48` → `"R$ 14,48"`, strings `"R$ 14,48"` preservadas).
  - **AC5**: Testar substituição de `{{tempoPermanencia}}` (valor do payload, valor da oferta ou fallback `24`).
  - **AC6**: Testar resiliência quando `Offer.findOne` falha ou não encontra registro (fallback com `""` sem lançar 500).
- [x] Gate de Verificação: Executar `npm test`.

### Task 6: Atualizar specs de referência e validação final
- [x] Atualizar `.specs/features/modulo-gerador-pdf-html/spec.md` e `tasks.md` marcando a conclusão do item de população de permanência via Offer.
- [x] Gate Final: Executar `npm test` e `make test-pdf-html-generation` garantindo 100% de sucesso na geração dos PDFs de teste.

### Task 7: Aprimorar `resolveOfferFromDb` (Busca por ID / Sub-string) e Precedência de Payload Nulo (PERM-TAB-09 / PERM-TAB-10)
- [x] Em `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaService.js`:
  - Adicionar suporte à busca por `_id` (`data.offerId`, `data.ofertaId`, `data._id` ou no array `negotiation`/`ofertas`).
  - Garantir o escape de caracteres especiais (ex: `+`) na regex de busca de nomes de oferta.
  - Adicionar fallback para busca por sub-string contendo o termo (`$regex: escapeRegex(name)`, `i`) se a busca exata falhar.
  - Ajustar a checagem de precedência em `generate(data)` para que valores `""`, `null` ou `undefined` no payload permitam a leitura dos dados do banco `Offer` (`offer.valor`, `offer.valorVozComPerm`, etc.).
- [x] Em `src/modules/gerador-pdf-html/submodules/permanencia/permanenciaService.test.js`:
  - Adicionar casos de teste para busca por `_id`.
  - Adicionar teste para ofertas com caractere `+` no nome (ex: `"B REG 10GB+20GB BTL TSE_TNE"`).
  - Adicionar teste garantindo que `valorVozComPerm` é lido do banco mesmo se o payload contiver string vazia `""`.
- [x] Gate de Verificação: Executar `npm test` e `make test-pdf-html-generation`.

