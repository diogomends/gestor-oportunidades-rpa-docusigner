.PHONY: help dev test test-headed test-headed-ps build-robot install install-robot clean

# Exibe este help com exemplos de uso e preenchimento
help:
	@echo "Makefile - Gestor de Oportunidades RPA DocuSigner"
	@echo ""
	@echo "Uso: make <comando> [VAR=valor]"
	@echo ""
	@echo "Comandos:"
	@echo "  dev             Inicia o servidor em modo desenvolvimento (nodemon)"
	@echo "  test            Roda os testes nativos (node --test)"
	@echo "  install         Instala dependencias do servidor e do standalone"
	@echo "  install-robot   Instala apenas dependencias do standalone"
	@echo "  test-headed     Testa o robo standalone com navegador visivel (sh/bash)"
	@echo "  test-headed-ps  Testa o robo standalone com navegador visivel (PowerShell)"
	@echo "  build-robot     Gera executavel(is) .exe do robo standalone"
	@echo "  clean           Limpa pastas de build anteriores"
	@echo ""
	@echo 'EXEMPLO DE PREENCHIMENTO (ficticio):'
	@echo '  Para gerar exes para os contratos de ID 201 e 202, em modo silencioso:'
	@echo '    make build-robot IDS="201,202"'
	@echo '  Resultado: 2 arquivos .exe, um para cada ID, sem abrir janela.'
	@echo ''
	@echo '  Mesmo exemplo, mas com a janela do navegador visivel:'
	@echo '    make build-robot IDS="201,202" HEADLESS=false'
	@echo '  Resultado: 2 arquivos .exe, cada um abrindo a janela do navegador.'
	@echo ""
	@echo "Variaveis aceitas:"
	@echo "  IDS       IDs de contrato separados por virgula (sem espacos)"
	@echo "  HEADLESS  true (padrao) ou false = abre janela do navegador"

# Inicia o servidor em modo desenvolvimento (nodemon)
dev:
	npm run dev

# Roda os testes nativos (node --test)
test:
	npm test

# Instala dependencias do servidor e do standalone
install:
	npm install
	cd robot-standalone && npm install

# Instala apenas dependencias do standalone
install-robot:
	cd robot-standalone && npm install

# Testa o robo standalone com navegador visivel (HEADLESS=false) — sh/bash
test-headed:
	cd robot-standalone && HEADLESS=false node src/main.js

# Testa o robo standalone com navegador visivel — PowerShell
test-headed-ps:
	powershell -Command "cd robot-standalone; $$env:HEADLESS='false'; node src/main.js"

# Gera executavel(is) .exe do robo standalone
# Uso:
#   make build-robot                              → modo single (comportamento original)
#   make build-robot IDS="id1,id2,id3"            → cria 3 exes, headless=true (padrao)
#   make build-robot IDS="id1,id2" HEADLESS=false  → cria 2 exes com janela visivel
build-robot:
	cd robot-standalone && npm run build -- --ids "$(IDS)" --headless "$(HEADLESS)"

# Limpa pastas de build anteriores (PowerShell)
clean:
	powershell -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue robot-standalone\dist, robot-standalone\dist-bundle, robot-standalone\dist-obf, robot-standalone\dist-jsc"
