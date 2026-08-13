# Ajuste de Contratos e Ofertas Specification

## Problem Statement

Atualmente, o Gestor de Oportunidades permite preencher apenas uma negociação por contrato, com campos estáticos e em layout que consome muito espaço vertical. Além disso, não há suporte estruturado para portabilidade (Port in) com a coleta dos dados de cedente, operadora de origem e múltiplos números, que são necessários para contratos com várias linhas. O objetivo deste ajuste é flexibilizar a contratação de múltiplos planos em um único contrato, permitindo a distinção entre portabilidade (Port in) e linhas novas de forma dinâmica.

## Goals

- [ ] Melhorar o aproveitamento de espaço do formulário no frontend, colocando Plano, Oferta e Valor Mensal na mesma linha.
- [ ] Adicionar suporte a portabilidade (Port in) com dados de cedente (PF/PJ), operadora de origem, nome, documento e telefone (com máscaras).
- [ ] Permitir a adição dinâmica de múltiplos números portados para um mesmo plano.
- [ ] Permitir a adição dinâmica de múltiplas ofertas/planos no formulário (múltiplas seções).
- [ ] Atualizar o banco de dados para armazenar a negociação como um array de objetos, garantindo compatibilidade reversa com contratos antigos.

## Out of Scope

| Feature     | Reason         |
| ----------- | -------------- |
| Integração com consulta automatizada à Anatel | Fora do escopo do formulário do CRM nesta fase. |
| Alteração no design do PDF final | Focado em coletar e expor os dados no JSON do contrato, a renderização específica em PDF de arrays complexos não é o foco principal desse ajuste (se mantido, haverá fallback). |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default  | Rationale | Confirmed? |
| --------------------- | --------------- | --------- | ---------- |
| Operadoras de Portabilidade | Lista de operadoras incorporada de forma estática no HTML/JS | Escolha do usuário (Opção A1) por motivos de performance. |
| Tipo de Cedente | Opções "PF" (Pessoa Física) e "PJ" (Pessoa Jurídica) | Escolha do usuário (Opção A2) para abranger ambos os tipos. |
| Documento de Cedente dinâmico | Se PJ selecionado, o campo vira CNPJ com máscara e validação adequadas; se PF, CPF | Escolha do usuário (Opção A3). |
| Estrutura de múltiplos planos | A negociação será representada por um array de planos, contendo cada um a sua lista de números associados (dados de portabilidade se Port in, ou acessos se Linha Nova) | Escolha do usuário (Opção A4). |
| Alteração no Mongoose | O campo `negotiation` passa a ser um array de objetos no Mongoose | Escolha do usuário (Opção A5). |
| Fluxo de Git Branch | Utilizar a nova branch `feat/ajuste-contratos-ofertas` | Escolha do usuário (Opção A6). |

---

## User Stories

### P1: Layout Compacto e Seleção de Tipo de Linha ⭐ MVP

**User Story**: Como um operador de vendas, eu quero visualizar Plano, Oferta e Valor Mensal alinhados na mesma linha, e poder escolher se uma oferta é "Port in" ou "Linha Nova".

**Why P1**: Essencial para a interface visual limpa e para o fluxo de entrada de dados de linhas.

**Acceptance Criteria**:
1. WHEN a página de negociação é exibida THEN os inputs de Plano, Oferta e Valor Mensal SHALL ser renderizados alinhados horizontalmente (na mesma linha).
2. WHEN o operador clica na seção de Opções de Oferta THEN o sistema SHALL exibir botões de rádio para "Port in" e "Linha Nova".
3. WHEN "Linha Nova" é selecionado THEN os campos de portabilidade SHALL permanecer ocultos.

**Independent Test**: Abrir o formulário de contratos, verificar se os três campos estão na mesma linha e se existem os botões de rádio "Port in" e "Linha Nova" desabilitando os campos de portabilidade.

---

### P2: Campos de Portabilidade com Validação e Máscaras Dinâmicas ⭐ MVP

**User Story**: Como um operador de vendas, eu quero que ao selecionar "Port in", o sistema exiba campos específicos de cedente (nome, CPF/CNPJ, número de telefone com máscara e operadora) para preenchimento obrigatório e valide os dados.

**Why P2**: Necessário para coletar os dados válidos do cedente para o processo de portabilidade.

