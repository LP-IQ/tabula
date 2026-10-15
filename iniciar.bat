@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Tábula - mesa aberta
if not defined PORT set PORT=3000

where node >nul 2>nul
if errorlevel 1 goto semnode

if not exist "node_modules" (
  echo  Primeira vez: instalando dependências...
  call npm install
  if errorlevel 1 goto falhou
)

rem abre o navegador 2 segundos depois, quando o servidor já estiver no ar
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 2; Start-Process 'http://localhost:%PORT%'"

echo.
echo  Deixe esta janela aberta enquanto jogam. Para fechar a mesa: Ctrl + C
node server.js
echo.
echo  A mesa foi fechada.
pause
exit /b 0

:semnode
echo.
echo  O Node.js não está instalado. Rode primeiro o instalar.bat
echo.
pause
exit /b 1

:falhou
echo.
echo  Algo deu errado na instalação. Tire um print desta janela.
pause
exit /b 1
