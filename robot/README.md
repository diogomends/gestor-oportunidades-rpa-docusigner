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
| `setup.bat` | Script para instalação do navegador Chromium (Playwright) e configuração de inicialização automática no Windows. |
| `README.txt` | Guia completo de instalação e uso com quadro explicativo. |
| `node_modules/` | Dependências locais do Playwright (`playwright` e `playwright-core`). |

## Instalação na Máquina do Agente
1. Copie a pasta gerada em `dist/` (ex: `robot-docusigner-1`) para a máquina alvo.
2. Execute `setup.bat` para baixar o navegador Chromium do Playwright e configurar a inicialização automática junto com o Windows.
3. Execute `run.bat` ou o executável `robot-docusigner-X.exe` (ou reinicie o Windows).

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
├── robot-docusigner-1/
│   ├── robot-docusigner-1.exe
│   ├── run.bat
│   ├── setup.bat
│   ├── README.txt
│   └── node_modules/
├── robot-docusigner-2/
│   ├── robot-docusigner-2.exe
│   ├── run.bat
│   ├── setup.bat
│   ├── README.txt
│   └── node_modules/
└── ...
```

