# Stepper 6 — Dashboard de Contratos DocuSign — Specification

## Problem Statement

Atualmente, o painel centralizado de contratos DocuSign (`dashboard-contratos-docusigner.html`) é acessado através de um link avulso no menu da sidebar (`#navContractsDashboardItem`). O fluxo de contratação em `contratos.html` possui 5 etapas no stepper. Desejamos incorporar os elementos, modais e inteligência do Dashboard de Contratos como a 6ª Etapa do Stepper em `contratos.html`, removendo a rota avulsa e o item `#navContractsDashboardItem` da sidebar.

## Goals

1. Adicionar o Stepper Step 6 ("Contratos DocuSign", "Gestão e Anexos") e sua respectiva `<div class="page-container" id="page-dashboard">` em `public/modules/contratos/contratos.html`.
2. Mover a interface do dashboard (barra de busca, contêiner de cards, modal de confirmação de exclusão e modal de visualização de arquivos com PDF.js e overlay anti-cópia) para dentro de `contratos.html`.
3. Atualizar a lógica de navegação em `public/modules/contratos/navigation.js` e `contratos.js` para dar suporte a 6 etapas e carregar os contratos ao ativar a Etapa 6.
4. Remover o item `#navContractsDashboardItem` do arquivo `public/modules/sidebar/sidebar.html` e das definições de cargos em `public/js/core/ui/sidebar.js`.
5. Manter retrocompatibilidade com todas as regras de segurança e ACLs (Vendedor sem download/view/delete, Suporte com view em PDF.js/canvas sem download/delete, Admin com todas as permissões e confirmação em modal).

## Out of Scope

- Alteração das regras de backend (as APIs `/api/contracts/*` de ACL e servir arquivos continuam exatamente como estão).

---

## User Stories & Acceptance Criteria

### P1: Stepper 6 no Módulo de Contratos

**User Story:** Como usuário (vendedor, suporte ou admin), quero visualizar o Dashboard de Contratos DocuSign diretamente como a 6ª etapa do fluxo de contratos no stepper.

**Acceptance Criteria:**

1. **STEPPER6-01**: `contratos.html` deve ter o indicador da etapa 6 no stepper com título `Contratos DocuSign` e subtítulo `Gestão e Anexos`.
2. **STEPPER6-02**: Ao clicar no stepper 6 ou navegar até ele, a `<div class="page-container" id="page-dashboard">` deve ser exibida e os dados dos contratos devem ser carregados via API.
3. **STEPPER6-03**: A barra de busca por Razão Social/CNPJ, a listagem de cards com anexos e os modais de visualização/deleção devem funcionar idênticos ao dashboard original.

### P1: Remoção do Item da Sidebar

**User Story:** Como usuário do sistema, não devo ver o item redundante `Contratos DocuSign` no submenu da sidebar, pois ele agora é a 6ª etapa do fluxo de contratos.

**Acceptance Criteria:**

4. **STEPPER6-04**: O elemento `#navContractsDashboardItem` deve ser removido de `sidebar.html`.
5. **STEPPER6-05**: As referências a `"navContractsDashboardItem"` em `sidebar.js` devem ser limpas de todos os perfis de acesso.

---

### P2: Melhorias no Card do Step 06

**User Story:** Como usuário (vendedor, suporte, supervisor, coordenador ou admin), quero visualizar os contratos em cards em grid, com filtros por cargo, ordenação, alerta de pendência de 72h e acesso rápido aos dados da oportunidade.

**Acceptance Criteria:**

6. **STEPPER6-06**: Cards devem ser exibidos em grid de 2 colunas em telas ≥ 768px e 1 coluna em < 768px. Cada card ocupa altura variável conforme o conteúdo.
7. **STEPPER6-07**: Hash do contrato removido do card. Data/hora de criação mantida como texto secundário na coluna da direita.
8. **STEPPER6-08**: Nome do cliente é um link que abre `dashboard.html?view=<opportunityId>` em nova aba. Se não houver oportunidade vinculada, abre `dashboard.html` sem view param.
9. **STEPPER6-09**: Documentos anexos agrupados em duas seções: "Gerados" (termo, proposta, permanência, assinado) e "Documentos do Cliente" (RG, CCMEI, comprovante, etc).
10. **STEPPER6-10**: Botão de download de anexo mantém funcionalidade, com fundo transparente igual aos demais action buttons (view, delete).
11. **STEPPER6-11**: Contratos com status "enviado" há mais de 72h sem assinatura exibem badge laranja "Pendente (+72h)".
12. **STEPPER6-12**: Barra de filtros com toggle (ícone funnel) contendo: Status (select), Data início/fim (date range), Ordenação (data recente/antigo, nome A-Z/Z-A), Vendedor, Supervisor e Coordenador — com visibilidade controlada por cargo (admin/suporte vê todos, coordenador vê vendedor+supervisor, supervisor vê vendedor, vendedor vê apenas status+período+ordenação).
13. **STEPPER6-13**: Busca por Razão Social/CNPJ na barra de pesquisa existente aplica-se em conjunto com os filtros ativos.

