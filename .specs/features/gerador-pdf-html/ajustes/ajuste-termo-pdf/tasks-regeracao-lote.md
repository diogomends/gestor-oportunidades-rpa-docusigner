# Tasks: Regeração de PDFs de Contratos em Lote (`tasks-regeracao-lote`)

## Phase 1: Script de Regeração em Lote
- [x] **Task 1: Criar o script `src/scripts/regenerate-contract-pdfs.js`**
  - Mapear a conexão Mongoose com `crm_contracts`.
  - Buscar contratos elegíveis (`status: { $in: ["rascunho", "gerado"] }`).
  - Iterar cada contrato e construir o payload `data` a partir de `client` e `negotiation`.
  - Invocar `geradorPdfHtmlService.generateContractPDF` para `termo`, `proposta` e `permanencia`.
  - Sobrescrever arquivos com `storageService.saveFile` e atualizar `generatedAt` no banco.
  - Exibir tabela de resultados formatada no final.
  - *Verification*: Executar `node src/scripts/regenerate-contract-pdfs.js` em ambiente local e verificar que os PDFs em `uploads/` são atualizados e a tabela de resumo é exibida.

## Phase 2: Automação no Makefile
- [x] **Task 2: Adicionar os targets no `Makefile`**
  - Adicionar `regenerate-contract-pdfs: node src/scripts/regenerate-contract-pdfs.js`.
  - Adicionar `regenerate-contract-pdfs-prod` com comandos SSH/SCP/Docker para execução no servidor de produção.
  - Adicionar os targets à seção `.PHONY` e ao menu de `help`.
  - *Verification*: Executar `make help` e verificar a listagem dos novos comandos.

## Phase 3: Validação & Commit
- [x] **Task 3: Executar a regeração local e validar o resultado**
  - Executar `make regenerate-contract-pdfs` para testar no ambiente local.
  - Verificar visualmente um dos PDFs atualizados.
  - *Verification*: `git status` e commit com PR + merge no fluxo do projeto.
