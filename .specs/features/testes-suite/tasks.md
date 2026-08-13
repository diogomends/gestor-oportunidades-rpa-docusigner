# Tasks: upload-inspect — Visibilidade da Estrutura de Uploads

**Feature:** `upload-inspect`  
**Status:** Planned  
**Dependências:** Nenhuma  

---

## Contexto

O `storageService.js` opera silenciosamente — não há logs de save/delete/copy.  
Em produção não é possível saber se a pasta `uploads/{folderName}/` foi criada,
quais arquivos estão lá, ou qual a estrutura atual do diretório.

**Objetivo:** Dar visibilidade ao dev em produção sobre o que está sendo salvo
em `uploads/`.

---

## Tasks

### Task 1: Adicionar método `listTree()` no `storageService.js`

**Arquivo:** `src/modules/contract/services/storageService.js`

Adicionar método que percorre recursivamente um diretório relativo e retorna
a estrutura como array de objetos:

```ts
{
  name: string,       // nome do arquivo/pasta
  type: "file" | "directory",
  size?: number,      // bytes (só para file)
  modified?: string   // ISO date (só para file)
  children?: Entry[]  // só para directory
}
```

**Assinatura:** `listTree(relativePath = "uploads")`

**Verificação:**  
- `storageService.listTree("uploads")` retorna array com estrutura correta
- Pastas vazias retornam `children: []`
- Caminho inexistente retorna array vazio

---

### Task 2: Adicionar logs de save/delete no `storageService.js`

**Arquivo:** `src/modules/contract/services/storageService.js`

Adicionar `console.log` estruturado nos métodos:

| Método | Log |
|--------|-----|
| `saveFile()` | `[storage] saved 12345 bytes → uploads/pasta/arquivo.pdf` |
| `deleteFile()` | `[storage] deleted → uploads/pasta/arquivo.pdf` |
| `copyFile()` | `[storage] copied → uploads/pasta/dest.pdf (from uploads/pasta/src.pdf)` |

Formato: `[storage] <operação> <detalhes> → <relativePath>`

**Verificação:** Rodar `npm start` e fazer POST /api/contracts — log deve aparecer no console.

---

### Task 3: Adicionar handler `inspectUploads` no `contractController.js`

**Arquivo:** `src/modules/contract/controllers/contractController.js`

Adicionar handler:

```js
const inspectUploads = async (req, res) => {
  const subPath = req.query.path || "";      // opcional: "12345678_Empresa/"
  const tree = storageService.listTree(path.join("uploads", subPath));
  res.json({ path: path.join("uploads", subPath), entries: tree });
};
```

**Regras:**
- Validar `subPath` para evitar path traversal (rejeitar `../`, `..\\`, absolute paths)
- Limitar profundidade máxima (ex: 3 níveis)
- Retornar `400` se path traversal detectado

**Verificação:** Testar manualmente com curl — `GET /api/contracts/uploads/inspect?path=12345678_Empresa/`

---

### Task 4: Adicionar rota `GET /uploads/inspect` no `routes.js`

**Arquivo:** `src/modules/contract/routes.js`

Adicionar rota protegida:

```js
router.get(
  "/uploads/inspect",
  protect,
  authorize("admin", "suporte"),
  inspectUploads
);
```

**Posicionamento:** Antes das rotas com `/:id` para evitar conflito.

**Verificação:**
- `GET /api/contracts/uploads/inspect` sem token → 401
- `GET /api/contracts/uploads/inspect` com token de vendedor → 403
- `GET /api/contracts/uploads/inspect` com token admin → 200 + estrutura JSON
- `GET /api/contracts/uploads/inspect?path=../../etc` → 400

---

### Task 5: Verificação final

1. Rodar `npm test` — testes existentes continuam passando
2. Fazer `make test-contracts` — E2E não quebrado
3. Testar endpoint manualmente no ambiente dev:
   ```bash
   curl -H "Authorization: Bearer <token>" http://localhost:3000/api/contracts/uploads/inspect
   ```
4. Estrutura retornada deve reflectir o que está em `uploads/`

---

## Ordem de Execução

```
Task 1 (listTree) ──→ Task 2 (logs) ──→ Task 3 (handler) ──→ Task 4 (rota) ──→ Task 5 (verificação)
       │                    │                    │                    │
       └─────── paralelo ───┘                    └─────── paralelo ───┘
```

Tasks 1 e 2 podem ser feitas em paralelo (mesmo arquivo, mas métodos independentes).  
Tasks 3 e 4 também (handler depende de listTree, rota depende do handler).

---

## ADRs

- **ADR-I001**: Endpoint usa query param `?path=` em vez de sub-rota `/:path*` para evitar conflito com `/:id`
- **ADR-I002**: Validação anti-path-traversal usa `path.normalize()` + verificação de prefixo
- **ADR-I003**: Logs usam prefixo `[storage]` para fácil filtragem em produção (`docker logs app_gestor | grep "\[storage\]"`)