---

### P3: Refatoração Visual dos Cards Step 6

**User Story:** Como usuário, quero um card mais limpo: sem títulos de seção de documentos, com ações dos anexos acessíveis via modal ao clicar no item, e com informações reorganizadas em duas linhas no topo.

**Acceptance Criteria:**

14. **STEPPER6-14**: Os textos "DOCUMENTOS", "GERADOS" e "DOCUMENTOS DO CLIENTE" devem ser removidos do card.
15. **STEPPER6-15**: `.attachment-item.present` não deve exibir os botões de ação (view/download/delete) diretamente. Ao clicar no item, um modal deve ser aberto com as ações disponíveis conforme ACL do usuário.
16. **STEPPER6-16**: `.card-top` deve conter uma única linha com: nome do cliente (link), CNPJ/documento, `status-badge` e `card-date`.
17. **STEPPER6-17**: `.client-line` (número de linhas) deve ficar na segunda linha do card, ao lado do `plan-box`.
18. **STEPPER6-18**: Extensão `.pdf` removida da exibição do nome dos anexos em `.attachment-info`.
19. **STEPPER6-19**: Texto dos anexos com `padding-right` para não colar na borda do item.
20. **STEPPER6-20**: Padding horizontal do `.contract-card` reduzido e gap do grid (`cards-container`) diminuído para aproximar elementos das bordas.

---

## Requirement Traceability

| ID | História | AC | Status |
| -- | -------- | -- | ------ |
| STEPPER6-01 | Stepper UI | Adição do step 6 no HTML do Stepper | Completed |
| STEPPER6-02 | Navegação | Navegação para etapa 6 e carregamento | Completed |
| STEPPER6-03 | Dashboard UI | Barra de busca, cards e modais em contratos.html | Completed |
| STEPPER6-04 | Sidebar HTML | Remoção de `#navContractsDashboardItem` | Completed |
| STEPPER6-05 | Sidebar JS | Remoção de `navContractsDashboardItem` dos papéis | Completed |
| STEPPER6-06 | Card melhorias | Grid 2 colunas + layout responsivo | Completed |
| STEPPER6-07 | Card melhorias | Hash removido, data/hora realocada | Completed |
| STEPPER6-08 | Card melhorias | Nome cliente como link para oportunidade | Completed |
| STEPPER6-09 | Card melhorias | Documentos agrupados por tipo | Completed |
| STEPPER6-10 | Card melhorias | Download button com bg transparente | Completed |
| STEPPER6-11 | Card melhorias | Badge alerta 72h | Completed |
| STEPPER6-12 | Card melhorias | Filtros com visibilidade por cargo | Completed |
| STEPPER6-13 | Card melhorias | Busca + filtros combinados | Completed |
| STEPPER6-14 | Card refatoração | Remover títulos "DOCUMENTOS", "GERADOS", "DOCUMENTOS DO CLIENTE" | Completed |
| STEPPER6-15 | Card refatoração | Ações de anexo em modal ao clicar no item | Completed |
| STEPPER6-16 | Card refatoração | card-top com nome + documento + status + data em linha única | Completed |
| STEPPER6-17 | Card refatoração | client-line + plan-box na segunda linha | Completed |
| STEPPER6-18 | Card refatoração | Extensão `.pdf` removida dos nomes dos anexos | Completed |
| STEPPER6-19 | Card refatoração | Padding-right nos textos dos anexos | Completed |
| STEPPER6-20 | Card refatoração | Padding do card e gap do grid reduzidos | Completed |
