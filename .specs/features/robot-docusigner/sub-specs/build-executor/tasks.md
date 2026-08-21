# Tasks: Standalone Executável Protegido & Multi-Instância Distribuída

- [x] **T-SMI-01**: Model `RobotJob` estendido com campos de lock (`locked_by`, `lock_expires_at`, `instance_metadata`).
- [x] **T-SMI-02**: Model `RobotInstance` criado e registrado no `server.js` para persistência de heartbeat e saúde da instância.
- [x] **T-SMI-03**: Controller `robotInstanceController.js` implementando lock atômico, JWT auth, heartbeat e PDF stream.
- [x] **T-SMI-04**: Rotas `robotInstanceRoutes.js` montadas em `/api/robot-docusign/instance/*`.
- [x] **T-SMI-05**: Projeto autônomo `robot-standalone/` estruturado com `ApiClient`, `Scheduler`, `JobRunner` e `docusign.js`.
- [x] **T-SMI-06**: Pipeline de build protegido `build/build.js` com `esbuild`, `javascript-obfuscator`, `bytenode` e `@yao-pkg/pkg`.
- [x] **T-SMI-07**: Script de setup do ambiente do cliente `setup.bat` e documentação de distribuição.
- [x] **T-SMI-08**: Injeção de credenciais sequenciais e URI_PROD em tempo de build com esbuild define, eliminando arquivos JSON expostos no cliente.
- [x] **T-SMI-09**: Adicionar cópia do `node_modules/playwright` e `node_modules/playwright-core` para `dist/<bundleBase>/node_modules/` e `setup.bat` para `dist/<bundleBase>/` no `build.js` (`buildForOneKey()`).
- [x] **T-SMI-10**: Validar que o executável gerado inicializa o runtime do Playwright sem erro `Cannot find module 'playwright'`.
- [x] **T-SMI-11**: Inclusão de geração automática de `README.txt` com quadro explicativo de arquivos e guia de instalação em cada pasta gerada no build.
- [x] **T-SMI-12**: Refatorar `robot/scripts/setup.bat` para remover completamente referências a `config.json` e adicionar cabeçalho com UTF-8 (`chcp 65001`).
- [x] **T-SMI-13**: Implementar detecção inteligente prévia em `setup.bat` para verificar se o Chromium já existe em `%LOCALAPPDATA%\ms-playwright\chromium-*`. Se existir, informar imediatamente sem acionar download de rede.
- [x] **T-SMI-14**: Implementar fallback de download via `npx playwright install chromium` apenas se não encontrado, com captura de `%ERRORLEVEL%`, verificação de conexão e log em `setup.log`.
- [x] **T-SMI-15**: Atualizar o pipeline de build e validar a execução do `setup.bat` nos diretórios gerados em `dist/`.
- [x] **T-SMI-16**: Saneamento de resíduos legados (remoção de `pkg.config.json` e `config.json.example`, e restrição de fallback do `config.js` exclusivamente ao `NODE_ENV=development`).
