# Robô RPA DocuSign - Versão Standalone (Executável)

Este módulo contém a aplicação autônoma empacotada em `.exe` para distribuição e execução nas máquinas dos vendedores/agentes.

## Arquitetura de Comunicação
- **Segurança**: Toda a comunicação com o servidor é realizada via HTTPS utilizando autenticação com token JWT.
- **Fila Distribuída**: As instâncias competem de forma concorrente e atômica (`lock atômico`) para obter tarefas da fila do MongoDB, impedindo que dois robôs processem o mesmo contrato.
- **Proteção do Código**: O código JavaScript é transpilado via esbuild, ofuscado com `javascript-obfuscator`, compilado para bytecode V8 nativo (`.jsc`) pelo `bytenode` e empacotado como binário Windows `.exe`.
- **Privacidade de Dados**: PDFs e credenciais trafegam apenas em memória volátil e diretórios temporários (`os.tmpdir()`), sendo excluídos de forma imediata após o término do upload na DocuSign.

## Distribuição — Arquivo Único Autônomo
 
Cada build gera um **executável autônomo e protegido**:
 
| Arquivo | Função |
|---------|--------|
| `robot-docusigner-X.exe` | Binário Windows autônomo com runtime Node, código empacotado e ofuscado com a chave embutida. |
| `run.bat` | Script auxiliar para inicialização com terminal persistente e visualização de logs. |

## Instalação na Máquina do Agente
1. Copie a pasta gerada em `dist/` (ex: `robot-docusigner-1`) para a máquina alvo.
2. Execute `setup.bat` (ou `npx playwright install chromium`) se o navegador Chromium do Playwright ainda não estiver instalado.
3. Execute `run.bat` ou o executável `robot-docusigner-X.exe`.

## Como Gerar Novo Build do Executável (.exe)

Na raiz do projeto:
```bash
# 1. Lê ROBOT_KEY e HEADLESS do .env.dev / .env:
make build-robot

# 2. Ou passando chave explicitamente:
make build-robot KEY="rf_sec_sua_chave" HEADLESS=true

# 3. Ou apontando para URL de API customizada:
make build-robot KEY="rf_sec_sua_chave" API_URL="https://crm.meudominio.com" HEADLESS=false
```

Os arquivos gerados estarão prontos para distribuição em `dist/`:
```
dist/
├── robot-docusigner.exe
└── main-robot-docusigner.jsc
```

