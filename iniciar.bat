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

rem já tem outra mesa aberta nesta porta?
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" /C:":%PORT% .*ESCUTANDO" >nul
if not errorlevel 1 goto emuso

rem A campanha fica numa pasta "campanha" AO LADO das pastas de versão
rem (tabula_v0, tabula_v1, ...), para todas as versões usarem a mesma.
if not defined TABULA_DATA set "TABULA_DATA=%~dp0..\campanha"
if not exist "%TABULA_DATA%\campaign.json" if exist "%~dp0data\campaign.json" (
  echo  Copiando a campanha desta pasta para a pasta compartilhada "campanha"...
  xcopy "%~dp0data" "%TABULA_DATA%\" /E /I /Y /Q >nul
)
echo.
echo  Campanha salva em: %TABULA_DATA%

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

:emuso
echo.
echo  Já existe uma mesa aberta neste computador, na porta %PORT%.
echo  Feche a outra janela da mesa. Se não achar, rode no Prompt de Comando:
echo     taskkill /IM node.exe /F
echo.
pause
exit /b 1

:falhou
echo.
echo  Algo deu errado na instalação. Tire um print desta janela.
pause
exit /b 1
