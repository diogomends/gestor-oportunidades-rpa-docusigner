# Componente de Modal Reutilizável (componente-modal) — Tasks

## Visão Geral das Tarefas

Breakdown de tarefas para criação e padronização do componente visual de modal reutilizável no frontend.

---

## Tarefas de Implementação

### Fase 1: Estilização e Classe Base JS (`public/js/components/modal.js`)

- [x] **T1: Criar estilos CSS padronizados para Modais (`public/css/modal.css`)**
  - **Critério de Aceitação:** Classes para `.modal-backdrop`, `.modal-dialog`, `.modal-header`, `.modal-body`, `.modal-footer` com suporte a animação de fade/slide.
  - **Requisito Mapeado:** MODAL-UX-04

- [x] **T2: Criar classe reutilizável `ModalComponent` em `public/components/modal-produtos-precos.js`**
  - **Critério de Aceitação:** Métodos `open()`, `close()`, tratamento da tecla `ESC` e clique no backdrop.
  - **Requisito Mapeado:** MODAL-UX-01, MODAL-UX-02, MODAL-API-01, MODAL-API-02

- [x] **T3: Implementar Acessibilidade e Focus Trap**
  - **Critério de Aceitação:** Prender navegação do teclado dentro do modal aberto e restaurar o foco ao fechar.
  - **Requisito Mapeado:** MODAL-UX-03, MODAL-UX-04
