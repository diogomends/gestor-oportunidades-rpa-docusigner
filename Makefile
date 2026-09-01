ifneq (,$(wildcard ./.env.dev))
  include .env.dev
  export
else
  ifneq (,$(wildcard ./.env))
    include .env
    export
  endif
endif

# Defaults (override via .env ou command-line: make VAR=valor)
DEPLOY_HOST ?= root@165.227.212.57
DEPLOY_KEY ?= C:\Users\Convidade\.ssh\deploy_key
DEPLOY_KEY_PATH ?=
REMOTE_PROJECT_PATH ?= /home/appuser/servidor-unity-rce/gestor-oportunidades-rpa-docusigner
REMOTE_UPLOADS_PATH ?= /home/appuser/servidor-unity-rce/gestor-oportunidades/uploads
HEADLESS ?= true

ifeq ($(OS),Windows_NT)
    SHELL := cmd.exe
    SCP_BIN := C:\Windows\Sysnative\OpenSSH\scp.exe
    SSH_BIN := C:\Windows\Sysnative\OpenSSH\ssh.exe
    SSH_OPTS = -i $(DEPLOY_KEY) -o StrictHostKeyChecking=no
    SSH_TUNNEL = powershell -Command "$(SSH_BIN) $(SSH_OPTS) -L 27018:127.0.0.1:27017 $(DEPLOY_HOST) -N"
    SSH_EXEC = powershell -Command "Get-Content tools/db-and-collection.js | $(SSH_BIN) $(SSH_OPTS) $(DEPLOY_HOST) 'docker exec -i app_docusigner node -'"
    SSH_EXEC_CHECK_JOBS = powershell -Command "Get-Content tools/check-pending-jobs.js | $(SSH_BIN) $(SSH_OPTS) $(DEPLOY_HOST) 'docker exec -i app_docusigner node -'"
else
    SCP_BIN := scp
    SSH_BIN := ssh
    SSH_OPTS = -o StrictHostKeyChecking=no
    SSH_TUNNEL = ssh $(SSH_OPTS) -L 27018:127.0.0.1:27017 $(DEPLOY_HOST) -N
    SSH_EXEC = cat tools/db-and-collection.js | ssh $(SSH_OPTS) $(DEPLOY_HOST) "docker exec -i app_docusigner node -"
    SSH_EXEC_CHECK_JOBS = cat tools/check-pending-jobs.js | ssh $(SSH_OPTS) $(DEPLOY_HOST) "docker exec -i app_docusigner node -"
endif

.PHONY: help dev start test test-headed test-headed-ps build-robot execute-robot execute-robot-query execute-robot-update install install-backend install-robot clean clean-test clean-all up-dev up-prod down logs reset tunnel check-pending-jobs check-pending-jobs-prod db-and-collection db-and-collection-prod mongosh-contracts mongosh-contracts-prod mongosh-jobs mongosh-jobs-prod mongosh-instances mongosh-instances-prod mongosh-config mongosh-config-prod fetch-robot-debug-images ssh-uploads-prod ls-uploads-prod routes-inventory routes-inventory-check opencode-switcher opencode-conta1 opencode-conta2

