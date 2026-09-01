# Domínio: build-creator-robot

Pipeline que **gera** os executáveis `robot-query-*.exe` / `robot-update-*.exe` (`robot-docusigner-*` como alias legado quando `role=all`) distribuídos nas máquinas dos agentes — `.exe` self-contained + `node_modules/playwright` ao lado (sem `.jsc`).

## Sub-features

| Sub-feature | Origem legada | Conteúdo |
|---|---|---|
| `compilacao-simplificada` | `build-robots` | Compilação com 4 parâmetros `--key --api-url --headless --role`, matriz `N×R`, eliminação ROBOT_ID/EMAIL, `ROBOT_ROLE` + sessões isoladas (AD-016 superseded by AD-053) |
| `executavel-protegido` | `robot-docusigner/sub-specs/build-executor` | Executável ofuscado: esbuild→obfuscator→pkg (sem bytenode), multi-chave×papel, lock atômico, RobotInstance `role` (AD-013 atualizado, AD-015/017 superseded by AD-053) |
| `dois-robos-consulta-atualizacao` | `robot/dois-robos-consulta-atualizacao` | Fonte canônica da segregação query/update — roteamento por `role`, reconciliação batch, `statusSyncScheduler` (AD-053) |

> Distribuição Playwright + setup.bat (REQ-SMI-05/06/07) vive em `executavel-protegido`. Roteamento por papel vive em `robot/dois-robos-consulta-atualizacao`.
