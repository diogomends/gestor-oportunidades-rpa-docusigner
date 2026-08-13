# População da Tabela do Contrato de Permanência via Coleção Offer — Specification

## Problem Statement

O documento de **Contrato de Permanência** (`permanenciaTemplate.html` e `src/modules/gerador-pdf-html/service.js`) gerado via HTML → PDF com Playwright teve seu layout canônico homologado na spec `ajuste-permanencia-pdf`, contudo a tabela de cancelamento (Cláusula Terceira) permanecia com valores nulos (`""`) ou estáticos (prazo de permanência fixo em `24`).

Com a expansão da modelagem da coleção `Offer` (`src/models/Offer.js`), os dados financeiros e contratuais da oferta (Planos de Voz e Dados, Valores Mensais Sem/Com Permanência, Benefícios Concedidos, Multas e Tempo de Permanência) passaram a estar armazenados no MongoDB.

Nesta etapa, é necessário:
1. Extrair a lógica do Contrato de Permanência do `service.js` para um submódulo desacoplado `submodules/permanencia/permanenciaService.js` (seguindo a arquitetura SOLID já adotada em `submodules/termo/termoService.js`).
2. Popular automaticamente a tabela da Cláusula Terceira consultando os dados da `Offer` no banco de dados quando os valores não forem enviados explicitamente no payload.
3. Tornar o prazo de permanência dinâmico no template HTML através da substituição da tag `{{tempoPermanencia}}`.
4. Garantir total tolerância a falhas (fallback para `""` sem estourar erro 500) em caso de oferta não encontrada ou instabilidade de conexão com o banco de dados.

---

## Goals & Acceptance Criteria (ACs)

- [x] **PERM-TAB-01**: Quando o payload de geração do contrato de permanência não contiver valores da tabela, o serviço deve buscar os dados na coleção `Offer` do MongoDB para preencher a tabela.
- [x] **PERM-TAB-02**: A busca da oferta no banco deve utilizar o resolvedor multi-candidato (`resolveOfferFromDb`), derivando e testando nomes a partir de `data.oferta`, `data.plano`, `data.negotiation[].oferta/nome/plano` e `data.ofertas[]`, com fallback para busca regex insensível a maiúsculas/minúsculas (`$regex`).
- [x] **PERM-TAB-03**: Precedência de dados (*Payload-First*): Valores enviados explicitamente no objeto `data` da requisição têm precedência total sobre o banco de dados; a busca na coleção `Offer` só é disparada para preencher lacunas.
- [x] **PERM-TAB-04**: Formatação monetária: Valores numéricos do banco de dados ou do payload devem ser formatados no padrão `R$ X,XX` (vírgula decimal); strings que já contenham o prefixo `R$` devem ter seu formato preservado.
- [x] **PERM-TAB-05**: Injeção de `{{tempoPermanencia}}`: O prazo de permanência deve seguir a ordem de prioridade `data.tempoPermanencia` → `offer.tempoPermanencia` → `24` (padrão).
- [x] **PERM-TAB-06**: Resiliência e Fallback: Se a oferta não for encontrada ou se o banco de dados MongoDB estiver indisponível/desconectado, os valores monetários utilizam fallbacks genéricos de negociação (`offer.valor`, `data.valorMensal`, `negotiation[0].valorMensal`) ou strings vazias `""` sem lançar exceção ou retornar HTTP 500.
- [x] **PERM-TAB-07**: Arquitetura e Retrocompatibilidade: `generatePermanencia` no `service.js` deve delegar a execução para `permanenciaService.generate(data)`. `permanenciaService` deve ser re-exportado em `submodules.permanencia` no `index.js`. A suíte de testes existente deve permanecer 100% verde.
- [x] **PERM-TAB-08**: Template HTML: Substituir o valor estático `24` nas 2 células da tabela em `permanenciaTemplate.html` pela tag `{{tempoPermanencia}}`, mantendo o layout e as classes CSS intactos.
- [x] **PERM-TAB-09**: Busca Aprimorada por Oferta (`resolveOfferFromDb`): Suportar busca por `_id` (`data.offerId` / `data.ofertaId`), escape seguro de caracteres especiais em regex (como `+`) e busca flexível por sub-string caso a correspondência exata falhe.
- [x] **PERM-TAB-10**: Ajuste da Precedência com Valores Nulos: Garantir que valores falsy (`""`, `null`, `undefined`) passados no payload não sobrescrevam nem bloqueiem os dados comerciais recuperados do banco de dados `Offer` (`offer.valor`, `offer.valorVozComPerm`, etc.).

