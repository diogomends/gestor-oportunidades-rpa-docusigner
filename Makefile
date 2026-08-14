.PHONY: dev test test-headed test-headed-ps build-robot install install-robot clean

# Inicia o servidor em modo desenvolvimento (nodemon)
dev:
	npm run dev

# Roda os testes nativos (node --test)
test:
	npm test

# Instala dependências do servidor e do standalone
install:
	npm install
	cd robot-standalone && npm install

# Instala apenas dependências do standalone
install-robot:
	cd robot-standalone && npm install

# Testa o robô standalone com navegador visível (HEADLESS=false) — sh/bash
test-headed:
	cd robot-standalone && HEADLESS=false node src/main.js

# Testa o robô standalone com navegador visível — PowerShell
test-headed-ps:
	powershell -Command "$$env:HEADLESS='false'; cd robot-standalone; node src/main.js"

# Gera o executável .exe do robô standalone
build-robot:
	cd robot-standalone && npm run build

# Limpa pastas de build anteriores (PowerShell)
clean:
	powershell -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue robot-standalone\dist, robot-standalone\dist-bundle, robot-standalone\dist-obf, robot-standalone\dist-jsc"
