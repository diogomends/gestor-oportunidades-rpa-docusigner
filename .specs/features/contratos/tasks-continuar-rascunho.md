# Especificação de Tarefas — Botão "Continuar" (Edição de Rascunho / Gerado)

Este documento contém a divisão em tarefas atômicas para a implementação da funcionalidade de **Continuar / Editar Contrato** nos status `rascunho` e `gerado`.

---

## 📋 Checklist de Regras de Negócio

1. **Status com botão "Continuar":** `rascunho` e `gerado` (ambos editáveis).
2. **Localização no Dashboard:** No card do contrato, ao lado de "Vincular Oportunidade".
3. **Fluxo de Navegação Inicial:** Direto para a **Etapa 1 (Dados do Cliente)** preenchida.
4. **Sobrescrita de PDFs:** Regerar e sobrescrever os mesmos arquivos via `updateContract` (`PUT`).
5. **Negociação Completa:** Recarregar 100% de ofertas, combos, portabilidade e aparelhos.
6. **Editabilidade:** Todos os campos editáveis (CNPJ, cliente, negociação).
7. **Permissões (ACL):** Criador do contrato + Usuários com perfil `admin` ou `suporte`.
8. **Manutenção de Status:** Permanece `rascunho` após salvar até ser enviado via DocuSign.
9. **Preservação de Dados:** Anexos de documentos (`clientDocs`) e `opportunityId` mantidos intactos.
10. **Próximo Passo Pós-Salvar:** Navegar direto para a **Etapa 4 (DocuSign)**.

---

## 🧩 Divisão de Tarefas (Atomic Tasks)

### Fase 1: Modelo & Backend (Schema, Collector & API)

#### T-01: Expansão do Schema Mongoose (`Contract.js`) e Collector (`contractFormCollector.js`)
- [ ] **Descrição**: Adicionar os 8 campos adicionais do formulário de cliente ao schema `Contract.js` e atualizar a coleta em `contractFormCollector.js`.
- [ ] **Campos a adicionar em `client`**:
  - `dataFundacao` (cli-fundacao)
  - `capitalSocial` (cli-capital)
  - `pontoReferencia` (cli-referencia)
  - `pontoReferenciaEntrega` (cli-ref-entrega)
  - `observacoes` (cli-observacoes)
  - `dataAssinatura` (cli-data-assinatura)
  - `diaVencimento` (cli-vencimento)
  - `tipoFatura` (cli-tipo-fatura)
  - `socios[].orgao` (socio-orgao)
  - `recebedor` (`receb-nome`, `receb-rg`, `receb-orgao`, `receb-cpf`, `receb-telefone`)
  - `tokenInfo` (`token-login`, `token-nome-tbp`, `token-cnpj-tbp`)
- [x] **Critérios de Aceitação**:
  - Schema Mongoose inclui os novos campos no submódulo `client` e `tokenInfo`.
  - `contractFormCollector.js` captura e inclui esses campos no JSON `contractData`.
  - Preservar `opportunityId` e `clientDocs` intactos durante o update em `contractService.js`.
- [x] **Verificação**: Inspecionar um contrato salvo e confirmar a presença dos novos campos no MongoDB.

#### T-02: Métodos de API no Frontend (`api.js`) e ACL no Controller Backend
- [ ] **Descrição**: Implementar `getContractById(id)` e `updateContract(id, contractData, pdfBlobs, folderPrefix)` em `public/js/modules/contracts/api.js`.
- [ ] **Critérios de Aceitação**:
  - `getContractById(id)` executa `GET /api/contracts/:id`.
  - `updateContract(...)` executa `PUT /api/contracts/:id` enviando `FormData` com `contractData` e PDFs (mirror do `createContract`).
  - Controller backend em `contractController.js` autoriza a alteração apenas para o criador do contrato ou perfis `admin`/`suporte`.
  - Preserva status `rascunho`.
- [ ] **Verificação**: Chamar `updateContract` via DevTools e verificar retorno HTTP 200 com contrato atualizado.

---

### Fase 2: Frontend Service de Recomposição

#### T-03: Serviço de Prefill de Formulário (`contractResumeService.js`)
- [x] **Descrição**: Criar/atualizar `public/js/modules/contracts/services/contractResumeService.js` com a lógica de restaurar dados do contrato no formulário HTML e fallbacks para contratos legados.
- [x] **Critérios de Aceitação**:
  - Executa `OfferStore.clear()` para evitar resíduos de sessão.
  - Preenche todos os inputs da Etapa 1 (cliente, admin, representante, sócios, testemunhas, recebedor e os campos de rodapé).
  - Preenche `cli-capital` e `socio-orgao`.
  - Preenche `recebedor` com fallback para dados do Administrador caso nulo em contrato legado.
  - Preenche `tokenInfo` com fallback para `resolveTokenForForm()` (resolução UF/DDD) em contrato legado.
  - Recompõe a Etapa 2 (ofertas, combos, aparelhos, portabilidade) chamando `OfferStore.addOferta(...)`.
  - Aplica máscaras de formatação (CNPJ, CPF, CEP, Telefones).
  - Define `contractMediator.editingContractId = contractId`.
  - Atualiza o Stepper UI indicando Etapa 1 ativa e navega para `page-cliente`.
  - Trata falha no carregamento (exibe Toast de erro em caso de HTTP 403/404).
- [x] **Verificação**: Invocação manual `window.contractResume.prefill(id)` popula o formulário completamente e direciona para a Etapa 1.

---

### Fase 3: Mediação do Fluxo e Registro

#### T-04: Ajustes no `contractMediator.js` e `contratos.html`
- [ ] **Descrição**: Adaptar o mediador de contratos para alternar entre criação (`POST`) e atualização (`PUT`) e registrar o novo service.
- [ ] **Critérios de Aceitação**:
  - Em `generateAllContracts`: se `editingContractId` estiver definido, executa `api.updateContract` e sobrescreve os PDFs.
  - Após salvar com sucesso via `PUT`, redefine `editingContractId = null` e navega direto para a **Etapa 4 (DocuSign)**.
  - Redefine `editingContractId = null` ao clicar em "Novo Contrato" ou "Limpar Formulário".
  - Incluir a tag `<script type="module" src=".../contractResumeService.js">` em `contratos.html`.
- [ ] **Verificação**: Ao editar um rascunho e clicar em "BAIXAR PDFs", a requisição enviada é `PUT` e a tela resultante é a Etapa 4 (DocuSign).

---

### Fase 4: Dashboard & Eventos UI

#### T-05: Renderização do Botão "Continuar" nos Cards e Handler de Eventos
- [ ] **Descrição**: Adicionar o botão "Continuar" nos cards do dashboard e vincular o evento de clique.
- [ ] **Critérios de Aceitação**:
  - Em `dashboard/render/render-contracts.js`: Renderizar botão `.btn-continue-contract` ao lado de "Vincular Oportunidade" apenas para contratos com status `rascunho` ou `gerado`.
  - Botão visível apenas se o usuário atual for o criador do contrato ou possuir perfil `admin`/`suporte`.
  - Em `dashboard/events/setup-dynamic-button-events.js`: Capturar clique em `.btn-continue-contract`, buscar o contrato por ID e acionar `window.contractResume.prefill(contractId)`.
- [ ] **Verificação**: Abrir o dashboard, localizar um card de rascunho, clicar em "Continuar" e validar o redirecionamento imediato para a Etapa 1 preenchida.
