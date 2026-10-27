@echo off
chcp 65001 >nul
setlocal
title Tábula - atualizar

rem Este arquivo se copia para a pasta temporária e roda de lá, para poder
rem ser substituído pela versão nova sem atrapalhar o Windows.
if /i not "%~1"=="--de-temp" (
  copy /y "%~f0" "%TEMP%\tabula-atualizar.bat" >nul
  rem sem "call": o controle passa de vez para a cópia
  "%TEMP%\tabula-atualizar.bat" --de-temp "%~dp0."
)

set "PASTA=%~f2"
for %%I in ("%PASTA%\..") do set "PAI=%%~fI"
set "ZIP=%TEMP%\tabula-main.zip"
set "TMPD=%TEMP%\tabula-atualizacao"
set "URL=https://github.com/LP-IQ/tabula/archive/refs/heads/main.zip"
if not defined PORT set PORT=3000
cd /d "%PASTA%"

echo.
echo  ===== Atualizar a Tábula =====
echo  Pasta: %PASTA%
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version" 2^>nul`) do set "ATUAL=%%v"
if defined ATUAL echo  Versão instalada: %ATUAL%
echo.

where node >nul 2>nul
if errorlevel 1 goto semnode

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" /C:":%PORT% .*ESCUTANDO" >nul
if not errorlevel 1 goto aberta

echo  1/4  Baixando a versão mais nova do GitHub...
if exist "%ZIP%" del /q "%ZIP%"
if exist "%TMPD%" rmdir /s /q "%TMPD%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = 'Tls12'; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -UseBasicParsing '%URL%' -OutFile '%ZIP%'; Expand-Archive -Force '%ZIP%' '%TMPD%'"
if errorlevel 1 goto semrede
if not exist "%TMPD%\tabula-main\server.js" goto semrede
for /f "usebackq delims=" %%v in (`node -p "require(process.argv[1]).version" "%TMPD%\tabula-main\package.json"`) do set "NOVA=%%v"
echo       Versão no GitHub: %NOVA%

if /i "%ATUAL%"=="%NOVA%" (
  echo.
  echo  Você já está na versão mais nova. Nada a fazer.
  goto fim
)

echo  2/4  Guardando uma cópia desta versão em ..\Tabula_anterior ...
robocopy "%PASTA%" "%PAI%\Tabula_anterior" /MIR /XD node_modules "%PASTA%\data" /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto falhou

echo  3/4  Copiando os arquivos novos...
rem /XD com caminho completo: só a pasta data da raiz (public\data é do programa)
robocopy "%TMPD%\tabula-main" "%PASTA%" /E /XD "%TMPD%\tabula-main\data" node_modules .git /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto falhou

echo  4/4  Instalando o que for preciso (npm install)...
call npm install --no-audit --no-fund
if errorlevel 1 goto falhou

rmdir /s /q "%TMPD%" 2>nul
del /q "%ZIP%" 2>nul
echo.
echo  Pronto! A Tábula foi de %ATUAL% para %NOVA%.
echo  A campanha não foi mexida: ela fica na pasta "campanha", ao lado desta.
echo  Se algo der errado, a versão anterior está em ..\Tabula_anterior
echo  Agora é só abrir a mesa com o iniciar.bat ou o online.bat.
goto fim

:aberta
echo  A mesa está aberta agora (porta %PORT%).
echo  Feche a janela da mesa (ou "Salvar e encerrar a sessão") e rode de novo.
goto fim

:semnode
echo  O Node.js não está instalado. Rode primeiro o instalar.bat
goto fim

:semrede
echo.
echo  Não consegui baixar a versão nova. Confira a internet e tente de novo.
echo  Ou baixe à mão: %URL%
goto fim

:falhou
echo.
echo  Algo deu errado. Tire um print desta janela.
echo  A versão anterior está guardada em ..\Tabula_anterior

:fim
echo.
pause
exit /b 0
