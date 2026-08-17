# Robô RPA DocuSign - Versão Standalone (Executável)

Este módulo contém a aplicação autônoma empacotada em `.exe` para distribuição e execução nas máquinas dos vendedores/agentes.

## Arquitetura de Comunicação
- **Segurança**: Toda a comunicação com o servidor é realizada via HTTPS utilizando autenticação com token JWT.
- **Fila Distribuída**: As instâncias competem de forma concorrente e atômica (`lock atômico`) para obter tarefas da fila do MongoDB, impedindo que dois robôs processem o mesmo contrato.
- **Proteção do Código**: O código JavaScript é transpilado via esbuild, ofuscado com `javascript-obfuscator`, compilado para bytecode V8 nativo (`.jsc`) pelo `bytenode` e empacotado como binário Windows `.exe`.
- **Privacidade de Dados**: PDFs e credenciais trafegam apenas em memória volátil e diretórios temporários (`os.tmpdir()`), sendo excluídos de forma imediata após o término do upload na DocuSign.

## Distribuição — Dois Arquivos Obrigatórios

Cada build gera **dois arquivos que devem ser distribuídos juntos, na mesma pasta**:

| Arquivo | Função |
|---------|--------|
| `robot-docusigner.exe` | Binário Windows (loader). NÃO contém o código — é apenas o runtime Node embutido que carrega o bytecode. |
| `main-robot-docusigner.jsc` | Bytecode V8 nativo (código ofuscado/compilado com chave embutida). O `.exe` procura este arquivo ao lado dele (ou no `__dirname`) e aborta com erro se não encontrar. |

> **IMPORTANTE**: nunca distribua o `.exe` sem o `.jsc` correspondente.

## Instalação na Máquina do Agente
1. Copie os arquivos da pasta `dist/` (`robot-docusigner.exe` E `main-robot-docusigner.jsc`) para a máquina alvo.
2. Execute `setup.bat` apenas para instalar o navegador Chromium do Playwright (não é mais necessário gerar/editar `config.json` — a chave de API (`ROBOT_KEY`), `HEADLESS` e `API_URL` já vêm embutidas no bytecode no momento do build; a identificação da instância é realizada automaticamente pelo servidor central).
3. Execute `robot-docusigner.exe`.

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

