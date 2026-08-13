# Spec: E2E Test Suite — Gestor Oportunidades

**Feature:** `e2e-test-suite`  
**Tipo:** Test specification (documenta critérios cobertos por todos os testes E2E e unitários)  
**Status:** Active — adicionar novos testes aqui conforme criados  
**Pasta de testes:** `tests/e2e/*.spec.js`, `tests/*.test.js`  
**Comandos:** `make test-e2e` / `make test-e2e-headed` / `make test-e2e-headless` / `make test-e2e-ui` / `make test-contracts` / `make test-contracts-headless` / `make test-upload-inspect` / `make inspect-state` / `make docusign-hmac` / `make test-unit` / `make test-date-filters` / `make clean-contracts` / `make clean-test-contract` / `make clean-uploads` / `make populate-vtme` / `make install-deps` / `make dev` / `make up-dev` / `make down` / `make reset` / `make tunnel` / `make query-contracts` / `make query-offers` / `make db-and-collection`

---

## Testes Registrados

| Spec File | Feature Testada | ACs | Status |
|-----------|-----------------|-----|--------|
| `contratos.spec.js` | Fluxo completo Contratos parametrizado (4 tipos: MEI, LTDA, S.A., EIRELI) — Login → 4 páginas → PDFs → DocuSign → email | AC-01 a AC-18 | ✅ Passing |
| `upload-inspect.spec.js` | Inserção de contrato via API, verificação de dados no DB, upload de client docs (RG + Contrato Social) via client-server e inspeção da estrutura física de uploads | I-01 a I-09 | ✅ Passing |
| `navbar.spec.js` | Topnav e Drawer Sidebar — renderização DOM, alternância via toggle, fechamento por backdrop/ESC, atributos ARIA, viewport mobile | NAV-01 a NAV-08 | ✅ Passing |
| `inspect-state.js` | Script de inspeção: exibe árvore de uploads + dados do DB correlacionados | CLI tool | ✅ Criado |
| `docusign-hmac-fetcher.js` | Obtém/atualiza a HMAC Key do DocuSign via API | CLI tool | ✅ Criado |
| `test-date-filters.js` (em `src/scripts/`) | Teste manual de filtros de data com timezone-awareness | DF-01 a DF-09 | ✅ Criado |
| `clean-uploads.ps1` | Limpa referências no MongoDB + arquivos de upload no servidor de produção via SSH | CLI tool | ✅ Criado |
| `populate-offers.test.js` | Carga de ofertas VTME/Easy Vendas — atualiza e insere ofertas no DB | PO-01 a PO-05 | ✅ Passing |
| `static-files.test.js` | Entrega de arquivos JS estáticos do frontend | SF-01 a SF-03 | ✅ Passing |
| `docusign-ltda-prod.spec.js` | Fluxo E2E de envio via Robot-DocuSign para 1 contrato LTDA (MATANZA LTDA, email diogomends+docusigner@gmail.com, non-headless, validações de dados e indisponibilidade) | DL-01 a DL-08 | 📋 Planned |

> **Convenção:** Cada spec ou teste registrado ganha uma seção abaixo com seus ACs, ADRs e gaps.

---

## Acceptance Criteria — contratos.spec.js

