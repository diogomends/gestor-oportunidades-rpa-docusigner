# Exclusão de Card de Contrato e Limpeza de Dados do Servidor — Specification

## Problem Statement

Atualmente, na etapa 6 do Stepper (`contratos.html`), os administradores possuem apenas a opção de visualizar ou remover anexos individuais dos contratos, mas não há um mecanismo direto na interface para excluir um card de contrato completo e purgar seus dados e arquivos do servidor quando necessário.

## Goals

1. Adicionar um botão de exclusão de contrato (ícone de lixeira) no topo de cada card (`.card-top`) em `public/modules/contratos/contratos.html`, visível apenas para administradores (`admin` / permissão `contracts:delete`).
2. Criar um modal de confirmação de segurança (`#deleteCardConfirmModal`) que exibe um aviso detalhado dos dados que serão excluídos e exige que o administrador digite o CNPJ do cliente para habilitar a confirmação.
3. Garantir que a requisição de exclusão purge o documento de `Contract`, o documento de `DocusignEnvelope` e todos os arquivos físicos em disco associados (`documents`, `signedDocPath`, `clientDocs`), mantendo a `Opportunity` intacta.
4. Remover o card da interface DOM imediatamente após a exclusão e recarregar os dados silenciosamente via `loadContracts()`.
5. Registrar a regra de permissão no módulo de controle de acesso (`modulo-controle-acesso-acl-rbac`).

## Out of Scope

- Deleção da Oportunidade vinculada (`Opportunity`). Ela deve permanecer inalterada no CRM.
- Deleção de envelopes no servidor externo da DocuSign (DocuSign Cloud API).

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Confirmação de exclusão | Digitação do CNPJ do cliente | Previne exclusões acidentais de contratos inteiros por administradores | Sim |
| Vínculo Opportunity | Mantida intacta | Oportunidade pertence ao funil de vendas e deve manter histórico comercial | Sim |
| Permissão de acesso | Restrito ao cargo `admin` / `contracts:delete` | Operação destrutiva que afeta arquivos físicos e banco de dados | Sim |

---

## User Stories

### P1: Botão de Exclusão do Card e Modal de Confirmação por CNPJ ⭐ MVP

**User Story**: Como Administrador do sistema, quero um botão de lixeira no topo de cada card de contrato e um modal de confirmação com validação de CNPJ para que eu possa excluir permanentemente um contrato e seus arquivos físicos do servidor de forma segura.

**Acceptance Criteria**:

1. **CARD-DEL-01**: WHEN o usuário logado for `admin` (possuir permissão `contracts:delete`), THEN o sistema SHALL exibir o botão de exclusão (ícone `ph-trash`) no topo do card (`.card-top`).
2. **CARD-DEL-02**: WHEN o usuário logado NÃO for `admin`, THEN o sistema SHALL ocultar o botão de exclusão do card no frontend.
3. **CARD-DEL-03**: WHEN o administrador clica no botão de exclusão do card, THEN o sistema SHALL abrir o modal `#deleteCardConfirmModal` contendo:
   - Aviso explicativo: "Esta ação excluirá permanentemente o registro do contrato, o envelope DocuSign e todos os arquivos físicos anexos do servidor. A oportunidade vinculada será mantida."
   - Campo de entrada de texto (`#deleteCardCnpjInput`) solicitando a digitação do CNPJ do cliente.
   - Botão "Excluir Definitivamente" desabilitado por padrão.
4. **CARD-DEL-04**: WHEN o CNPJ digitado pelo administrador no input corresponder ao CNPJ do contrato (comparação ignorando formatação/pontuação), THEN o sistema SHALL habilitar o botão "Excluir Definitivamente".
5. **CARD-DEL-05**: WHEN o administrador confirma a exclusão clicando em "Excluir Definitivamente", THEN o sistema SHALL disparar uma requisição `DELETE /api/contracts/:id`.
6. **CARD-DEL-06**: WHEN a API de deleção de contrato processa a requisição `DELETE /api/contracts/:id`, THEN o backend SHALL:
   - Remover o documento `Contract` da collection `contracts`.
   - Remover o documento `DocusignEnvelope` associado da collection `docusign_envelopes`.
   - Remover todos os arquivos físicos associados (`documents`, `signedDocPath`, `clientDocs`) do disco via `storageService.deleteFile`.
   - Manter o documento `Opportunity` intacto.
7. **CARD-DEL-07**: WHEN a API retorna HTTP 200 de sucesso, THEN o frontend SHALL fechar o modal, exibir um toast de sucesso, remover o elemento `.contract-card` do DOM com transição suave e chamar `loadContracts()` silenciosamente.

---

## Edge Cases

- **CNPJ com ou sem pontuação**: A validação no modal deve aceitar a comparação limpa (somente dígitos) para evitar bloqueio por formatação de máscara.
- **Arquivo físico inexistente no disco**: Se algum arquivo físico já não existir em disco, a API de exclusão deve ignorar o erro de arquivo e prosseguir com a exclusão dos registros no banco sem falhar.
- **Requisição sem permissão no backend**: Se um usuário não-admin forçar uma requisição `DELETE /api/contracts/:id`, a API deve retornar HTTP 403 Forbidden.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CARD-DEL-01 | P1: Botão no Card | Implemented | Done |
| CARD-DEL-02 | P1: Restrição ACL Frontend | Implemented | Done |
| CARD-DEL-03 | P1: Modal de Aviso e Entrada de CNPJ | Implemented | Done |
| CARD-DEL-04 | P1: Validação de Digitação de CNPJ | Implemented | Done |
| CARD-DEL-05 | P1: Disparo da API DELETE | Implemented | Done |
| CARD-DEL-06 | P1: Limpeza Backend (DB + Disco) | Implemented | Done |
| CARD-DEL-07 | P1: Atualização DOM e Feedback | Implemented | Done |

---

## Success Criteria

- [x] Administrador consegue excluir um contrato completo digitando o CNPJ correto no modal de confirmação.
- [x] Todos os arquivos anexos em disco referentes ao contrato são purgados.
- [x] Registros em `contracts` e `docusign_envelopes` são apagados do MongoDB.
- [x] A oportunidade vinculada no CRM permanece inalterada.
- [x] Vendedores e suporte não visualizam o botão de exclusão de card.
