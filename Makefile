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
	@echo "  build-robot     Gera executável .exe do robô standalone com chave embutida"
	@echo "  clean           Limpa pastas de build anteriores"
	@echo ""
	@echo "EXEMPLOS DE BUILD COM CHAVE EMBUTIDA:"
	@echo "  1. Build Automático (lê ROBOT_KEY/ROBOT_API_KEY no .env.dev):"
	@echo "    make build-robot"
	@echo ""
	@echo "  2. Build com chave específica via CLI:"
	@echo "    make build-robot KEY=\"rf_sec_xxxx\" HEADLESS=true"
	@echo ""
	@echo "  3. Build apontando para API específica:"
	@echo "    make build-robot KEY=\"rf_sec_xxxx\" API_URL=\"https://crm.meudominio.com\""
	@echo ""
	@echo "Variáveis aceitas:"
	@echo "  KEY        Chave de API do robô (padrão: lê ROBOT_KEY / ROBOT_API_KEY do .env.dev/.env)"
	@echo "  HEADLESS   true ou false (padrão: lê HEADLESS do .env.dev ou true)"
	@echo "  API_URL    URL central customizada (padrão: lê API_URL ou URI_PROD do .env.dev/.env)"

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

# Gera executavel .exe do robo standalone com chave de acesso embutida
# Uso:
#   make build-robot KEY="rf_sec_xxxx"
#   make build-robot KEY="rf_sec_xxxx" HEADLESS=false
build-robot:
	cd robot-standalone && node build/build.js --key "$(KEY)" --robot-key "$(ROBOT_KEY)" --headless "$(HEADLESS)" --api-url "$(API_URL)"

# Limpa pastas de build anteriores (PowerShell)
clean:
	powershell -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue robot-standalone\dist, robot-standalone\dist-bundle, robot-standalone\dist-obf, robot-standalone\dist-jsc"