| ID | Critério | Coberto pelo teste |
|----|----------|-------------------|
| AC-01 | Login com credenciais válidas obtém token JWT e acessa `/modules/contratos/contratos.html` | ✅ `test.beforeEach` |
| AC-02 | Page 1 (Dados do Cliente): preenche campos obrigatórios (CNPJ, razão social, fundação, capital, endereço via CEP, admin, representante, sócio, recebimento, testemunhas, conclusão) e avança | ✅ Page 1 blocos |
| AC-03 | Botões "COPIAR DO ADMINISTRADOR" replicam dados para Representante, Sócio, Recebimento — incluindo `socio-orgao` | ✅ clicks + assert |
| AC-04 | Page 2 (Negociação): preenche acessos, tipo contratação, perfil, DDD, plano, oferta, valor mensal e avança | ✅ Page 2 blocos |
| AC-05 | Page 3 (Resumo): exibe resumo preenchido; clica **BAIXAR PDFs** → dispara `POST /api/contracts` multipart com 3 PDFs; recebe `contractId` | ✅ `waitForResponse /api/contracts` + `contractId` capturado |
| AC-06 | Modal de sucesso aparece; botões individuais (Termo, Proposta, Permanência) mostram "Gerado!" | ✅ `#modal-success` + 3 botões |
| AC-07 | Avança para Page 4 (DocuSign); dados do signatário (nome, email, CPF) preenchidos readonly | ✅ `#ds-nome`, `#ds-email`, `#ds-cpf` not empty |
| AC-08 | Clica **ENVIAR PARA DOCUSIGN** → dispara `POST /api/docusign/send/:contractId` | ✅ `waitForResponse /docusign/send/:id` |
| AC-09 | Se DocuSign configurado: retorna `envelopeId` e área de status mostra "Enviado" | ✅ branch `ok()` |
| AC-10 | Se DocuSign **não** configurado: retorna erro 400/403 com mensagem de consentimento/configuração incompleta — teste **não falha**, apenas loga | ✅ branch `else` |
| AC-11 | ~~Cleanup: `DELETE /api/contracts/:contractId` remove contrato criado no finally~~ — **removido:** contratos permanecem no banco para inspeção pós-teste | ❌ Removido |
| AC-12 | Page 1: `cli-endereco` preenchido manualmente (sem depender ViaCEP); checkboxes `entrega-sabado` e `socio-pj` marcados; `socio-cpf` re-preenchido como CNPJ (PJ ativo); `cli-observacoes` preenchido | ✅ fills + asserts |
| AC-13 | Page 2: checkbox `fast-chip` marcado | ✅ `page.check` |
| AC-14 | Page 3: todos os campos `resumo-*` exibem valores preenchidos (CNPJ, endereço, rep, email, telefone, tipo contratação, acessos, valor mensal, testemunhas) | ✅ 12 asserts individuais |
| AC-15 | Teste executa fluxo completo (AC-01 a AC-14) parametrizado para 4 tipos de empresa: MEI, LTDA, S.A., EIRELI | ✅ `test.each(companyTypes)` |
| AC-16 | Cada cenário usa CNPJ e CPFs matematicamente válidos (passam validação de dígitos no frontend `validators.js` e backend `cnpj.js`/`cpf.js`) | ✅ dados pré-validados no config |
| AC-17 | Email de assinatura é disparado via `POST /api/docusign/send/:contractId` em cada um dos 4 fluxos | ✅ Page 4 em cada `test.each` |
| AC-18 | Contratos criados permanecem no banco (sem cleanup automático) — disponíveis para inspeção via `make inspect-state` | ❌ Sem `afterAll` DELETE |

---

## Acceptance Criteria — upload-inspect.spec.js

| ID | Critério | Coberto pelo teste |
|----|----------|-------------------|
| I-01 | Inserção de contrato via POST `/api/contracts` com multipart contendo dados JSON e os 3 arquivos anexados de fixture | ✅ `test` principal |
| I-02 | Validação no DB via GET `/api/contracts/:id` retornando sucesso e os mesmos dados inseridos | ✅ `test` principal |
| I-03 | Inspeção de arquivos em uploads via GET `/api/contracts/uploads/inspect?path=<CNPJ_RazaoSocial>` retornando os 3 arquivos PDFs com bytes salvos no disco | ✅ `test` principal |
| I-04 | Upload de RG (`rg diogo.jpg`) como `documento_identidade` via POST `/api/docusign/portal/:hash/upload` | ✅ `uploadClientDoc` |
| I-05 | Upload de Contrato Social como `contrato_social` via POST `/api/docusign/portal/:hash/upload` | ✅ `uploadClientDoc` |
| I-06 | Inspeção de pasta retorna ≥3 arquivos (3 PDFs do contrato + docs do cliente) | ✅ `inspectData.entries.length >= 3` |
| I-07 | `clientDocs` no contrato (propriedade flat, não `docusign.clientDocs`) tem ≥2 itens com tipos `documento_identidade` e `contrato_social` | ✅ `contractWithDocs.clientDocs` asserts |
| I-08 | Acesso sem token retorna 401 | ✅ `noTokenRes.status() === 401` |
| I-09 | Path traversal retorna 400 | ✅ `pathTraversalRes.status() === 400` |

