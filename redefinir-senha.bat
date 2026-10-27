@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Tábula - redefinir senha
if not defined TABULA_DATA set "TABULA_DATA=%~dp0..\campanha"
node tools\redefinir-senha.js
pause
