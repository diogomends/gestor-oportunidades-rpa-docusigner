# KPIs — Plano de Tasks

## Execution Protocol
Implementação de especificações e componentes segundo o padrão `tlc-spec-driven` e regras de integridade do projeto.

---

**Spec**: `.specs/features/kpis/spec.md`  
**Status**: Done (Concluído)

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Spec | spec-verification | 1:1 alinhamento com especificações do projeto | `.specs/features/kpis/spec.md` | Inspeção visual / markdown lint |
| Frontend HTML | e2e / DOM | Estrutura `#kpisSection`, `#btnToggleKpis`, `#kpiGridContainer` presentes e intactas | `public/dashboard.html` | `make test-e2e-headless` |
| Frontend JS | unit / integration | Função `window.toggleKpisSection` manipula visibilidade e ícones/tooltips corretamente | `public/js/pages/dashboard.js` | `npm test` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| E2E / Playwright | Yes | Instância isolada do navegador Chromium | `tests/e2e/` |
| Node Native Unit | Yes | Testes isolados com mocks | `tests/` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após edições de scripts JS | `npm test` |
| Full | Após alterações na estrutura HTML/DOM | `make test-e2e-headless` |
| Build | Após conclusão completa da task | `npm start` |

---

## Task Breakdown

### T1: Especificar Wrapper da Seção de KPIs em `.specs/` [Done]

**What**: Definir no arquivo de especificação o wrapper `.glass-panel` com ID `#kpisSection`, cabeçalho flex e controle de alternância.  
**Where**: `.specs/features/kpis/spec.md`  
**Depends on**: None  
**Requirement**: [KPI-WRAP-01]  

**Done when**:
- [x] Contrato visual e estrutural do wrapper documentado.
- [x] Estrutura HTML e parâmetros do toggle registrados.
- [x] Documentado em pt-BR.

---

### T2: Estruturar HTML do Wrapper e Cabeçalho dos KPIs em `public/dashboard.html` [Done]

**What**: Envolver a grade de KPIs com o container `#kpisSection`, adicionar cabeçalho flex ("Métricas e KPIs", ícone `ph-chart-bar`, botão `#btnToggleKpis`) e container `#kpiGridContainer`.  
**Where**: `public/dashboard.html`  
**Depends on**: T1  
**Requirement**: [KPI-WRAP-02]  

**Done when**:
- [x] ID `#kpisSection` adicionado ao `.glass-panel`.
- [x] Cabeçalho flex com ícone `ph-chart-bar` e título "Métricas e KPIs" criado.
- [x] Botão `#btnToggleKpis` chamando `toggleKpisSection()` adicionado.
- [x] Div `#kpiGridContainer` envolvendo os 9 cards sem alterar seus IDs ou classes.

---

### T3: Implementar a Lógica de Toggle em `public/js/pages/dashboard.js` [Done]

**What**: Criar a função global `window.toggleKpisSection` para alternar visibilidade, ícone e tooltip do botão.  
**Where**: `public/js/pages/dashboard.js`  
**Depends on**: T2  
**Requirement**: [KPI-WRAP-03]  

**Done when**:
- [x] Função `window.toggleKpisSection` declarada com JSDoc em pt-BR.
- [x] Alternância do display de `#kpiGridContainer` entre `'flex'` e `'none'`.
- [x] Atualização dinâmica das classes do ícone (`ph-caret-up` / `ph-caret-down`).
- [x] Atualização dinâmica do `title` ("Recolher KPIs" / "Expandir KPIs").

---

### T4: Validação de Escopo e Regressão DOM [Done]

**What**: Garantir que nenhum card de KPI, seletor CSS ou componente da Tabela de Atenção foi afetado.  
**Where**: `public/dashboard.html`, `public/css/dashboard.css`  
**Depends on**: T3  
**Requirement**: [KPI-WRAP-04]  

**Done when**:
- [x] Todos os 9 cards de KPIs continuam funcionando perfeitamente.
- [x] Nenhuma função legada foi desativada.

---

### T5: Layout Flex para Cards com Largura Dinâmica [Done]

**What**: Alterar `.kpi-grid` de CSS Grid para Flexbox, permitindo que os cards se ajustem ao comprimento do texto com `width: fit-content`.  
**Where**: `public/css/dashboard.css`, `public/js/pages/dashboard.js`, `.specs/features/kpis/spec.md`  
**Depends on**: T4  
**Requirement**: [KPI-LAYOUT-01]  

**Done when**:
- [x] `.kpi-grid` utiliza `display: flex; flex-wrap: wrap`.
- [x] `.kpi-card` possui `width: fit-content; min-width: 180px`.
- [x] Toggle `window.toggleKpisSection` usa `"flex"` em vez de `"grid"`.
- [x] Spec atualizado para refletir novo layout flex.
