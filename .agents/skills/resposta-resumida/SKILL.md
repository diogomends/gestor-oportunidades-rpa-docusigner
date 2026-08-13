---
name: resposta-resumida
description: Enforces minimal-token responses: yes/no for simple questions, numbered table (#|Topic|Answer) for multi-topic answers with depth-on-demand via topic number, and file-change table (Item|Status|Path) when files are created/moved/deleted. Uses sub-agents per independent topic when 2+ topics. After elaborating a topic, returns to summary. Use when response brevity matters. Do NOT use for planning phases (use tlc-spec-driven).
license: CC-BY-4.0
metadata:
  author: gestor-oportunidades
  version: 1.0.0
---

# resposta-resumida

Responde no menor número de tokens possível. Toda resposta se encaixa em um dos formatos abaixo — nunca misture formatos.

## Regras

### 1. Pergunta única com resposta sim/não

Responda com `sim` ou `não` seguido de motivo em **até 30 palavras**.

> Usuário: O servidor está rodando?
> Resposta: Sim

> Usuário: O banco caiu?
> Resposta: Não — conexão recusada na porta 27017, verifique se o container está ativo.

### 2. Pergunta com múltiplos tópicos independentes (2+)

Dispare **1 sub-agente por tópico** em paralelo via `task` tool. Cada sub-agente investiga e retorna o resumo do seu tópico. Depois que todos retornarem, monte a tabela:

```
| # | Tópico | Resposta |
|---|--------|----------|
| 1 | Banco  | Não — conexão recusada porta 27017 |
| 2 | Porta  | Sim — porta 3000 responde |
| 3 | Deploy | Sim — último deploy há 2h |
```

Cada célula de resposta: **até 30 palavras**.

### 3. Aprofundamento por número

Se o usuário disser algo como "elabore #2", "detalhe o tópico 1" ou "explique o item 3", responda com explicação completa (sem limite de 30 palavras) para aquele tópico e depois volte ao resumo original.

### 4. Arquivos criados/movidos/deletados

Quando houver criação, movimentação ou deleção de arquivos, exiba:

```
| Item          | Status   | Caminho               |
|---------------|----------|-----------------------|
| Novo arquivo  | ✅ Criado  | src/controllers/foo.js |
| Arquivo movido| 🔄 Movido | src/utils/bar.js → src/helpers/bar.js |
| Arquivo remov | ❌ Removido | src/old/baz.js        |
```

Sem sub-agentes para listagem de arquivos (é direta).

### 5. Quando NÃO usar sub-agentes

- Pergunta única ou sim/não
- Listagem simples de arquivos
- Qualquer situação com apenas 1 tópico

## Sub-agentes: como delegar

Ao delegar um tópico para sub-agente:

```
task tool: type=explore (para investigação rápida) ou type=general (para análise mais complexa)
prompt: "Investigue apenas este tópico: [tópico específico]. Retorne resumo em até 30 palavras."
```

Aguarde todos os sub-agentes retornarem antes de montar a tabela. Se um sub-agente falhar, registre "Erro" na célula e siga com os demais.

## Exemplos

### Exemplo 1: Pergunta única

Usuário: "O deploy foi concluído?"
Ação: Verificar status do deploy (consulta direta, sem sub-agente)
Resposta: Sim — último deploy às 14:23 finalizou com sucesso.

### Exemplo 2: Pergunta multiponto

Usuário: "Quais são os problemas no sistema?"
Ações:
  1. Sub-agente 1: investiga banco de dados
  2. Sub-agente 2: investiga servidor web
  3. Sub-agente 3: investiga fila de jobs
Resposta:
```
| # | Tópico    | Resposta                     |
|---|-----------|------------------------------|
| 1 | Banco     | Conexão lenta (>2s) no MongoDB |
| 2 | Servidor  | OK — CPU 30%, memória 1.2GB   |
| 3 | Jobs      | Fila com 45 itens atrasados    |
```

### Exemplo 3: Aprofundamento

Usuário: "elabore #3"
Ação: Responder com detalhes completos sobre a fila de jobs (sem limite)
Resposta: [explicação detalhada] + "Retornando ao resumo original: [tabela completa igual à anterior]"

### Exemplo 4: Mudança de arquivos

Usuário: commit realizado
Ação: Verificar arquivos alterados no último commit
Resposta:
```
| Item          | Status   | Caminho                          |
|---------------|----------|----------------------------------|
| Novo arquivo  | ✅ Criado  | src/modules/payments/service.js   |
| Arquivo remov | ❌ Removido | src/old/payment-helper.js         |
```

## Troubleshooting

### Sub-agente não retornou

Aguarde até 30s. Se não retornar, registre "Timeout" na célula e prossiga.

### Tópico único mas complexo

Mesmo que o tópico seja complexo, se é **um único tópico**, responda diretamente sem sub-agente (pode ultrapassar 30 palavras se necessário).

### Usuário pede aprofundamento em item que não existe na tabela

Responda: "Não há item #[número] na tabela. Os itens disponíveis são: [listar números]."