---

## Acceptance Criteria — populate-offers.test.js

| ID | Critério | Coberto pelo teste |
|----|----------|-------------------|
| PO-01 | `updateMany` é chamado com query `$or` filtrando `sistemaInterno` nulo/ausente/vazio | ✅ `updateManyMock` asserts (29-31, 56-62) |
| PO-02 | Ofertas do arquivo `lista ofertas.md` são inseridas com `sistemaInterno: "Easy Vendas"`, `valor: 0`, `dataVencimento: 2099-12-31` | ✅ `insertManyMock` asserts (37-39, 68-77) |
| PO-03 | Idempotência: ofertas já existentes não são duplicadas — apenas novas são inseridas | ✅ `find` mock + `insertMany` com 1 doc novo (33-35, 64-71) |
| PO-04 | Teste usa `node:test` e `node:assert` — executável via `npm test` / `make test-unit` | ✅ imports e estrutura (1-2, 13) |
| PO-05 | Arquivo de ofertas inexistente não causa erro — `insertMany` não é chamado | ✅ segundo teste (80-94) |

---

## Acceptance Criteria — static-files.test.js

| ID | Critério | Coberto pelo teste |
|----|----------|-------------------|
| SF-01 | Entrega do arquivo `/js/app.js` retorna status 200, Content-Type javascript e não é HTML | ✅ `deve servir o arquivo /js/app.js` |
| SF-02 | Entrega do arquivo `/js/index.js` retorna status 200, Content-Type javascript e não é HTML | ✅ `deve servir o arquivo /js/index.js` |
| SF-03 | Requisições a scripts inexistentes retornam status 404 em vez de fallback HTML | ✅ `deve retornar 404 para arquivos estáticos inexistentes` |

---

## Acceptance Criteria — navbar.spec.js

| ID | Critério | Coberto pelo teste |
|----|----------|-------------------|
| NAV-01 | Topnav (`.topnav`) e Drawer (`.sidebar`) estão presentes no DOM | ✅ `toBeAttached()` |
| NAV-02 | Drawer abre ao clicar em `.menu-toggle` — `drawer-open` adicionado, `aria-expanded="true"`, `aria-hidden="false"` | ✅ `test('NAV-04 & NAV-07')` |
| NAV-03 | Drawer fecha ao clicar em `.menu-toggle` (ou `.drawer-close-btn`) — `drawer-open` removido, `aria-expanded="false"` | ✅ `test('NAV-04 & NAV-07')` |
| NAV-04 | Drawer fecha ao clicar em `.drawer-backdrop` | ✅ `test('NAV-05')` |
| NAV-05 | Drawer fecha ao pressionar tecla ESC | ✅ `test('NAV-06')` |
| NAV-06 | Em viewport mobile (≤768px), topnav é visível e `.menu-toggle` alterna o drawer | ✅ `test('Mobile Viewport')` |
| NAV-07 | Sidebar é carregada async via `fetch()` — `networkidle` necessário no `beforeEach` | ✅ `beforeEach` |
| NAV-08 | Modais de sobreposição (`#accessViolationsModal`) são dispensados antes dos testes | ✅ `beforeEach` |

---

## Acceptance Criteria — test-date-filters.js

Script manual de validação dos filtros de data com timezone-awareness (America/Sao_Paulo).

