@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Tábula - link para os jogadores
if not defined PORT set PORT=3000

where node >nul 2>nul
if errorlevel 1 goto semnode
where cloudflared >nul 2>nul
if errorlevel 1 goto semtunel

rem abre a mesa numa segunda janela
start "Tábula - mesa aberta" cmd /k iniciar.bat

echo.
echo  ============================================================
echo   Abrindo o túnel. Daqui a alguns segundos aparece abaixo um
echo   endereço terminando em .trycloudflare.com
echo.
echo   Mande ESSE endereço para os jogadores.
echo   Deixe as duas janelas abertas durante a sessão.
echo  ============================================================
echo.
cloudflared tunnel --url http://localhost:%PORT%
pause
exit /b 0

:semnode
echo.
echo  O Node.js não está instalado. Rode primeiro o instalar.bat
echo.
pause
exit /b 1

:semtunel
echo.
echo  O cloudflared ainda não está instalado. Tentando instalar pelo winget...
echo.
winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
echo.
echo  Se a instalação deu certo: FECHE esta janela e abra o online.bat de novo.
echo.
echo  Se não deu certo, baixe manualmente o arquivo cloudflared-windows-amd64.exe em
echo  https://github.com/cloudflare/cloudflared/releases/latest
echo  renomeie para cloudflared.exe e coloque nesta mesma pasta.
echo.
pause
exit /b 1
