# Componente de Modal Reutilizável (componente-modal) — Design

## Arquitetura de UI

O componente de modal é uma abstração em Vanilla JS (ES6 Module) projetada para padronizar o comportamento e a estilização dos modais na aplicação. Todos os assets visuais, comportamentos JS e templates HTML de modais residem exclusivamente em `public/components/modal/`.

```
public/components/modal/
├── modal.css                      # Estilos globais para modais (backdrop, dialog, animações)
├── modal-produtos-precos.js       # Classe reutilizável ModalProdutosPrecos
└── modal-produtos-precos.html     # Template HTML isolado do modal de Produtos e Preços
```

## Estrutura DOM Padrão (`modal-produtos-precos.html`)

```html
<div id="offerModal" class="modal-overlay" role="dialog" aria-modal="true">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="modalTitle">Título do Modal</h3>
      <button type="button" class="btn-close" id="btnCloseModal" aria-label="Fechar">&times;</button>
    </div>
    <form id="offerForm">
      <!-- Conteúdo do Formulário -->
    </form>
  </div>
</div>
```

## Interface do Componente JS (`ModalProdutosPrecos`)

```js
export class ModalProdutosPrecos {
  constructor(options = {}) {
    // Inicialização de caminhos HTML/CSS, event listeners de ESC e Backdrop Click
  }

  async open(data = null) {
    // Carrega HTML dinamicamente se necessário, exibe modal, gerencia foco e callbacks
  }

  close() {
    // Esconde o modal, desbloqueia scroll do body e reseta o formulário
  }
}
```
