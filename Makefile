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
	@echo '  1. Build Automatico (le de 1 a 3 chaves configuradas no .env.dev):'
	@echo '    make build-robot'
	@echo ''
	@echo '  2. Single Robot (chave especifica via CLI):'
	@echo '    make build-robot KEY="rpa_sec_xxxx" HEADLESS=true'
	@echo ''
	@echo '  3. Multi-Robot com chaves especificas via CLI:'
	@echo '    make build-robot IDS="robot-01,robot-02,robot-03" \'
	@echo '                     KEYS="rpa_sec_key1,rpa_sec_key2,rpa_sec_key3" \'
	@echo '                     HEADLESS=true'
	@echo ""
	@echo "Variaveis aceitas:"
	@echo "  KEY        Chave de API do robo (padrao: le ROBOT_API_KEY_1/ROBOT_API_KEY do .env.dev)"
	@echo "  KEYS       Chaves de API para multiplos robos separadas por virgula (padrao: le ROBOT_API_KEY_1..3)"
	@echo "  IDS        Identificadores unicos das maquinas (padrao: robot-01..03 ou robot-docusigner)"
	@echo "  HEADLESS   true ou false (padrao: le HEADLESS do .env.dev ou true)"
	@echo "  API_URL    URL central customizada (padrao: le API_URL ou URI_PROD do .env.dev/.env)"

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

# Gera executavel(is) .exe do robo standalone com chave de acesso embutida
# Uso:
#   make build-robot KEY="rpa_sec_xxxx"
#   make build-robot IDS="id1,id2" KEYS="k1,k2" HEADLESS=false
build-robot:
	cd robot-standalone && node build/build.js --ids "$(IDS)" --keys "$(KEYS)" --key "$(KEY)" --robot-key "$(ROBOT_KEY)" --headless "$(HEADLESS)" --api-url "$(API_URL)"

# Limpa pastas de build anteriores (PowerShell)
clean:
	powershell -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue robot-standalone\dist, robot-standalone\dist-bundle, robot-standalone\dist-obf, robot-standalone\dist-jsc"