| ID | Critério | Status |
|----|----------|--------|
| DF-01 | Apenas `queryStartDate` — filtra oportunidades a partir da data | ✅ |
| DF-02 | Apenas `queryEndDate` — filtra oportunidades até a data | ✅ |
| DF-03 | Ambas preenchidas — intervalo fechado | ✅ |
| DF-04 | Fallback (mês corrente) — sem parâmetros, usa mês atual | ✅ |
| DF-05 | Mês e ano específicos — parâmetros `month` e `year` | ✅ |
| DF-06 | Timezone-awareness — datas no fuso America/Sao_Paulo não viram UTC errado | ✅ |
| DF-07 | Input inválido — string não numérica tratada | ✅ |
| DF-08 | String undefined/null — tratado como ausente | ✅ |
| DF-09 | ISO string completa — aceita como fallback | ✅ |

---

## Feature: Populate Offers (VTME & Easy Vendas Import)

**Script:** `src/scripts/populate-offers-vtme.js`  
**Makefile:** `make populate-vtme`  
**Teste:** `tests/populate-offers.test.js` (PO-01 a PO-05)

### Objetivo
1. Atualizar ofertas existentes com `sistemaInterno` nulo/indefinido/vazio para `"VTME"`.
2. Ler `md/lista ofertas.md` e inserir ofertas como `"Easy Vendas"`.

### Requisitos

| ID | Requisito |
|----|-----------|
| REQ-001 | Script em `src/scripts/populate-offers-vtme.js` |
| REQ-002 | Makefile com regra `populate-vtme` |
| REQ-003 | Update de `sistemaInterno` null/undefined/"" → `"VTME"` |
| REQ-004 | Parse de `md/lista ofertas.md` com `valor=0`, `dataVencimento=2099-12-31`, `sistemaInterno="Easy Vendas"` |
| REQ-005 | Idempotência — não duplicar ofertas com mesmo nome |
| REQ-006 | Carregar `.env` via dotenv/config, fechar conexão MongoDB |
| REQ-007 | Log resumo final (qtd atualizadas + qtd importadas) |
| REQ-008 | Teste em `tests/populate-offers.test.js` com `node:test` + `node:assert` |

### Acceptance Criteria (Script)

| ID | Critério | Status |
|----|----------|--------|
| AC-001 | `make populate-vtme` atualiza registros órfãos sem `sistemaInterno` para `"VTME"` | ✅ PO-01 |
| AC-002 | `make populate-vtme` lê e insere ofertas de `md/lista ofertas.md` como `"Easy Vendas"` | ✅ PO-02 |
| AC-003 | Executar novamente não cria duplicatas | ✅ PO-03 |
| AC-004 | Teste unitário executa com `npm test` e valida fluxo mockado | ✅ PO-04, PO-05 |

---

## Dados de Teste (Fixtures) — compartilhados

| Arquivo | `data-id` no portal (se aplicável) | Uso |
|---------|-----------------------------------|-----|
| `Contrato Social - DANILTON (FERREIRA LIMA).pdf` | `contrato_social` | Upload via client-server (E2E upload-inspect) |
| `rg diogo.jpg` | `documento_identidade` | Upload via client-server (E2E upload-inspect) |
| `Contrato de Permanência - W A DA SILVA SERVICOS.pdf` | `comprovante_residencia` | Portal cliente |
| `Termo de Contratação - W A DA SILVA SERVICOS.pdf` | `certificado_mei` | Portal cliente |
| `Proposta Comercial - W A DA SILVA SERVICOS.pdf` | `estatuto_ata` | Portal cliente |

> **Nota:** As fixtures no `tests/e2e/fixture/` são herdadas do template `docusigner_v2`. RG e Contrato Social são exercidos via client-server no E2E upload-inspect. Demais (comprovante_residencia, certificado_mei, estatuto_ata) mantidas para futura expansão.

---

## Ambiente & Variáveis (comuns a todos os testes)

