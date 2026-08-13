# Componente Logout — Architectural Design

## Overview

O `componente-logout` é um módulo ES6 isolado responsável por gerenciar a interface, estados e evento de encerramento de sessão no CRM.

No PR #95 (`fix/acessos-usuarios`), a Sidebar foi corrigida para importar `clearSession` diretamente de `public/js/core/session.js`. Este design evolui essa alteração encapsulando o botão e sua lógica visual em um componente reutilizável sob `public/modules/logout/logout-button.js`.

---

## Directory Structure

```
public/
└── modules/
    └── logout/
        ├── logout-button.js   # Módulo/Classe ES6 principal do componente
        └── logout.css         # Estilos específicos do componente (opcional)
tests/
└── logout.test.js             # Suíte de testes unitários nativos (node --test)
```

---

## Component Interface (`public/modules/logout/logout-button.js`)

```js
import { clearSession } from "../../js/core/session.js";

/**
 * LogoutButton Component
 */
export class LogoutButton {
  /**
   * Inicializa o botão de logout em um elemento existente ou seletor
   * @param {HTMLElement|string} target - Seletor CSS ou Elemento DOM do botão
   * @param {Object} options - Opções de configuração (mensagem de logout, callbacks, etc)
   */
  static init(target, options = {}) {
    const element = typeof target === "string" ? document.querySelector(target) : target;
    if (!element) return null;

    const instance = new LogoutButton(element, options);
    instance.bindEvents();
    return instance;
  }

  constructor(element, options = {}) {
    this.element = element;
    this.options = options;
  }

  bindEvents() {
    this.element.addEventListener("click", (e) => this.handleClick(e));
  }

  handleClick(e) {
    if (e) e.preventDefault();
    
    // Evita chamadas duplicadas e fornece feedback de estado
    this.element.disabled = true;
    this.element.classList.add("loading");

    // Executa encerramento de sessão via módulo central
    clearSession(this.options.message || null);
  }
}
```

---

## Component Integration Points

### 1. Sidebar (`public/modules/sidebar/setup-events.js`)

Substituir o listener de clique inline introduzido no PR #95 pela inicialização do `LogoutButton`:

```js
import { toggleSidebar } from "./toggle-sidebar.js";
import { toggleSubmenu } from "./toggle-submenu.js";
import { LogoutButton } from "../logout/logout-button.js";

export function setupEvents() {
  // ... (outros eventos)

  // 3. Logout Button
  const logoutBtn = document.getElementById("sidebarLogoutBtn");
  if (logoutBtn) {
    LogoutButton.init(logoutBtn);
  }
}
```

---

## Testing Strategy (`tests/logout.test.js`)

Os testes utilizarão o test runner nativo do Node.js (`node --test`) e `node:assert`.

### Estrutura do Teste Unitário:
1. **Limpeza de Sessão**: Teste da função `clearSession` em `public/js/core/session.js` simulando `localStorage` e `sessionStorage`.
2. **Ciclo de Vida do Componente**: Instanciação do `LogoutButton`, verificação do evento de clique, adição de classes de loading e acionamento do `clearSession`.

---

## Makefile Integration

Alvo dedicado no `Makefile`:

```makefile
test-logout:
	node --test tests/logout.test.js
```
