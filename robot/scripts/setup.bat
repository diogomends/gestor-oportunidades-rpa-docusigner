@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion

set "LOG_FILE=%~dp0setup.log"
echo [SETUP] Iniciando verificacao e instalacao do ambiente do Robo RPA DocuSign... > "!LOG_FILE!"
echo Data/Hora: %DATE% %TIME% >> "!LOG_FILE!"

echo ================================================================
echo   INSTALADOR DE DEPENDENCIAS - ROBO RPA DOCUSIGN
echo ================================================================
echo.

echo [1/3] Verificando se o navegador Chromium ja esta instalado...
echo [INFO] Verificando "%LOCALAPPDATA%\ms-playwright\chromium-*" >> "!LOG_FILE!"

set "CHROMIUM_FOUND=0"
set "CHROMIUM_DIR="

for /d %%D in ("%LOCALAPPDATA%\ms-playwright\chromium-*") do (
    set "CHROMIUM_FOUND=1"
    set "CHROMIUM_DIR=%%D"
)

if "!CHROMIUM_FOUND!"=="1" (
    echo [SUCESSO] Chromium detectado em: !CHROMIUM_DIR!
    echo [SUCESSO] Chromium detectado em: !CHROMIUM_DIR! >> "!LOG_FILE!"
) else (
    echo [INFO] Chromium nao encontrado em %LOCALAPPDATA%\ms-playwright.
    echo [2/3] Instalando o navegador Chromium via Playwright...
    echo [INFO] Executando: npx playwright install chromium >> "!LOG_FILE!"

    npx playwright install chromium >> "!LOG_FILE!" 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERRO] Falha ao instalar o Chromium via Playwright (Codigo de erro: %ERRORLEVEL%).
        echo [ERRO] Falha ao instalar o Chromium via Playwright (Codigo: %ERRORLEVEL%) >> "!LOG_FILE!"
        echo [INFO] Testando conectividade com a internet...
        ping -n 1 8.8.8.8 > nul 2>&1
        if %ERRORLEVEL% NEQ 0 (
            echo [ALERTA] Falha de conexao com a internet. Verifique sua rede e proxy.
            echo [ALERTA] Falha no teste de ping para 8.8.8.8 >> "!LOG_FILE!"
        ) else (
            echo [INFO] Conexao com a internet OK. Verifique se o Node.js/NPX estao instalados e com permissao de execucao.
            echo [INFO] Conexao OK, possivel problema de permissao ou configuracao do NPX. >> "!LOG_FILE!"
        )
        echo.
        echo Consulte o arquivo de log para mais detalhes: "!LOG_FILE!"
        echo.
        echo ================================================================
        echo   A INSTALACAO NAO PODE SER CONCLUIDA COM SUCESSO.
        echo ================================================================
        echo.
        pause
        exit /b 1
    )

    echo [SUCESSO] Chromium instalado com exito!
    echo [SUCESSO] Chromium instalado com exito via npx playwright install chromium >> "!LOG_FILE!"
)

echo.
echo [3/3] Configurando inicializacao automatica com o Windows...
echo [INFO] Configurando chave de inicializacao no Registro HKCU... >> "!LOG_FILE!"

set "RUN_BAT=%~dp0run.bat"
if exist "!RUN_BAT!" (
    reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "DocuSignerRobot" /t REG_SZ /d "\"!RUN_BAT!\"" /f >> "!LOG_FILE!" 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [SUCESSO] Inicializacao automatica com o Windows configurada com sucesso.
        echo [SUCESSO] Registro HKCU atualizado com "!RUN_BAT!" >> "!LOG_FILE!"
    ) else (
        echo [ALERTA] Nao foi possivel registrar a inicializacao automatica no Registro (Codigo: %ERRORLEVEL%).
        echo [ALERTA] Falha ao registrar chave no Registro >> "!LOG_FILE!"
    )
) else (
    echo [ALERTA] Arquivo run.bat nao encontrado em %~dp0. Pulando registro de inicializacao automatica.
    echo [ALERTA] Arquivo run.bat nao encontrado >> "!LOG_FILE!"
)

:finalizar
echo.
echo ================================================================
echo   [SUCESSO] O robo esta pronto e configurado para inicializar com o Windows!
echo   Para iniciar agora manualmente, execute: run.bat
echo ================================================================
echo.
echo [FIM] Processo de setup concluido com sucesso. >> "!LOG_FILE!"
pause
