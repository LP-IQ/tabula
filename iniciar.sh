#!/usr/bin/env bash
# Tábula — abrir a mesa (Linux e Mac):  ./iniciar.sh
# Para fechar: Ctrl + C (a campanha é salva).
cd "$(dirname "$0")" || exit 1
AQUI="$(pwd)"
export PORT="${PORT:-3000}"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  O Node.js não está instalado. Rode primeiro o ./instalar.sh"
  echo
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  Primeira vez: instalando dependências..."
  npm install --no-audit --no-fund || { echo "  Algo deu errado na instalação."; exit 1; }
fi

# já tem uma mesa aberta nesta porta?
if node -e "const s=require('net').connect(process.env.PORT,'127.0.0.1');s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1))"; then
  echo
  echo "  Já existe uma mesa aberta neste computador, na porta $PORT."
  echo "  Feche o outro terminal da mesa. Se não achar, rode:  pkill -f \"node server.js\""
  echo
  exit 1
fi

# A campanha fica numa pasta "campanha" AO LADO da pasta da Tábula,
# para todas as versões usarem a mesma.
if [ -z "$TABULA_DATA" ]; then
  mkdir -p "$AQUI/../campanha"
  TABULA_DATA="$(cd "$AQUI/../campanha" && pwd)"
fi
export TABULA_DATA
if [ ! -f "$TABULA_DATA/campaign.json" ] && [ -f "$AQUI/data/campaign.json" ]; then
  echo "  Copiando a campanha desta pasta para a pasta compartilhada \"campanha\"..."
  cp -R "$AQUI/data/." "$TABULA_DATA/"
fi
echo
echo "  Campanha salva em: $TABULA_DATA"

# abre o navegador 2 segundos depois (se houver tela)
if [ -z "$TABULA_SEM_NAVEGADOR" ]; then
  ABRIR=""
  if [ "$(uname)" = "Darwin" ]; then ABRIR="open"
  elif [ -n "$DISPLAY$WAYLAND_DISPLAY" ] && command -v xdg-open >/dev/null 2>&1; then ABRIR="xdg-open"
  fi
  [ -n "$ABRIR" ] && ( sleep 2; "$ABRIR" "http://localhost:$PORT" >/dev/null 2>&1 ) &
fi

echo
echo "  Deixe este terminal aberto enquanto jogam. Para fechar a mesa: Ctrl + C"
exec node server.js
