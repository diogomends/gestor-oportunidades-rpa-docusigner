# Especificação: Refatoração SOLID + PonyTail em permanenciaService.js

## Visão Geral

Esta especificação define a refatoração do módulo `permanenciaService.js` (`src/modules/gerador-pdf-html/submodules/permanencia/permanenciaService.js`) combinando as **Opções 1 e 2**, que se demonstraram **100% complementares**:

- **Opção 1 (Organização Interna & Cache de I/O)**: Aplica o Princípio da Responsabilidade Única (SRP), separando a montagem do cabeçalho HTML, a consolidação/precedência de campos e a renderização do PDF em funções puras. Além disso, elimina I/O redundante realizando o cache do `logoBase64` no carregamento do módulo.
- **Opção 2 (Inversão de Dependência & Simplificação de Payload)**: Aplica o Princípio da Inversão de Dependência (DIP), permitindo a injeção do repositório/função de busca de ofertas (desacoplando o model Mongoose `Offer` diretamente no service), e aplica a mentalidade PonyTail para simplificar a resolução de ofertas sem especulação excessiva.

---

## Requisitos & Critérios de Aceite

### REQ-01: Cache de I/O e Montagem do Header (SRP + Performance)
- **Descrição**: O arquivo de logo (`logo.png`) deve ser lido e convertido para Base64 uma única vez na inicialização do módulo, junto com a leitura do template HTML.
- **Critérios de Aceite**:
  1. `readFileSync(LOGO_PATH)` deve ser executado no escopo do módulo e não dentro do método `generate()`.
  2. Criar a função pura `buildHeaderTemplate(logoBase64)` responsável exclusivamente por retornar a string HTML do cabeçalho.

### REQ-02: Consolidação e Resolução de Campos (SRP & Pure Functions)
- **Descrição**: A lógica de precedência de valores (Payload > DB > Fallbacks > Default) e formatação de moedas/datas deve ser extraída do método `generate()`.
- **Critérios de Aceite**:
  1. Criar a função pura `resolveFields(data, dbOffer)` que recebe os dados de entrada e a oferta consultada e retorna o objeto `fields` com todos os valores formatados.
  2. O método `generate()` deve apenas orquestrar as chamadas: chamar o resolver de oferta, obter `fields`, realizar a substituição no template HTML e invocar o `htmlRenderer`.

### REQ-03: Inversão de Dependência na Consulta de Ofertas (DIP)
- **Descrição**: O `PermanenciaService` não deve depender diretamente do model estático `Offer` do Mongoose, permitindo injeção de dependência para facilidade de testes unitários e desacoplamento de infraestrutura.
- **Critérios de Aceite**:
  1. O construtor do `PermanenciaService` deve aceitar um `offerResolver` opcional (com fallback padrão para a busca no Mongoose).
  2. A consulta ao banco deve ser encapsulada e mockável em testes sem necessidade de subir conexão MongoDB real.

### REQ-04: Simplificação PonyTail na Busca de Ofertas (PonyTail)
- **Descrição**: Eliminar sobre-engenharia e especulação excessiva (varredura de múltiplos arrays e 7 campos alternativos) na função `resolveOfferFromDb`.
- **Critérios de Aceite**:
  1. Priorizar busca direta por `offerId` ou `ofertaId` canônicos.
  2. Manter busca simples por nome/termo apenas se ID não for fornecido.
  3. Reduzir a complexidade ciclomática da função de resolução de oferta.

### REQ-05: Preservação do Contrato de API e Compatibilidade
- **Descrição**: A interface pública do serviço não deve sofrer Breaking Changes.
- **Critérios de Aceite**:
  1. A assinatura do método `generate(data)` e do alias `generatePermanencia(data)` deve ser preservada.
  2. A instância singleton exportada `permanenciaService` deve continuar funcionando como export padrão/nomeado.

---

## Proteção de Escopo e Elementos Preservados (Impact Protector)

- **Preservados sem alteração**:
  - Template HTML `permanenciaTemplate.html` (estrutura e seletores CSS intocados).
  - Utilitários exportados `formatDataExtenso` e `formatCurrency`.
  - Módulo `htmlRenderer.js` e suas opções de margem/formato.
  - Endpoints de API (`POST /api/contracts/generate-pdf-html`).
