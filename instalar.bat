@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Tábula - instalação

where node >nul 2>nul
if errorlevel 1 goto semnode

echo.
echo  Instalando o que a Tábula precisa. Só é preciso fazer isso uma vez...
echo.
call npm install
if errorlevel 1 goto falhou

echo.
echo  Pronto! Agora dê dois cliques em iniciar.bat ou online.bat
echo.
pause
exit /b 0

:semnode
echo.
echo  O Node.js não está instalado neste computador.
echo  Vou abrir o site: baixe a versão LTS e instale com as opções padrão.
echo  Depois feche esta janela e rode o instalar.bat de novo.
echo.
start "" https://nodejs.org
pause
exit /b 1

:falhou
echo.
echo  Algo deu errado na instalação. Tire um print desta janela.
echo.
pause
exit /b 1
