@echo off
chcp 65001 > nul
echo ================================================================
echo   INSTALADOR DE DEPENDÊNCIAS - ROBÔ RPA DOCUSIGN
echo ================================================================
echo.
echo [1/2] Verificando e instalando o navegador Chromium (Playwright)...
npx playwright install chromium

echo.
echo [2/2] Criando arquivo de configuracao local a partir do modelo...
if not exist config.json (
    copy config.json.example config.json
    echo Arquivo config.json criado! Por favor, edite com seu ROBOT_ID e credenciais.
) else (
    echo Arquivo config.json ja existe. Mantendo configuracao atual.
)

echo.
echo ================================================================
echo   INSTALAÇÃO CONCLUÍDA COM SUCESSO!
echo   Para iniciar o robo, execute: robot-docusigner.exe
echo ================================================================
echo.
pause
