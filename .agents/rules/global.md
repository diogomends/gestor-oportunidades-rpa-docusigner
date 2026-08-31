---
trigger: always_on
---

# Regra Global de Resposta e Execução

- **Formato de Resposta**: Ao responder perguntas, verifique se deve utilizar "Sim" ou "Não".
- **Explicação em caso de "Não"**: Se a resposta for "Não", forneça a explicação de acordo com o nível de complexidade necessário:
  - **Complexidade Baixa**: explicação em até 25 palavras.
  - **Complexidade Média**: explicação em até 50 palavras.
  - **Complexidade Alta**: explicação em até 150 palavras.
- **Revisão de Código e Correção de Falhas**: Se a pergunta for sobre revisão de código ou correção de falha, responda apenas sobre os itens que precisam de ajustes ou que contenham erros.
- **Enumeração de Respostas**: Enumere cada resposta/item apontado; caso sejam necessários mais detalhes, será informado o número e você responde de forma livre.
- **Perguntas Prévias em Features, Refatorações e Fixes**: Quando for criação de nova feature, refatoração ou fix, faça perguntas para tirar dúvidas antes de implementar. Se envolver banco de dados, front-end e back-end, faça perguntas sobre cada um (até 20 perguntas de cada tópico).
- **Sub-agentes e Distribuição de Carga**: Em todas as tarefas, sempre que for possível, utilize sub-agentes paralelos para distribuir a carga de trabalho, realizar pesquisas/investigações simultâneas e evitar execuções sequenciais desnecessárias.
- **Verificação de Especificações (.specs/)**: Antes de responder a qualquer pergunta, solicitação de ajuste, verificação de erro ou refatoração (bem como planejamento, fix ou nova feature), consulte obrigatoriamente o diretório `.specs/` para verificar se existem especificações ou diretrizes lá definidas.
- **Aplicação Continuada de PonyTail e SOLID**: Em qualquer resposta, análise, refatoração ou implementação, aplique rigorosamente os princípios **SOLID** (arquitetura limpa, responsabilidade única) e a prática do **PonyTail** (eliminação de sobre-engenharia, simplicidade e revisão constante), seguindo as diretrizes de [.agents/rules/solid-ponytail-patterns.md](file:///c:/www/producao/servidor-unity-rce/gestor-oportunidades-rpa-docusigner/.agents/rules/solid-ponytail-patterns.md).
- **JSDoc obrigatório**: Toda função, método ou classe criada ou alterada DEVE ter JSDoc completo. Sem exceção.
  - Funções/métodos: `@param`, `@returns`, `@throws` quando aplicável, `@async` se async.
  - Classes: `@class` + `@param` no `constructor`.
  - Models Mongoose: `@typedef` para schema + `@type {import('mongoose').Model<Doc>}` no export.
  - Middlewares Express: `@param {import('express').Request}` / `@param {import('express').Response}` / `@param {import('express').NextFunction}`.
  - Constantes/config: `@constant` + `@type`.
- não rodar testes sem ser solicitado
- verificar se há comando de teste em makefile
- autorizado rodar testes se for de skill instaladas
- **Projeto Relacionado**: este projeto (`gestor-oportunidades-rpa-docusigner`) interage com o projeto `gestor-oportunidades` localizado em `C:\www\producao\servidor-unity-rce\gestor-oportunidades`. Toda decisão, referência a dados compartilhados, contratos, usuários ou APIs externas deve considerar esse projeto como dependência. Sempre consulte esse repositório antes de assumir modelos, schemas ou comportamentos do sistema.
