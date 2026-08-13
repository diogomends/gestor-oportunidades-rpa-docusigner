---
name: impact-protector
description: Proteger funcionalidades existentes e alertar impactos antes e durante o planejamento, perguntas ou edições de código (features, bugfixes, refatorações) no frontend e backend, exibindo um resumo conciso de até 100 palavras.
license: CC-BY-4.0
metadata:
  author: Antigravity Team
  version: 1.1.0
---

# Impact Protector

Skill responsável por garantir a integridade do sistema, protegendo funcionalidades, rotas e componentes de frontend e backend contra alterações não solicitadas ou apagamentos acidentais durante **planejamentos, discussões, perguntas (fase inicial)** e durante a execução (adição de recursos, bugfixes ou refatorações).

## Diretrizes Fundamentais

1. **Consulta Obrigatória a `.specs/`**:
   - Sempre que for solicitada uma nova feature, correção de bug (fix) ou refatoração, verificar obrigatoriamente se existe alguma especificação registrada no diretório `.specs/` antes de qualquer planejamento ou alteração de código.
2. **Escopo Estrito em Todas as Fases**:
   - **Na fase de planejamento e perguntas**: Ao discutir ideias, tirar dúvidas ou propor soluções, identifique e declare explicitamente o que **NÃO** será alterado.
   - **Na fase de execução**: Focar exclusivamente nos arquivos e elementos solicitados pelo usuário. Qualquer modificação fora do escopo explícito é proibida.
3. **Proteção do Legado**:
   - **Frontend (`public/`)**: Preservar seletores DOM, elementos HTML, classes CSS e event listeners (`addEventListener`) que não foram expressamente alvo do ajuste.
   - **Backend (`src/`)**: Preservar assinaturas de rotas, middlewares, validações Zod e schemas Mongoose que não foram solicitados.
4. **Substituição Cirúrgica**: Nunca sobrescrever arquivos completos se apenas uma parte precisa ser modificada. Usar substituições contíguas ou pontuais mantendo o código ao redor intacto.
5. **Alerta de Impacto Pré-Execução**: Antes de aplicar edições de código, apresentar um resumo conciso (até 100 palavras) destacando os arquivos afetados e o comportamento após a mudança.

## Workflow por Fase

### Fase A: Planejamento, Perguntas e Discussão
Ao responder perguntas do usuário ou planejar uma feature/fix:
1. Consultar a pasta `.specs/` para verificar especificações existentes sobre o problema/feature.
2. Apresentar o plano delimitando o escopo exato.
3. Declarar explicitamente os módulos, telas e contratos de API protegidos que permanecerão intocados.
4. Confirmar com o usuário antes de avançar para a escrita de código.

### Fase B: Execução de Alterações de Código

#### Passo 1: Mapeamento de Escopo e Proteção
- Consultar a pasta `.specs/` para validar especificações e regras vigentes do módulo.
- Identifique os arquivos estritamente necessários para a tarefa.
- Liste os componentes, seletores DOM e endpoints vizinhos que **NÃO** devem ser tocados.

#### Passo 2: Emissão do Alerta Pré-Execução (Máx. 100 Palavras)
Formate a mensagem obrigatoriamente neste padrão antes de editar arquivos:

```markdown
> 🛡️ **Alerta de Impacto & Proteção de Escopo**
> - **Onde irá mudar:** `caminho/do/arquivo.extensao` (linha X / componente Y)
> - **O que acontece após a mudança:** [Descrição clara do resultado da nova feature/fix/refatoração e confirmação de que os elementos/rotas existentes em torno foram totalmente preservados].
```

*(Nota: O texto do alerta deve ter no máximo 100 palavras).*

#### Passo 3: Execução Cirúrgica
- Modifique apenas os trechos estritamente autorizados.
- Não remova imports, funções utilitárias ou tags HTML não relacionadas.
- Valide se o código ao redor permanece totalmente funcional.

## Checklist de Validação
- [ ] A pasta `.specs/` foi consultada para buscar especificações anteriores sobre o problema/feature?
- [ ] No planejamento/perguntas, os limites de escopo e componentes intocados foram declarados?
- [ ] O resumo de impacto pré-execução foi exibido com menos de 100 palavras?
- [ ] Nenhum elemento HTML ou event listener legado do frontend foi deletado?
- [ ] Nenhuma rota, schema ou middleware legado do backend foi alterado indevidamente?