---

## Out of Scope

| Feature | Motivo |
| --- | --- |
| Alterações de layout visual, bordas ou fontes do PDF | O layout já foi aprovado e homologado na spec `ajuste-permanencia-pdf` |
| Alterações em outros modelos Mongoose ou schemas Zod | O schema `Offer.js` já possui todos os campos necessários (`planoVoz`, `valorVozSemPerm`, etc.) |
| Modificação de assinaturas de rotas de API | Manutenção da retrocompatibilidade da rota `POST /api/contracts/generate-pdf-html` |
| Alteração dos documentos de Termo ou Proposta | Alterações isoladas exclusivamente no submódulo de Permanência |

---

## Technical Mapping & Architecture

### 1. Novo Submódulo: `submodules/permanencia/permanenciaService.js`
- Mover a função utilitária `formatDataExtenso` e o método `generatePermanencia` de `service.js` para `permanenciaService.js`.
- Exportar a classe `PermanenciaService` e a instância singleton `permanenciaService`.
- Método principal: `async generate(data)` (e alias `generatePermanencia(data)` para compatibilidade).

### 2. Fluxo de População de Dados (Resolution Pipeline)
```
[Payload `data`] 
       │
       ├─► Possui todos os campos da tabela? ──► [SIM] ──► Utiliza valores do payload
       │
       └─► [NÃO] ──► Conectado ao MongoDB? 
                         │
                         ├─► [SIM] ──► Query `resolveOfferFromDb` (Exata + Regex Case-Insensitive)
                         │                │
                         │                ├─► Encontrado ──► Mescla (Payload > Offer DB > Fallback Negociação > "")
                         │                └─► Não encontrado ──► Fallback Negociação / ""
                         │
                         └─► [NÃO] ──► Fallback Negociação / ""
```

### 3. Mapeamento de Campos
| Campo no Template | Prioridade 1 (Payload) | Prioridade 2 (Banco `Offer`) | Prioridade 3 (Fallback Negociação/Default) |
| --- | --- | --- | --- |
| `{{planoVoz}}` | `data.planoVoz` | `offer.planoVoz` \|\| `offer.nome` | `data.plano` \|\| `negotiation[0].plano` \|\| `""` |
| `{{valorVozSemPerm}}` | `data.valorVozSemPerm` | `offer.valorVozSemPerm` | `""` |
| `{{valorVozComPerm}}` | `data.valorVozComPerm` | `offer.valorVozComPerm` \|\| `offer.valor` | `data.valorMensal` \|\| `negotiation[0].valorMensal` \|\| `""` |
| `{{beneficioVoz}}` | `data.beneficioVoz` | `offer.beneficioVoz` | `""` |
| `{{multaVoz}}` | `data.multaVoz` | `offer.multaVoz` | `""` |
| `{{planoDados}}` | `data.planoDados` | `offer.planoDados` | `""` |
| `{{valorDadosSemPerm}}` | `data.valorDadosSemPerm` | `offer.valorDadosSemPerm` | `""` |
| `{{valorDadosComPerm}}` | `data.valorDadosComPerm` | `offer.valorDadosComPerm` | `""` |
| `{{beneficioDados}}` | `data.beneficioDados` | `offer.beneficioDados` | `""` |
| `{{multaDados}}` | `data.multaDados` | `offer.multaDados` | `""` |
| `{{tempoPermanencia}}` | `data.tempoPermanencia` | `offer.tempoPermanencia` | `24` |

---

## Verification Plan

### Testes Automatizados
- Executar suíte de testes unitários nativos Node.js:
  ```powershell
  npm test
  ```
- Executar teste de geração real de PDFs HTML:
  ```powershell
  make test-pdf-html-generation
  ```

### Testes Manuais & Validação Visual
- Inspecionar o PDF gerado em `tmp/test-pdfs/permanencia.pdf` para confirmar se o prazo de permanência (ex: 24) e os valores de tabela estão sendo renderizados corretamente sem quebras de layout.
