# Domínio: build-creator-robot

Pipeline que **gera** os executáveis `robot-docusigner-*.exe` + `*.jsc` distribuídos nas máquinas dos agentes.

## Sub-features

| Sub-feature | Origem legada | Conteúdo |
|---|---|---|
| `compilacao-simplificada` | `build-robots` | Compilação com 3 parâmetros `--key --api-url --headless`, eliminação ROBOT_ID/EMAIL (AD-016) |
| `executavel-protegido` | `robot-docusigner/sub-specs/build-executor` | Geração de executável ofuscado: esbuild→obfuscator→bytenode→pkg, multi-chave, lock atômico, RobotInstance (AD-013/015/017) |

> Distribuição Playwright + setup.bat (REQ-SMI-05/06/07) vive em `executavel-protegido`.