help:
	@echo "Makefile - Gestor de Oportunidades RPA DocuSigner"
	@echo ""
	@echo "Uso: make <comando> [VAR=valor]"
	@echo ""
	@echo "--- Desenvolvimento e Servidor ---"
	@echo "  make dev             - Inicia o servidor em modo desenvolvimento (nodemon)"
	@echo "  make start           - Inicia o servidor em modo producao (node server.js)"
	@echo "  make test            - Roda os testes nativos (node --test)"
	@echo "  make test-headed     - Testa o robo standalone com navegador visivel (sh/bash)"
	@echo "  make test-headed-ps  - Testa o robo standalone com navegador visivel (PowerShell)"
	@echo "  make build-robot     - Gera executaveis .exe dos robos standalone com chave(s) embutida(s) (ROLE=query|update|all)"
	@echo "  make execute-robot   - Executa os robos de consulta e atualizacao (robot-query-1 e robot-update-1)"
	@echo "  make execute-robot-query  - Executa apenas o robo de consulta (robot-query-1)"
	@echo "  make execute-robot-update - Executa apenas o robo de atualizacao (robot-update-1)"
	@echo "  make install         - Instala dependencias do servidor e do standalone"
	@echo "  make install-backend - Instala apenas dependencias do backend"
	@echo "  make install-robot   - Instala apenas dependencias do standalone"
	@echo ""
	@echo "--- Docker ---"
	@echo "  make up-dev          - Sobe containers Docker em desenvolvimento"
	@echo "  make up-prod         - Sobe containers Docker em producao"
	@echo "  make down            - Para todos os containers Docker"
	@echo "  make logs            - Acompanha logs do Docker Compose"
	@echo "  make reset           - Reinicia stack Docker limpa"
	@echo ""
	@echo "--- Banco de Dados e Diagnostico ---"
	@echo "  make check-pending-jobs      - Diagnostico de jobs pendentes e contratos elegiveis (local)"
	@echo "  make check-pending-jobs-prod - Diagnostico de jobs pendentes no container de producao"
	@echo "  make tunnel          - Abre tunel SSH para o MongoDB remoto (porta 27018)"
	@echo "  make db-and-collection      - Lista bancos e colecoes do MongoDB (local)"
	@echo "  make db-and-collection-prod - Lista bancos e colecoes no container de producao"
	@echo "  make mongosh-contracts      - Consulta contratos via mongosh local"
	@echo "  make mongosh-contracts-prod - Consulta contratos no servidor remoto (requer tunnel ativo)"
	@echo "  make mongosh-jobs           - Consulta jobs do robo via mongosh local"
	@echo "  make mongosh-jobs-prod      - Consulta jobs do robo no servidor remoto (requer tunnel ativo)"
	@echo "  make mongosh-instances      - Consulta instancias do robo via mongosh local"
	@echo "  make mongosh-instances-prod - Consulta instancias do robo no servidor remoto (requer tunnel ativo)"
	@echo "  make mongosh-config         - Consulta config do robo via mongosh local"
	@echo "  make mongosh-config-prod    - Consulta config do robo no servidor remoto (requer tunnel ativo)"
	@echo ""
	@echo "--- Arquivos e Uploads Remotos ---"
	@echo "  make ssh-uploads-prod   - Abre sessao SSH interativa direto na pasta uploads/ em producao"
	@echo "  make ls-uploads-prod    - Lista diretorios e arquivos da pasta uploads/ em producao (use DIR=...)"
	@echo ""
	@echo "--- Utilitarios e Logs do Robo ---"
	@echo "  make fetch-robot-debug-images - Baixa screenshots de debug do container de producao para tmp/robot-debug/"
	@echo "  make routes-inventory         - Gera inventario de rotas HTTP em .specs/routes-inventory.md"
	@echo "  make routes-inventory-check   - Valida se o inventario de rotas esta atualizado (CI)"
	@echo "  make clean                    - Limpa pastas de build do robo"
	@echo "  make clean-test               - Limpa artefatos temporarios de testes"
	@echo "  make clean-all                - Limpeza completa (build, logs e node_modules)"
	@echo ""
	@echo "--- OpenCode Account Switcher ---"
	@echo "  make opencode-switcher        - Abre o menu interativo do alternador de contas OpenCode"
	@echo "  make opencode-conta1          - Ativa diretamente a Conta 1 no OpenCode"
	@echo "  make opencode-conta2          - Ativa diretamente a Conta 2 no OpenCode"
	@echo ""
	@echo "EXEMPLOS DE BUILD COM CHAVE EMBUTIDA:"
	@echo "  1. Build Automatico Multi-Chave: make build-robot"
	@echo "  2. Build com chave especifica:   make build-robot KEY=\"rf_sec_xxxx\" HEADLESS=true"
	@echo "  3. Build com API especifica:     make build-robot KEY=\"rf_sec_xxxx\" API_URL=\"https://crm.meudominio.com\""
	@echo "  4. Build por papel:              make build-robot ROLE=query  | make build-robot ROLE=update | make build-robot ROLE=all"

## Desenvolvimento

dev:
	npm run dev

start:
	npm start

test:
	npm test

test-headed:
	cd robot && HEADLESS=false node src/main.js

test-headed-ps:
	powershell -Command "cd robot; $$env:HEADLESS='false'; node src/main.js"

build-robot:
	cd robot && node build/build.js --key "$(KEY)" --headless "$(HEADLESS)" --api-url "$(API_URL)" --role "$(or $(ROLE),all)"

execute-robot:
	powershell -Command "Start-Process cmd.exe -ArgumentList '/c', 'run.bat' -WorkingDirectory (Join-Path (Get-Location) 'robot\dist\robot-query-1'); Start-Process cmd.exe -ArgumentList '/c', 'run.bat' -WorkingDirectory (Join-Path (Get-Location) 'robot\dist\robot-update-1')"

execute-robot-query:
	powershell -Command "Start-Process cmd.exe -ArgumentList '/c', 'run.bat' -WorkingDirectory (Join-Path (Get-Location) 'robot\dist\robot-query-1')"

execute-robot-update:
	powershell -Command "Start-Process cmd.exe -ArgumentList '/c', 'run.bat' -WorkingDirectory (Join-Path (Get-Location) 'robot\dist\robot-update-1')"

## Dependências

install:
	npm install
	cd backend && npm install
	cd robot && npm install

