# Tooltips Padronizadas (tooltips) — Specification

## Problem Statement

O codebase possui 4 implementações distintas de tooltip, sem componente centralizado:

| Padrão | Localização | Mecanismo |
|--------|-------------|-----------|
| CSS custom | `public/css/style.css:378-437` | `.tooltip-container` / `.tooltip-text`, hover puro |
| CSS popover | `public/modules/commissions/css/styles.css:110-186` | `.help-icon` / `.popover-text`, hover + toggle `.active` via JS |
| Bootstrap tooltip | `public/modules/acl/controle-acessos.js:174-212` | `data-bs-toggle="tooltip"`, inicialização JS via `window.bootstrap.Tooltip` |
| `title` nativo | `public/js/features/dashboard/ui/render-table.js:152,162` | `td.title = value`, tooltip do navegador |

Essa fragmentação gera inconsistência visual, dependência desnecessária de Bootstrap para tooltips e código duplicado.

## Goals

- Padronizar todas as tooltips em um único padrão CSS puro, sem dependência de JS ou Bootstrap.
- Eliminar as 3 implementações deprecadas (commissions popover, Bootstrap tooltip, `title` nativo).
- Manter o padrão existente em `style.css` como base (já é o mais global e completo).

## Out of Scope

| Funcionalidade | Motivo |
|----------------|--------|
| Tooltips dinâmicas via API/banco | Conteúdo sempre hardcoded no HTML |
| Interação via clique/touch | Hover apenas — mobile resolve via `:focus` |
| Animações complexas | Transição opacity 0.3s existente é suficiente |
| Reposição do Bootstrap tooltip | Bootstrap continua disponível para outros usos, apenas tooltip é removido |

---

## Padrão Definido

### Estrutura HTML

```html
<span class="tooltip-container">
  <i class="tooltip-icon">info</i>
  <span class="tooltip-text">Texto da tooltip aqui</span>
</span>
```

**Regras:**
- `tooltip-container` é `inline-flex` com `position: relative`.
- `tooltip-icon` é o ícone clicável (ícone `info-circle` ou similar).
- `tooltip-text` é o conteúdo, posicionado acima por padrão.
- Não usar `title` nativo nem `data-bs-toggle="tooltip"`.

### CSS Classes

```css
/* Container */
.tooltip-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 0.5rem;
  vertical-align: middle;
}

/* Ícone */
.tooltip-icon {
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: help;
  transition: color 0.2s;
}

.tooltip-icon:hover {
  color: var(--primary-color);
}

/* Caixa de texto */
.tooltip-text {
  visibility: hidden;
  width: 200px;
  background-color: var(--surface-dark);
  color: var(--text-primary);
  text-align: center;
  border-radius: var(--radius-md);
  padding: 0.5rem;
  position: absolute;
  z-index: 1;
  bottom: 125%;
  left: 50%;
  margin-left: -100px; /* Center: -(width/2) */
  opacity: 0;
  transition: opacity 0.3s;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--border-color);
  font-size: 0.75rem;
  font-weight: normal;
  pointer-events: none;
}

/* Hover show */
.tooltip-container:hover .tooltip-text {
  visibility: visible;
  opacity: 1;
}

/* Seta */
.tooltip-text::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -5px;
  border-width: 5px;
  border-style: solid;
  border-color: var(--border-color) transparent transparent transparent;
}
```

### Posicionamento

| Posição | Classe auxiliar | Ajuste CSS |
|---------|----------------|------------|
| Acima (padrão) | nenhuma | `bottom: 125%` + seta `top: 100%` |
| Abaixo | `.tooltip-bottom` | `top: 125%` + seta `bottom: 100%` com bordas invertidas |
| Esquerda | `.tooltip-left` | `right: 125%` + seta à direita |
| Direita | `.tooltip-right` | `left: 125%` + seta à esquerda |

**Nota:** a maioria dos usos será acima (padrão). Posições alternativas são opt-in via classe.

### Variáveis CSS

Todas as cores e espaçamentos usam as variáveis CSS globais já existentes:

