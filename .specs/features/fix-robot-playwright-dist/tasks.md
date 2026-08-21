# Tasks: Correção do Módulo Playwright no Build do Robô

## Execution Protocol
Implementar as tarefas seguindo `tlc-spec-driven` e `impact-protector`.

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Build Script | manual | Executável inicia sem erro de módulo | `robot/build/build.js` | `npm run build:robot` |

---

## Task Breakdown

### T1: Adicionar cópia do node_modules (playwright) no build.js
**What**: Copiar os diretórios `playwright` e `playwright-core` de `robot/node_modules` para `robot/dist/<bundleBase>/node_modules`.
**Where**: `robot/build/build.js`
**Depends on**: None
**Reuses**: `robot/build/build.js` (existente)

**Done when**:
- [x] `buildForOneKey()` cria a pasta `node_modules` dentro de `dist/<bundleBase>/`
- [x] `playwright` e `playwright-core` são copiados para `dist/<bundleBase>/node_modules/`
- [x] `setup.bat` é copiado para `dist/<bundleBase>/`

**Commit**: `fix(robot): copy playwright dependencies to dist output folder on build`

---

### T2: Validação da execução do robô empacotado
**What**: Executar o build e validar se o binário inicializa o runtime do Playwright sem erros de `MODULE_NOT_FOUND`.
**Where**: `robot/dist/robot-docusigner-1/`
**Depends on**: T1

**Done when**:
- [x] `npm run build` em `robot/` conclui com sucesso
- [x] `node_modules/playwright` e `node_modules/playwright-core` existem em `dist/robot-docusigner-1/`
- [x] Execução do binário carrega o módulo Playwright sem erro de require
