# Design Técnico: Módulo de Controle de Acessos (ACL & RBAC UI)

**Feature:** `modulo-controle-acesso-acl-rbac`  
**Data:** 2026-07-21  

---

## 1. Arquitetura do Banco de Dados (`crm_acl`)

O módulo utilizará a conexão secundária no MongoDB apontando para o database `crm_acl` (na mesma instância `MONGO_URI` de produção/dev na porta 27017, usando `useDb("crm_acl")` no Mongoose).

### Schema `RolePermission`
```javascript
import mongoose from 'mongoose';
import { getAclDb } from '../../../config/database.js';

const rolePermissionSchema = new mongoose.Schema({
  role: { type: String, required: true, unique: true }, // admin, suporte, coordenador, supervisor, vendedor
  permissions: [{ type: String }], // Ex: ['contracts:view', 'opportunities:create']
  updatedAt: { type: Date, default: Date.now }
});

export const getRolePermissionModel = () => {
  const db = getAclDb();
  return db.model('RolePermission', rolePermissionSchema, 'role_permissions');
};
```

---

## 2. Estrutura do Módulo

```
src/
├── config/
│   └── database.js               # Adicionada função getAclDb() usando mongoose.connection.useDb('crm_acl')
├── modules/
│   └── acl/
│       ├── config/
│       │   └── modulesPermissions.js # Árvore oficial de Módulos e Funcionalidades do CRM
│       ├── models/
│       │   └── RolePermission.js      # Modelo Mongoose no database crm_acl
│       ├── services/
│       │   └── aclService.js          # Leitura/Escrita da matriz e verificação de permissão
│       ├── controllers/
│       │   └── aclController.js       # Endpoints GET /matrix, PUT /roles/:role/permissions
│       ├── middlewares/
│       │   └── authorizePermission.js # Middleware Express para checagem por rota + AuditLog
│       ├── routes/
│       │   └── aclRoutes.js          # Montagem das rotas /api/acl/*
│       └── tests/
│           ├── aclService.test.js
│           └── aclController.test.js
public/
├── modules/
│   └── acl/
│       ├── controle-acessos.html     # Layout HTML da tabela de permissões e modal de confirmação
│       └── controle-acessos.js       # Lógica JS de renderização, manipuladores de evento e chamadas API
└── js/
    └── core/
        └── ui/
            └── sidebar.js             # Atualizado para exibir item "Controle de Acessos" apenas para admin
```

---

## 3. Árvore Oficial de Módulos e Funcionalidades (`modulesPermissions.js`)

```javascript
export const MODULES_PERMISSIONS = [
  {
    module: 'Contratos',
    actions: [
      { key: 'contracts:view', label: 'Visualizar Contratos' },
      { key: 'contracts:download', label: 'Baixar Anexos' },
      { key: 'contracts:delete', label: 'Excluir Contratos/Anexos' },
      { key: 'contracts:upload', label: 'Enviar Anexos' },
      { key: 'contracts:docusign', label: 'Enviar para DocuSign' },
      { key: 'contracts:docusign_resend', label: 'Reenviar para DocuSign' }
    ]
  },
  {
    module: 'Oportunidades',
    actions: [
      { key: 'opportunities:view', label: 'Visualizar Oportunidades' },
      { key: 'opportunities:create', label: 'Criar Oportunidade' },
      { key: 'opportunities:edit', label: 'Editar Oportunidade' }
    ]
  },
  {
    module: 'Equipes',
    actions: [
      { key: 'teams:view', label: 'Visualizar Filtro de Equipes' }
    ]
  },
  {
    module: 'Relatórios',
    actions: [
      { key: 'reports:view', label: 'Visualizar Relatórios Pós-SMB' }
    ]
  }
];
```

---

## 4. Design do Modal de Confirmação Bootstrap

Estrutura HTML do modal em `controle-acessos.html`:

```html
<div class="modal fade" id="confirmPermissionModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Confirmar Alteração de Permissão</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <p id="confirmPermissionMessage">Deseja alterar a permissão?</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btnCancelPermission" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-primary" id="btnConfirmPermission">Confirmar</button>
      </div>
    </div>
  </div>
</div>
```
