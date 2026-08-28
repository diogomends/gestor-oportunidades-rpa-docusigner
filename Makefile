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
	@echo "  build-robot     Gera executáveis .exe dos robôs standalone com chave(s) embutida(s)"
	@echo "  clean           Limpa pastas de build anteriores"
	@echo ""
	@echo "EXEMPLOS DE BUILD COM CHAVE EMBUTIDA:"
	@echo "  1. Build Automático Multi-Chave (lê todas as ROBOT_API_KEY_* no .env.dev):"
	@echo "    make build-robot"
	@echo ""
	@echo "  2. Build com chave específica via CLI (gera robot-docusigner-1.exe):"
	@echo "    make build-robot KEY=\"rf_sec_xxxx\" HEADLESS=true"
	@echo ""
	@echo "  3. Build apontando para API específica:"
	@echo "    make build-robot KEY=\"rf_sec_xxxx\" API_URL=\"https://crm.meudominio.com\""
	@echo ""
	@echo "Variáveis aceitas:"
	@echo "  KEY        Chave de API do robô (opcional; se omitida, gera 1 exe por ROBOT_API_KEY_* no .env.dev)"
	@echo "  HEADLESS   true ou false (padrão: lê HEADLESS do .env.dev ou true)"
	@echo "  API_URL    URL central customizada (padrão: lê API_URL ou URI_PROD do .env.dev/.env)"

# Inicia o servidor em modo desenvolvimento (nodemon)
dev:
	npm run dev

# Roda os testes nativos (node --env-file=.env.dev --test test/**/*.test.js)
test:
	npm test

# Instala dependencias do servidor e do robo
install:
	npm install
	cd backend && npm install
	cd robot && npm install

# Instala apenas dependencias do backend
install-backend:
	cd backend && npm install

# Instala apenas dependencias do robo
install-robot:
	cd robot && npm install

# Testa o robo com navegador visivel (HEADLESS=false) — sh/bash
test-headed:
	cd robot && HEADLESS=false node src/main.js

# Testa o robo com navegador visivel — PowerShell
test-headed-ps:
	powershell -Command "cd robot; $$env:HEADLESS='false'; node src/main.js"

# Gera executavel .exe do robo com chave de acesso embutida
# Uso:
#   make build-robot KEY="rf_sec_xxxx"
#   make build-robot KEY="rf_sec_xxxx" HEADLESS=false
build-robot:
	cd robot && node build/build.js --key "$(KEY)" --headless "$(HEADLESS)" --api-url "$(API_URL)"

# Limpa pastas de build anteriores (PowerShell)
clean:
	powershell -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue robot\dist, robot\dist-bundle, robot\dist-obf, robot\dist-jsc"
