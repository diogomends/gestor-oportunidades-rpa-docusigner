# Spec: Correção do Módulo Playwright no Build do Robô

## Problema
Ao executar o binário do robô (`run.bat` / `robot-docusigner-X.exe`), a execução falha com o erro:
`Error: Cannot find module 'playwright'`
`Require stack: - C:\snapshot\dist-obf\main-robot-docusigner-X.cjs`

O `@yao-pkg/pkg` não inclui dependências com drivers e carregamento dinâmico no sistema virtual (`C:\snapshot`), exigindo que o `playwright` e `playwright-core` estejam disponíveis no diretório físico (`node_modules/`) no mesmo nível do executável `.exe`.

## Solução
1. Atualizar o pipeline de build em `robot/build/build.js` para copiar recursivamente `playwright` e `playwright-core` de `robot/node_modules/` para `robot/dist/<bundleBase>/node_modules/`.
2. Incluir a cópia do script `setup.bat` nas pastas de saída do `dist/` para facilitar a instalação do Chromium no ambiente de execução.
3. Preservar o esbuild com a flag `--external:playwright`, mantendo a ofuscação e a injeção estática das credenciais por robô.

## Componentes Preservados (Impact Protector)
- Backend: todas as rotas de API (`/api/robot-docusign/*`, `/instance/*`), controllers, models e middlewares permanecem intactos.
- Robô runtime: `src/main.js`, `src/job-runner.js`, `src/api-client.js`, `src/browser/docusign.js` permanecem intactos.