install-backend:
	cd backend && npm install

install-robot:
	cd robot && npm install

## Docker

up-dev:
	docker compose up -d --build

up-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

reset: down clean-all up-dev

## Banco de Dados

tunnel:
	@echo Abrindo tunel SSH seguro com a producao na porta 27018...
	@echo Mantenha este terminal aberto para realizar as consultas.
	$(SSH_TUNNEL)

check-pending-jobs:
	node tools/check-pending-jobs.js

check-pending-jobs-prod:
	$(SSH_EXEC_CHECK_JOBS)

db-and-collection:
	node tools/db-and-collection.js

db-and-collection-prod:
	$(SSH_EXEC)

mongosh-contracts:
	mongosh "mongodb://localhost:27017/crm_contracts" --eval "db.contracts.find().pretty()"

mongosh-contracts-prod:
	@echo "Requer tunnel ativo em outra janela (make tunnel)"
	mongosh --host localhost --port 27018 -u admin -p "Ssl@7056" --authenticationDatabase admin crm_contracts --eval "db.contracts.find().pretty()"

mongosh-jobs:
	mongosh "mongodb://localhost:27017/crm_contracts" --eval "db.robot_jobs.find().sort({createdAt: -1}).limit(10).pretty()"

mongosh-jobs-prod:
	@echo "Requer tunnel ativo em outra janela (make tunnel)"
	mongosh --host localhost --port 27018 -u admin -p "Ssl@7056" --authenticationDatabase admin crm_contracts --eval "db.robot_jobs.find().sort({createdAt: -1}).limit(10).pretty()"

mongosh-instances:
	mongosh "mongodb://localhost:27017/crm_contracts" --eval "db.robot_instances.find().sort({last_heartbeat: -1}).pretty()"

mongosh-instances-prod:
	@echo "Requer tunnel ativo em outra janela (make tunnel)"
	mongosh --host localhost --port 27018 -u admin -p "Ssl@7056" --authenticationDatabase admin crm_contracts --eval "db.robot_instances.find().sort({last_heartbeat: -1}).pretty()"

mongosh-config:
	mongosh "mongodb://localhost:27017/db_crm_funil" --eval "db.systemconfigs.find({ key: 'robot_docusign' }).pretty()"

mongosh-config-prod:
	@echo "Requer tunnel ativo em outra janela (make tunnel)"
	mongosh --host localhost --port 27018 -u admin -p "Ssl@7056" --authenticationDatabase admin db_crm_funil --eval "db.systemconfigs.find({ key: 'robot_docusign' }).pretty()"

## Arquivos e Uploads Remotos

ssh-uploads-prod:
	powershell -Command "& '$(SSH_BIN)' $(SSH_OPTS) -t $(DEPLOY_HOST) 'cd $(REMOTE_UPLOADS_PATH) && exec bash -i'"

ls-uploads-prod:
	powershell -Command "& '$(SSH_BIN)' $(SSH_OPTS) $(DEPLOY_HOST) 'cd $(REMOTE_UPLOADS_PATH) && ls -la $(DIR)'"

## Utilitários e Logs

fetch-robot-debug-images:
	powershell -Command "if (!(Test-Path -Path 'tmp\robot-debug')) { New-Item -ItemType Directory -Path 'tmp\robot-debug' -Force | Out-Null }"
	powershell -Command "& '$(SSH_BIN)' $(SSH_OPTS) $(DEPLOY_HOST) \"docker exec app_docusigner mkdir -p /app/tmp/robot-debug && mkdir -p $(REMOTE_PROJECT_PATH)/tmp/robot-debug && docker cp app_docusigner:/app/tmp/robot-debug/. $(REMOTE_PROJECT_PATH)/tmp/robot-debug/\""
	powershell -Command "& '$(SCP_BIN)' $(SSH_OPTS) -r $(DEPLOY_HOST):$(REMOTE_PROJECT_PATH)/tmp/robot-debug/* tmp/robot-debug/"

routes-inventory:
	node tools/generate-routes-inventory.js

routes-inventory-check:
	node tools/generate-routes-inventory.js --check

clean:
	powershell -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue robot\dist, robot\dist-bundle, robot\dist-obf, robot\dist-jsc"

clean-test:
	powershell -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue test-results, playwright-report, tmp\test-results"

clean-all: clean clean-test
	powershell -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules, backend\node_modules, robot\node_modules"

## OpenCode Switcher

opencode-switcher:
	powershell -Command "& 'C:\www\opencode-switcher\opencode-switcher.exe'"

opencode-conta1:
	powershell -Command "& 'C:\www\opencode-switcher\opencode-conta1.exe'"

opencode-conta2:
	powershell -Command "& 'C:\www\opencode-switcher\opencode-conta2.exe'"
