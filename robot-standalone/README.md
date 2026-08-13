# Robô RPA DocuSign - Versão Standalone (Executável)

Este módulo contém a aplicação autônoma empacotada em `.exe` para distribuição e execução nas máquinas dos vendedores/agentes.

## Arquitetura de Comunicação
- **Segurança**: Toda a comunicação com o servidor é realizada via HTTPS utilizando autenticação com token JWT.
- **Fila Distribuída**: As instâncias competem de forma concorrente e atômica (`lock atômico`) para obter tarefas da fila do MongoDB, impedindo que dois robôs processem o mesmo contrato.
- **Proteção do Código**: O código JavaScript é transpilado via esbuild, ofuscado com `javascript-obfuscator`, compilado para bytecode V8 nativo (`.jsc`) pelo `bytenode` e empacotado como binário Windows `.exe`.
- **Privacidade de Dados**: PDFs e credenciais trafegam apenas em memória volátil e diretórios temporários (`os.tmpdir()`), sendo excluídos de forma imediata após o término do upload na DocuSign.

## Instalação na Máquina do Agente
1. Copie a pasta `dist/` com o `robot-docusigner.exe` e `config.json.example`.
2. Execute o arquivo `setup.bat` para instalar o navegador Chromium do Playwright e gerar o `config.json`.
3. Edite o arquivo `config.json` preenchendo:
   - `API_URL`: URL da API central (ex: `https://gestor.suaempresa.com.br`)
   - `ROBOT_ID`: Identificador único da máquina (ex: `agent-01`, `agent-02`)
   - `ROBOT_EMAIL` / `ROBOT_PASS`: Credenciais de acesso da conta de robô.
4. Execute `robot-docusigner.exe`.

## Como Gerar Novo Build do Executável (.exe)
Na raiz do projeto ou dentro de `robot-standalone`:
```bash
npm run build
```
O executável protegido será gerado em `robot-standalone/dist/robot-docusigner.exe`.
