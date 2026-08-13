---
trigger: always_on
---

# Regra de Proteção de Escopo e Alerta de Impacto

- Sempre que o usuário solicitar nova feature, correção de bug (fix), refatoração (refactor) ou estiver nas fases de planejamento, discussão e perguntas (spec/design/tlc), invoque e siga a skill `impact-protector`.
- **Fase de Planejamento e Perguntas**: Ao discutir ou responder perguntas sobre novas tarefas, delimite explicitamente os componentes/rotas legados que serão preservados e intocados.
- **Fase de Execução (Edição)**: Antes de realizar edições em qualquer arquivo, apresente obrigatoriamente um resumo pré-execução de até 100 palavras contendo:
  1. **Onde irá mudar:** Arquivo e trecho/linha afetado.
  2. **O que acontece após a mudança:** Resultado final e garantia de que os elementos HTML, seletores DOM, rotas e regras legadas não solicitadas foram totalmente preservados.
- É proibido remover ou sobrescrever componentes, elementos do DOM ou contratos de API que não façam parte da solicitação direta em qualquer fase.
