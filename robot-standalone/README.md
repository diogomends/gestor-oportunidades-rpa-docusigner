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
| `robot-<id>.exe` | Binário Windows (loader). NÃO contém o código — é apenas o runtime Node embutido que carrega o bytecode. |
| `main-<id>.jsc` | Bytecode V8 nativo (código ofuscado/compilado). O `.exe` procura este arquivo ao lado dele (ou no `__dirname`) e aborta com erro se não encontrar. |

> **IMPORTANTE**: nunca distribua o `.exe` sem o `.jsc` correspondente.

## Instalação na Máquina do Agente
1. Copie a subpasta completa de `dist/<id>/` (com o `.exe` E o `.jsc`) para a máquina alvo.
2. Execute `setup.bat` apenas para instalar o navegador Chromium do Playwright (não é mais necessário gerar/editar `config.json` — a chave de API (`ROBOT_KEY`), `ROBOT_ID`, `HEADLESS` e `API_URL` já vêm embutidas no bytecode no momento do build).
3. Execute `robot-<id>.exe`.

## Como Gerar Novo Build do Executável (.exe)

### Modo Single (um executável)
Na raiz do projeto:
```bash
# Lê ROBOT_KEY e HEADLESS do .env.dev / .env:
make build-robot

# Ou passando explicitamente:
make build-robot KEY="rpa_sec_sua_chave" HEADLESS=true
```

### Modo Multi-Robot (N executáveis com chaves individuais)
```bash
# Cria 2 executáveis com chaves individuais
make build-robot IDS="agent-01,agent-02" KEYS="rpa_sec_chave1,rpa_sec_chave2" HEADLESS=true

# Cria com janela visível
make build-robot IDS="agent-01,agent-02" KEYS="rpa_sec_chave1,rpa_sec_chave2" HEADLESS=false
```

Cada ID gera uma subpasta em `dist/` com o `.exe` e o `.jsc` correspondente (a chave e configurações já estão embutidas no bytecode, sem `config.json` em texto plano):
```
dist/
├── agent-01/
│   ├── robot-agent-01.exe
│   └── main-agent-01.jsc
└── agent-02/
    ├── robot-agent-02.exe
    └── main-agent-02.jsc
```