| Variável | Valor padrão | Descrição |
|----------|--------------|-----------|
| `TEST_BASE_URL` | `http://165.227.212.57:8000` | Servidor remoto (nginx + Node) |
| `TEST_EMAIL` | `diogomends@gmail.com` | Usuário admin do CRM |
| `TEST_SENHA` | `Senha@123` | Senha do usuário |
| `HEADLESS` | `false` | `true` para CI, `false` para visual |
| `DOCUSIGN_SIGNER_EMAIL` | `diogomends+docusigner@gmail.com` | Email do signatário no fluxo real |

---

## Execução

```bash
# Todos os testes headed (visual)
make test-e2e

# Todos os testes headless (CI)
make test-e2e-headless

# UI mode (interativo)
make test-e2e-ui

# Apenas contratos
make test-contracts
make test-contracts-headless

# Ou via npm
npm run test:e2e:headed
npm run test:e2e
npm run test:e2e:ui
```

### Inspect State

```bash
# Inspecionar estado de uploads + DB
make inspect-state
make inspect-state FOLDER=12345678000195_Upload_Inspect_Test_INC
make inspect-state CONTRACT_ID=6a54d5e96b2437f83dc1fb1b
```

---

## Rastreabilidade — contratos.spec.js

> **Nota:** Após a parametrização com `test.each`, as ACs 01-14 aplicam-se a cada um dos 4 cenários (MEI, LTDA, S.A., EIRELI). As linhas exatas serão atualizadas após a implementação.

| AC | Cobertura |
|----|-----------|
| AC-01 | `test.beforeEach` — executa antes de cada cenário |
| AC-02 | `runContractFlow()` — Page 1 dados do cliente |
| AC-03 | `btn-copiar-rep`, `btn-copiar-socio`, `btn-copiar-receb` |
| AC-04 | `runContractFlow()` — Page 2 negociação |
| AC-05 | `waitForResponse POST /api/contracts` + `contractId` |
| AC-06 | `#modal-success` + 3 botões "Gerado!" |
| AC-07 | `#ds-nome`, `#ds-email`, `#ds-cpf` preenchidos |
| AC-08 | `waitForResponse POST /docusign/send/:id` |
| AC-09 | Branch `docusignResponse.ok()` — `envelopeId` + status |
| AC-10 | Branch `else` — erro de consentimento logado |
| AC-11 | ❌ Removido — sem cleanup |
| AC-12 | `#cli-endereco`, `#entrega-sabado`, `#socio-pj`, `#socio-cpf`, `#cli-observacoes` |
| AC-13 | `#fast-chip` checkbox |
| AC-14 | 12 asserts `resumo-*` — verificação por cenário |
| AC-15 | `test.each(companyTypes)` com 4 entries |
| AC-16 | Dados em `companyTypes[].cnpj`, `*.cpf` — pré-validados |
| AC-17 | `POST /api/docusign/send/:id` chamado 4× |
| AC-18 | Sem `afterAll` DELETE — contratos retidos |

---

## Rastreabilidade — upload-inspect.spec.js

| AC | Linhas no teste |
|----|-----------------|
| I-01 | 52-150 |
| I-02 | 156-167 |
| I-03 | 186-199 |
| I-04 | via `uploadClientDoc` → POST `/api/docusign/portal/:hash/upload` |
| I-05 | via `uploadClientDoc` → POST `/api/docusign/portal/:hash/upload` |
| I-06 | 193 |
| I-07 | 212-217 (accessHash via GET `/api/client-docs/link/:id`, clientDocs flat) |
| I-08 | 219-221 |
| I-09 | 223-227 |

---

## Rastreabilidade — navbar.spec.js

| AC | Linhas no teste |
|----|-----------------|
| NAV-01 | 45-50 |
| NAV-02/NAV-03 | 56-80 |
| NAV-04 | 81-95 |
| NAV-05 | 96-110 |
| NAV-06 | 119-136 |

---

## Rastreabilidade — inspect-state.js

