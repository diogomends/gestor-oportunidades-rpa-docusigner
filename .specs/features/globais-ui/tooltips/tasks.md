# Tooltips Padronizadas — Tasks

## Tarefas

- [x] **T1**: Migrar módulo de comissions (`.help-icon` / `.popover-text` → `.tooltip-container` / `.tooltip-text`)
  - Arquivos: `public/modules/commissions/css/styles.css`, `public/modules/commissions/js/views/CampaignModal.js`
  - Remover CSS deprecado (linhas 110-186)
  - Remover handler JS de toggle `.active`

- [x] **T2**: Migrar módulo de ACL (`data-bs-toggle="tooltip"` → `.tooltip-container`)
  - Arquivo: `public/modules/acl/controle-acessos.js`
  - Substituir HTML gerado (linha 175)
  - Remover bloco de inicialização Bootstrap Tooltip (linhas 207-212)

- [x] **T3**: Migrar dashboard render-table (`td.title` → `.tooltip-container` onde aplicável)
  - Arquivo: `public/js/features/dashboard/ui/render-table.js`
  - Decisão: Mantido `title` nativo do HTML para células truncadas e ações para UX otimizada em tabelas.

- [x] **T4**: Garantir que `style.css` está completo (já tem o padrão base)
  - Decisão: Mantido posicionamento superior padrão em `style.css` (princípio YAGNI).

## Notas

- T4 mantido apenas com posicionamento superior padrão (YAGNI).
- T3 mantido com `title` nativo do HTML para células truncadas.

