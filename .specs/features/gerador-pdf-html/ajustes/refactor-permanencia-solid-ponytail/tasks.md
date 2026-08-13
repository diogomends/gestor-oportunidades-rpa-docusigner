# Tarefas: Refatoração SOLID + PonyTail em permanenciaService.js

## Fase 1: Cache de Assets e Extração de Funções Puras (SRP - Opção 1)

- [x] **TASK-01**: Cachear `logoBase64` na inicialização do módulo e criar `buildHeaderTemplate(logoBase64)`
  - **Verificação**: `logoBase64` é lido 1 única vez ao importar o módulo; `buildHeaderTemplate` gera a string HTML correta.
- [x] **TASK-02**: Extrair `resolveFields(data, dbOffer)` para consolidar precedência de dados e formatação
  - **Verificação**: A função `resolveFields` deve ser exportável/testável e retornar o dicionário exato de substituição de placeholders `{{var}}`.

## Fase 2: Inversão de Dependências e Simplificação PonyTail (DIP + PonyTail - Opção 2)

- [x] **TASK-03**: Refatorar `resolveOfferFromDb` aplicando PonyTail e permitindo injeção de dependência (`offerResolver`)
  - **Verificação**: O construtor do `PermanenciaService` aceita `offerResolver` customizado; `resolveOfferFromDb` prioriza busca por ID canônico sem especulações desnecessárias.
- [x] **TASK-04**: Simplificar método `generate(data)` para atuar estritamente como orquestrador
  - **Verificação**: O método `generate` possui menos de 25 linhas, delegando a montagem de campos e cabeçalho para as funções puras.

## Fase 3: Validação e Testes

- [x] **TASK-05**: Executar testes nativos e Playwright E2E para confirmar zero regressão na geração de PDF de permanência
  - **Verificação**: `make test-pdf-html-generation` ou testes nativos geram o PDF idêntico sem erros.

