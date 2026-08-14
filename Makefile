.PHONY: dev test test-headed test-headed-ps build-robot install install-robot clean

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
	cd robot-standalone; $$env:HEADLESS="false"; node src/main.js

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