| Propriedade | Variável | Fallback |
|-------------|----------|----------|
| Cor do ícone | `--text-secondary` | `#aaa` |
| Cor ao hover | `--primary-color` | `#00a3ff` |
| Fundo da caixa | `--surface-dark` | `#2a2d3e` |
| Cor do texto | `--text-primary` | `#fff` |
| Borda | `--border-color` | `#444` |
| Border-radius | `--radius-md` | `6px` |

---

## User Stories

### US-01: Tooltip Padrão Acima

**User Story:** Como usuário, quero ver uma tooltip ao passar o mouse sobre um ícone de informação, para entender o contexto sem sair da tela.

**Acceptance Criteria:**

1. TOOLTIP-01: WHEN usuário faz hover sobre `.tooltip-icon` THEN `.tooltip-text` fica visível com transição de 0.3s.
2. TOOLTIP-02: WHEN usuário remove o mouse THEN `.tooltip-text` desaparece com transição de 0.3s.
3. TOOLTIP-03: WHEN tooltip está visível THEN `.tooltip-text` está posicionada acima do ícone, centralizada horizontalmente, com seta apontando para baixo.
4. TOOLTIP-04: WHEN tooltip está visível THEN `pointer-events: none` impede que o mouse ao sobre o texto feche a tooltip.

### US-02: Migração de Padrões Deprecados

**User Story:** Como desenvolvedor, quero que as implementações antigas sejam substituídas pelo padrão único, para manter consistência no código.

**Acceptance Criteria:**

5. TOOLTIP-MIG-01: WHEN módulo de comissions é atualizado THEN `.help-icon` / `.popover-text` são substituídos por `.tooltip-container` / `.tooltip-text`.
6. TOOLTIP-MIG-02: WHEN módulo de ACL é atualizado THEN `data-bs-toggle="tooltip"` + inicialização JS são removidos, substituídos pelo padrão CSS.
7. TOOLTIP-MIG-03: WHEN dashboard render-table é atualizado THEN `td.title = value` é substituído por `.tooltip-container` quando aplicável (células truncadas).
8. TOOLTIP-MIG-04: WHEN módulo de comissions é atualizado THEN o handler JS de toggle `.active` para mobile é removido (hover-only).

---

## Edge Cases

| # | Caso | Comportamento Esperado |
|---|------|------------------------|
| 1 | Tooltip perto da borda superior da viewport | Overflow visível — não requer tratamento especial (z-index alto o suficiente). |
| 2 | Texto muito longo (>200px) | Wrap automático (`width: 200px` definido). Não truncar. |
| 3 | Múltiplas tooltips na mesma linha | Cada uma é independente, sem sobreposição (z-index igual, última na DOM fica no topo). |
| 4 | Usuário em dispositivo móvel (touch) | Tooltip não aparece (hover-only). Conteúdo acessível via outros meios se necessário. |

---

## Deprecations

| Padrão Antigo | Arquivo | Substituir por |
|---------------|---------|----------------|
| `.help-icon` / `.popover-text` | `public/modules/commissions/css/styles.css:110-186` | `.tooltip-container` / `.tooltip-text` |
| `.help-icon.active` JS toggle | `public/modules/commissions/js/views/CampaignModal.js:200-213` | Remover handler |
| `data-bs-toggle="tooltip"` | `public/modules/acl/controle-acessos.js:174-212` | `.tooltip-container` / `.tooltip-text` |
| Bootstrap Tooltip init | `public/modules/acl/controle-acessos.js:207-212` | Remover bloco |
| `td.title = value` | `public/js/features/dashboard/ui/render-table.js:152,162` | `.tooltip-container` (onde aplicável) |

---

## Requirement Traceability

| Req | US | Critério |
|-----|----|----------|
| TOOLTIP-01 | US-01 | Hover mostra tooltip |
| TOOLTIP-02 | US-01 | Sair esconde tooltip |
| TOOLTIP-03 | US-01 | Posição acima + seta |
| TOOLTIP-04 | US-01 | pointer-events: none |
| TOOLTIP-MIG-01 | US-02 | Commissions migrado |
| TOOLTIP-MIG-02 | US-02 | ACL migrado |
| TOOLTIP-MIG-03 | US-02 | Dashboard migrado |
| TOOLTIP-MIG-04 | US-02 | JS toggle removido |
