#!/usr/bin/env bash
# Tábula — redefinir a senha de um usuário (com a mesa FECHADA):  ./redefinir-senha.sh
cd "$(dirname "$0")" || exit 1
if [ -z "$TABULA_DATA" ]; then
  if [ -d ../campanha ]; then TABULA_DATA="$(cd ../campanha && pwd)"; else TABULA_DATA="$(pwd)/data"; fi
fi
export TABULA_DATA
exec node tools/redefinir-senha.js