| Item | Descrição |
|------|-----------|
| CLI-01 | Exibe árvore de arquivos da pasta de uploads com nome, tamanho e data |
| CLI-02 | Exibe contratos no DB que correspondem ao mesmo CNPJ da pasta |
| CLI-03 | Aceita `--folder`, `--contract-id` ou usa último contrato do `last-test-contract.json` |
| CLI-04 | Faz login automático via TEST_EMAIL/TEST_SENHA |

---

## Rastreabilidade — populate-offers.test.js

| AC | Linhas no teste |
|----|-----------------|
| PO-01 | 29-31, 56-62 |
| PO-02 | 37-39, 68-77 |
| PO-03 | 33-35, 64-71 |
| PO-04 | 1-2, 13 |
| PO-05 | 80-94 |

---

## Rastreabilidade — static-files.test.js

| AC | Linhas no teste |
|----|-----------------|
| SF-01 | 6-13 |
| SF-02 | 15-22 |
| SF-03 | 24-28 |

---

## Decisões (ADR) — Suite

- **ADR-T001**: Testes usam `@playwright/test` (não IIFE nativo) para integrar com reporter, trace, screenshot nativo
- **ADR-T002**: `global-setup.js` faz login **uma vez** e salva `auth-state.json`; `playwright.config.js` usa `storageState` para carregar automaticamente — evita login repetido em todos os testes
- **ADR-T003**: DocuSign no servidor remoto **não tem config completa** → testes aceitam erro de config como "sucesso comportamental" (fluxo chegou até lá)
- **ADR-T004**: ~~Cleanup via API DELETE no `afterAll`~~ — **substituído:** contratos permanecem no banco para inspeção pós-teste (AC-18)
- **ADR-T005**: Fixtures copiadas de `docusigner_v2/test/fixture/` — pasta `tests/e2e/` no `.gitignore`
- **ADR-T006**: `playwright.config.js` na raiz (descoberta automática); `global-setup/teardown` em `tests/e2e/`
- **ADR-I001**: Endpoint usa query param `?path=` em vez de sub-rota para evitar conflito com `/:id`
- **ADR-I002**: Validação anti-path-traversal com `path.normalize()` + verificação de prefixo
- **ADR-I003**: Logs com prefixo `[storage]` para fácil filtragem em logs de produção
- **ADR-T007**: Teste usa `test.each` com 4 configs (MEI, LTDA, S.A., EIRELI) em vez de 4 arquivos separados — evita duplicação de 600+ linhas
- **ADR-T008**: CNPJs e CPFs dos 4 cenários são pré-validados com o algoritmo de dígitos verificadores idêntico ao backend — garante que o fluxo não falhe por validação de documento inválido
- **ADR-T009**: `playwright.config.js` usa `storageState` para reutilizar `auth-state.json` entre todos os testes — `global-setup.js` faz login uma vez e salva; testes não precisam de `beforeEach` de login
- **ADR-T010**: Testes de navbar usam `.drawer-close-btn` em vez de `.menu-toggle` para fechar sidebar — quando aberta, o close button obstrui fisicamente o toggle no DOM
- **ADR-T011**: `page.evaluate(() => el.click())` é usado para disparar click no `.drawer-backdrop` — `force: true` do Playwright ignora o listener JS do backdrop

---

## Gaps Conhecidos (não bloqueiam)

### contratos.spec.js
1. **DocuSign não configurado no remoto** — não valida webhook/polling até `completed`
2. **Validação visual de PDFs** — teste só confirma geração/download, não conteúdo dos PDFs
3. **CEP automático** — usa `waitForTimeout(1500)` heurístico; ideal seria `waitForResponse` do ViaCEP
4. **Portal do cliente (DocuSigner) não testado** — o teste dispara o email mas não navega para `client-server/` para fazer upload de documentos como cliente; gap coberto parcialmente pelo `upload-inspect.spec.js`
5. **Dados de 4 empresas gerados no banco** — sem cleanup automático; rodar `make clean-contracts` para limpar todos, `make clean-test-contract` para o último ou `make clean-uploads` para limpar uploads + referências