**Acceptance Criteria**:
1. WHEN "Port in" é selecionado THEN o sistema SHALL exibir o select de Tipo de Cedente (PF/PJ), o select de Operadora Doadora, e os campos "Nome Cedente", "Documento Cedente" e "Número de Telefone".
2. WHEN o Tipo de Cedente é alterado para "PJ" THEN o campo "Documento Cedente" SHALL aplicar máscara de CNPJ e validar o formato de CNPJ.
3. WHEN o Tipo de Cedente é alterado para "PF" THEN o campo "Documento Cedente" SHALL aplicar máscara de CPF e validar o formato de CPF.
4. WHEN o Número de Telefone é digitado THEN o sistema SHALL aplicar a máscara `(XX) X XXXX-XXXX` ou `(XX) XXXX-XXXX` e validar.

**Independent Test**: Selecionar "Port in", selecionar "PJ", digitar CNPJ válido e inválido, testar máscaras de CPF e telefone na tela de contratos.

---

### P3: Adição de Múltiplos Números Portados e Múltiplas Ofertas

**User Story**: As a operador, I want para adicionar mais números portados a uma oferta de Port in e também adicionar múltiplas ofertas inteiras no mesmo contrato.

**Why P3**: Permite contratos complexos com várias linhas e diferentes planos para o mesmo cliente.

**Acceptance Criteria**:
1. WHEN o operador clica em "Adicionar número portado" em uma oferta Port in THEN o sistema SHALL clonar e renderizar um novo grupo de campos de dados de portabilidade (Nome, Tipo Cedente, Documento, Telefone, Operadora) associado àquele plano.
2. WHEN o operador clica no botão "Adicionar Nova Oferta" THEN o sistema SHALL clonar uma seção inteira de "Opções de Oferta" vazia com todos os seus controles (rádios, selects, campos, botões de remoção).
3. WHEN o operador envia o formulário THEN o sistema SHALL coletar todas as seções e as suas respectivas linhas estruturadas em um array de negociações.

**Independent Test**: Adicionar múltiplos números a um plano Port in, adicionar um segundo plano com "Linha Nova", avançar para o resumo e validar o payload final.

---

### P4: Atualização do Mongoose Schema e Retrocompatibilidade

**User Story**: Como desenvolvedor do sistema, eu quero que o banco de dados e as rotas suportem um array de negociações e leiam corretamente contratos antigos que tinham apenas uma negociação como objeto.

**Why P4**: Mantém o histórico de contratos existentes íntegro e permite salvar as novas estruturas.

**Acceptance Criteria**:
1. WHEN o schema do Mongoose `Contract` é instanciado THEN o campo `negotiation` SHALL ser definido como um array de objetos `[negotiationSchema]`.
2. WHEN um contrato antigo é buscado do banco (onde `negotiation` era um único objeto) THEN a camada de serviço/controller SHALL convertê-lo transparentemente em um array com um único elemento, garantindo compatibilidade com o frontend.
3. WHEN a validação de backend é executada THEN o sistema SHALL validar cada item do array de negociações conforme as regras de negócio.

---

## Edge Cases

- WHEN o operador adiciona uma seção de oferta vazia e tenta avançar THEN o sistema SHALL exibir erros de validação focados na respectiva seção.
- WHEN um contrato antigo é atualizado no novo formato THEN o sistema SHALL salvar as negociações como array no banco.

---

## Requirement Traceability

| Requirement ID | Story                                                      | Phase  | Status  |
| -------------- | ---------------------------------------------------------- | ------ | ------- |
| CONTR-01       | P1: Layout Compacto e Seleção de Tipo de Linha             | Design | Pending |
| CONTR-02       | P1: Layout Compacto e Seleção de Tipo de Linha             | Design | Pending |
| CONTR-03       | P2: Campos de Portabilidade com Validação e Máscaras       | Design | Pending |
| CONTR-04       | P2: Campos de Portabilidade com Validação e Máscaras       | Design | Pending |
| CONTR-05       | P3: Adição de Múltiplos Números Portados e Múltiplas Ofertas| Design | Pending |
| CONTR-06       | P3: Adição de Múltiplos Números Portados e Múltiplas Ofertas| Design | Pending |
| CONTR-07       | P4: Atualização do Mongoose Schema                         | Design | Pending |
| CONTR-08       | P4: Atualização do Mongoose Schema                         | Design | Pending |

---

## Success Criteria

- [ ] Operador consegue cadastrar múltiplos planos (seções) com múltiplos números portados (com máscaras ativas).
- [ ] O banco de dados salva a nova estrutura sem erros e carrega contratos antigos com segurança (teste de retrocompatibilidade passa).
