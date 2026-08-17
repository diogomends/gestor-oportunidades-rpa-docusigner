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
	@echo "  build-robot     Gera executavel(is) .exe do robo standalone com dados embutidos"
	@echo "  clean           Limpa pastas de build anteriores"
	@echo ""
	@echo 'EXEMPLOS DE BUILD COM DADOS EMBUTIDOS:'
	@echo '  1. Single Robot:'
	@echo '    make build-robot EMAIL="robot@gestor.com.br" PASS="Senha123" HEADLESS=true'
	@echo ''
	@echo '  2. Multi-Robot com credenciais individuais em sequencia:'
	@echo '    make build-robot IDS="alessandra-rpa-docusigner,bianca-rpa-docusigner" \'
	@echo '                     EMAILS="alessandra@gestor.com.br,bianca@gestor.com.br" \'
	@echo '                     PASSWORDS="PassAlessandra123,PassBianca456" \'
	@echo '                     HEADLESS=true'
	@echo ""
	@echo "Variaveis aceitas:"
	@echo "  IDS        Identificadores unicos das maquinas separados por virgula"
	@echo "  EMAILS     E-mails de autenticacao no CRM sequenciais (ou EMAIL para único)"
	@echo "  PASSWORDS  Senhas de autenticacao no CRM sequenciais (ou PASS para única)"
	@echo "  HEADLESS   true (padrao) ou false = abre janela do navegador"
	@echo "  API_URL    URL central customizada (padrao: le URI_PROD do .env)"

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

# Gera executavel(is) .exe do robo standalone com credenciais embutidas
# Uso:
#   make build-robot EMAIL="user@crm.com" PASS="pass"
#   make build-robot IDS="id1,id2" EMAILS="e1,e2" PASSWORDS="p1,p2" HEADLESS=false
build-robot:
	cd robot-standalone && npm run build -- --ids "$(IDS)" --emails "$(EMAILS)" --passwords "$(PASSWORDS)" --email "$(EMAIL)" --pass "$(PASS)" --headless "$(HEADLESS)" --api-url "$(API_URL)"

# Limpa pastas de build anteriores (PowerShell)
clean:
	powershell -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue robot-standalone\dist, robot-standalone\dist-bundle, robot-standalone\dist-obf, robot-standalone\dist-jsc"

