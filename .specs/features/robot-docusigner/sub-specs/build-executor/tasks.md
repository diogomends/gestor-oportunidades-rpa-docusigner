# Tasks: Standalone Executável Protegido & Multi-Instância Distribuída

- [x] **T-SMI-01**: Model `RobotJob` estendido com campos de lock (`locked_by`, `lock_expires_at`, `instance_metadata`).
- [x] **T-SMI-02**: Model `RobotInstance` criado e registrado no `server.js` para persistência de heartbeat e saúde da instância.
- [x] **T-SMI-03**: Controller `robotInstanceController.js` implementando lock atômico, JWT auth, heartbeat e PDF stream.
- [x] **T-SMI-04**: Rotas `robotInstanceRoutes.js` montadas em `/api/robot-docusign/instance/*`.
- [x] **T-SMI-05**: Projeto autônomo `robot-standalone/` estruturado com `ApiClient`, `Scheduler`, `JobRunner` e `docusign.js`.
- [x] **T-SMI-06**: Pipeline de build protegido `build/build.js` com `esbuild`, `javascript-obfuscator`, `bytenode` e `@yao-pkg/pkg`.
- [x] **T-SMI-07**: Script de setup do ambiente do cliente `setup.bat` e documentação de distribuição.
- [x] **T-SMI-08**: Injeção de credenciais sequenciais e URI_PROD em tempo de build com esbuild define, eliminando arquivos JSON expostos no cliente.