---

# Tasks: docusign-ltda-prod — Fluxo de Envio Robot-DocuSign (Empresa LTDA)

**Feature:** `docusign-ltda-prod`  
**Status:** Planned  
**Dependências:** Módulo `src/modules/robot-docusign`  

---

## Contexto

A automação de envio de contratos via Robot-DocuSign (`src/modules/robot-docusign`) necessita de um teste E2E dedicado executado em ambiente de produção para validar especificamente o **fluxo de envio de 1 contrato LTDA** para a empresa **MATANZA LTDA** (usando o e-mail de signatário `diogomends+docusigner@gmail.com`).

O teste **não** foca no fluxo inicial de criação do contrato no CRM, mas sim na validação estrita do envio via Robot-DocuSign, garantindo que:
1. O contrato **não seja gerado/enviado** sem os dados cadastrais corretos (validação de dados incompletos/inválidos).
2. O usuário seja **claramente alertado** em caso de indisponibilidade ou falha do serviço Robot-DocuSign.
3. A execução ocorra obrigatoriamente com o **navegador visível (non-headless / headed mode)** para auditoria visual completa do processo.

---

## Tasks

### Task 1: Preparar Fixtures e Dados de Teste LTDA ("MATANZA LTDA")

**Arquivo:** `tests/e2e/fixtures/ltda-matanza.json` (ou dados inline no spec)

Definir conjunto de dados pré-validados para a empresa:
- **Razão Social:** MATANZA LTDA
- **Tipo de Contrato:** LTDA
- **E-mail do Signatário:** `diogomends+docusigner@gmail.com`
- **CNPJ e CPFs:** Matematicamente válidos (passam por `validators.js`)

**Verificação:**
- Dados possuem estrutura compatível com os seletores da UI de envio e endpoints do módulo `robot-docusign`.

---

### Task 2: Implementar Teste E2E Playwright `docusign-ltda-prod.spec.js`

**Arquivo:** `tests/e2e/docusign-ltda-prod.spec.js`

Implementar os seguintes cenários E2E:
1. **Cenário 1 — Envio Robot-DocuSign (Sucesso):**
   - Navega até o módulo de envio (`src/modules/robot-docusign` / Step de envio).
   - Preenche dados da empresa MATANZA LTDA e e-mail `diogomends+docusigner@gmail.com`.
   - Aciona o envio via Robot-DocuSign.
   - Assert: confirmação visual e alteração de status do envelope/job.

2. **Cenário 2 — Validação de Dados Incorretos/Incompletos:**
   - Tenta submeter sem e-mail ou com dados inválidos.
   - Assert: o contrato **não é enviado** e a UI bloqueia a ação indicando os campos.

3. **Cenário 3 — Alerta de Indisponibilidade do Serviço:**
   - Simula ou intercepta falha/timeout de resposta do `robot-docusign`.
   - Assert: toast/modal de alerta é exibido ao usuário informando a indisponibilidade sem crash silencioso.

**Regras de Execução:**
- Forçar `headless: false` / `HEADLESS=false` para abertura visível do navegador Chromium.
- Reutilizar `storageState` de `auth-state.json`.

**Verificação:**
- Teste roda visualmente via Playwright sem falhas nos cenários de borda.

---

### Task 3: Criar Regra `make test-docusign-ltda` no Makefile

**Arquivo:** `Makefile`

Adicionar target dedicado:

```makefile
test-docusign-ltda:
	set HEADLESS=false && npx playwright test tests/e2e/docusign-ltda-prod.spec.js --headed --project=chromium
```

**Verificação:**
- Executar `make test-docusign-ltda` no PowerShell abre o navegador e executa o teste contra o ambiente configurado (`TEST_BASE_URL`).

---

### Task 4: Registrar os ACs e ADRs na Suíte (`spec.md`)

**Arquivo:** `.specs/features/testes-suite/spec.md`

Atualizar a especificação principal com:
- Tabela de Acceptance Criteria (DL-01 a DL-08).
- ADR-DL001 e ADR-DL002 especificando o uso de `robot-docusign` e execução em modo headed.
- Atualizar lista de comandos disponíveis e tabela de testes registrados.

---

## Ordem de Execução

```
Task 1 (Fixtures) ──→ Task 2 (Spec E2E) ──→ Task 3 (Makefile) ──→ Task 4 (Spec Doc)
```

---

## ADRs

- **ADR-DL001**: O teste utiliza diretamente o módulo `src/modules/robot-docusign` em vez de rotas da API oficial JWT da DocuSign.
- **ADR-DL002**: A execução do comando `make test-docusign-ltda` é obrigatoriamente `--headed` (`HEADLESS=false`) para permitir o acompanhamento visual do processo em tela.
- **ADR-DL003**: O e-mail de teste fixo para a empresa **MATANZA LTDA** é `diogomends+docusigner@gmail.com`.

