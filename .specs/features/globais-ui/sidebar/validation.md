# Sidebar — Validation Report

**Verifier**: independent (author ≠ verifier)
**Date**: 2026-07-12
**Spec**: `.specs/features/sidebar/spec.md`
**Design**: `.specs/features/sidebar/design.md`

---

## Spec-Anchored Outcome Check

22 ACs cross-referenced against actual source code. Status per AC:

| ID | Status | Evidence |
| -- | ------ | -------- |
| SIDEBAR-FE-01 | PASS | `load-sidebar.js:10-13` — fetch + innerHTML |
| SIDEBAR-FE-02 | PASS | `load-sidebar.js:15-17` — catch com fallback HTML |
| SIDEBAR-FE-03 | PASS | `index.js:33-51` — `highlightActiveLink()` marca `.active` |
| SIDEBAR-FE-04 | PASS | `index.js:44-49` — submenu pai recebe `.open` |
| SIDEBAR-BE-01 | PASS | `core/ui/sidebar.js:11-12` — 3 itens vendedor |
| SIDEBAR-BE-02 | PASS | `core/ui/sidebar.js:13-18` — 5 itens supervisor |
| SIDEBAR-BE-03 | PASS | `core/ui/sidebar.js:19-25` — 5 itens coordenador |
| SIDEBAR-BE-04 | PASS (corrected) | `core/ui/sidebar.js:26-37` — 10 itens admin; `navContracts` não tem role gating |
| SIDEBAR-BE-05 | PASS (corrected) | `core/ui/sidebar.js:38-49` — 10 itens suporte (mesmo escopo admin) |
| SIDEBAR-FE-05 | PASS | `core/ui/sidebar.js:71-83` — forEach com `display:none` |
| SIDEBAR-FE-06 | PASS | `toggle-sidebar.js:4-11` — `classList.toggle("collapsed")` |
| SIDEBAR-FE-07 | PASS | `sidebar.css:152-156` — `.logo span, .logo > i, .nav-item span` ocultos |
| SIDEBAR-FE-08 | PASS | `sidebar.css:202-219` — `position: absolute; left: 100%` |
| SIDEBAR-FE-09 | PASS | `toggle-sidebar.js:11` — `localStorage.setItem("sidebarCollapsed", ...)` |
| SIDEBAR-FE-10 | PASS | `toggle-sidebar.js:14-23` — restore via localStorage |
| SIDEBAR-FE-11 | PASS | `toggle-submenu.js:6-15` — data-toggle/data-target → toggle `.open` |
| SIDEBAR-FE-12 | PASS | `sidebar.css:79-85` — `max-height: 0 → 500px` com transition |
| SIDEBAR-FE-13 | PASS | `sidebar.css:117-125` — `.submenu-arrow` rotate(180deg) |
| SIDEBAR-FE-14 | PASS | `core/ui/user-info.js:6-16` — innerText nome/cargo/inicial |
| SIDEBAR-FE-15 | PASS | `setup-events.js:31-37` — guard + clearSession |
| SIDEBAR-CSS-01 | PASS | `sidebar.css:248-255` — `@media max-width: 768px` display:none |
| SIDEBAR-CSS-02 | PASS | `sidebar.css:257-270` — fixed 32px no collapsed mobile |

**Spec-precision gaps:** 2 found and corrected during verification:
1. **SIDEBAR-BE-04**: descrição original dizia "todos os 10 nav-ids" sem mencionar `navContracts` (visível sem role gating)
2. **SIDEBAR-BE-05**: descrição original dizia "todos exceto contratos" — na realidade `navContracts` não tem role gating e fica visível para todos os cargos; suporte vê os mesmos 10 itens controlados que admin

---

## Discrimination Sensor

No tests exist for this module (documentation-only spec). Sensor not applicable — code is deployed and in production, not being modified.

**Verdict**: SKIP (spec is documentation of existing deployed code, not implementation)

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total ACs | 22 |
| PASS | 22 |
| FAIL | 0 |
| Spec-precision gaps found & corrected | 2 |
| Diff range | `.specs/features/sidebar/spec.md` — SIDEBAR-BE-04, SIDEBAR-BE-05<br>`.specs/features/sidebar/design.md` — visibility matrix, integration points, page count |

---

## Additional Findings Beyond ACs

1. ~~**contratos.html init incompleto**: carrega apenas `load-sidebar.js` via script tag, sem `initSidebar()`.~~ **RESOLVIDO** — commit `4cd3491` migrou para `layout.js`; commit `bb7b27b` adicionou `dashboard.css` (grid necessário para o layout da sidebar).
2. **core/ui/sidebar.js** exporta `toggleSubmenu()` (linhas 91-104) que nunca é importada pelo módulo sidebar — código morto.

---

## Verdict

**PASS** — spec e design refletem com precisão o código implantado após correções. 22/22 ACs verificados.