### Suite (para futuros testes)
- [ ] Testes de autenticação (login inválido, token expirado, refresh)
- [ ] Testes de oportunidades/kanban (CRUD, drag-drop, filtros)
- [ ] Testes de importação (CSV/XLSX, validações, erros)
- [ ] Testes de relatórios/export
- [ ] Testes de permissões por role (admin vs supervisor vs vendedor)
- [ ] Testes de API diretos (contracts, docusign, auth) — sem UI
- [ ] Visual regression (screenshots baseline)
- [ ] Performance/load (k6 ou Playwright load)

### inspect-state.js
1. **Limpeza de uploads** — o script não deleta nada, apenas exibe. Cleanup deve ser feito manualmente via `make clean-contracts`, `make clean-test-contract` ou `make clean-uploads`

---

## Rastreabilidade — docusign-hmac-fetcher.js

| Item | Descrição |
|------|-----------|
| DH-01 | Obtém HMAC Key atual do DocuSign via API administrativa |
| DH-02 | Atualiza variável de ambiente com nova HMAC Key |
| DH-03 | Executável via `make docusign-hmac` |

---

## Rastreabilidade — test-date-filters.js

| Item | Descrição |
|------|-----------|
| DF-01 a DF-09 | Validação de filtros de data com timezone — executa via `make test-date-filters` ou como parte de `npm test` |

---

## Acceptance Criteria — docusign-ltda-prod.spec.js

| ID | Critério | Status |
|----|----------|--------|
| DL-01 | Teste acessa a interface em ambiente de produção utilizando `storageState` de autenticação | 📋 Planned |
| DL-02 | Cadastro e seleção da empresa usam razão social **MATANZA LTDA** (tipo LTDA) e e-mail `diogomends+docusigner@gmail.com` | 📋 Planned |
| DL-03 | O fluxo de envio é executado via módulo `src/modules/robot-docusign` | 📋 Planned |
| DL-04 | Validação de formulário: contrato **não é enviado** sem os dados cadastrais corretos/completos | 📋 Planned |
| DL-05 | Validação de indisponibilidade: usuário é **alertado via toast/modal** caso o serviço Robot-DocuSign esteja indisponível | 📋 Planned |
| DL-06 | Execução obrigatoriamente **non-headless** (`HEADLESS=false` / `--headed`) para acompanhamento em tela | 📋 Planned |
| DL-07 | Executável via comando `make test-docusign-ltda` no Makefile | 📋 Planned |
| DL-08 | Envio de exatamente 1 contrato LTDA com registro no log de jobs (`RobotJob`) | 📋 Planned |

---

## Decisões (ADR) — docusign-ltda-prod

- **ADR-DL001**: O teste foca na validação do fluxo de envio via **Robot-DocuSign** (`src/modules/robot-docusign`), sem utilizar as rotas da API JWT oficial.
- **ADR-DL002**: A execução é visível (`HEADLESS=false`) por exigência de auditoria em produção.
- **ADR-DL003**: Os dados cadastrais da empresa são fixados em **MATANZA LTDA** e o e-mail do signatário em `diogomends+docusigner@gmail.com`.

---



## Como Adicionar Novo Teste

### Teste E2E (Playwright)
1. Crie `tests/e2e/nova-feature.spec.js` seguindo o padrão de `contratos.spec.js`
2. Adicione seção **Acceptance Criteria** com tabela de ACs
3. Atualize tabela **Testes Registrados** no topo
4. Adicione ADRs específicos se houver decisões novas
5. Liste gaps na seção **Gaps Conhecidos**
6. Rode `make test-e2e` para validar

### Teste Unitário (node --test)
1. Crie `tests/nova-feature.test.js` seguindo o padrão de `populate-offers.test.js`
2. Adicione seção **Acceptance Criteria** com tabela de ACs (prefixo específico, ex: NF-01)
3. Atualize tabela **Testes Registrados** no topo
4. Adicione ADRs específicos se houver decisões novas
5. Liste gaps na seção **Gaps Conhecidos**
6. Rode `make test-unit` para validar