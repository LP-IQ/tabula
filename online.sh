#!/usr/bin/env bash
# Tábula — jogar pela internet (Linux e Mac):  ./online.sh
# Abre a mesa e um túnel da Cloudflare; mostra o link para mandar aos jogadores.
# Para fechar tudo: Ctrl + C (a campanha é salva).
cd "$(dirname "$0")" || exit 1
export PORT="${PORT:-3000}"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  O Node.js não está instalado. Rode primeiro o ./instalar.sh"
  echo
  exit 1
fi

baixar() {   # baixar URL ARQUIVO
  if command -v curl >/dev/null 2>&1; then curl -fSL --progress-bar -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then wget -q --show-progress -O "$2" "$1"
  else echo "  Preciso do curl ou do wget para baixar (ex.: sudo apt install curl)."; return 1
  fi
}

# ---- cloudflared: no sistema ou nesta pasta; se não tiver, baixa para esta pasta
CF=""
if command -v cloudflared >/dev/null 2>&1; then CF="cloudflared"
elif [ -x ./cloudflared ]; then CF="./cloudflared"
else
  case "$(uname -m)" in
    x86_64|amd64) ARQ=amd64 ;;
    aarch64|arm64) ARQ=arm64 ;;
    armv7l|armv6l) ARQ=arm ;;
    i386|i686) ARQ=386 ;;
    *) ARQ="" ;;
  esac
  BASE="https://github.com/cloudflare/cloudflared/releases/latest/download"
  echo
  echo "  O cloudflared (que cria o link para os jogadores) não está instalado."
  echo "  Baixando para esta pasta. É só desta vez..."
  if [ "$(uname)" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1; then
      brew install cloudflared && CF="cloudflared"
    elif [ -n "$ARQ" ] && baixar "$BASE/cloudflared-darwin-$ARQ.tgz" cloudflared.tgz; then
      tar -xzf cloudflared.tgz && rm -f cloudflared.tgz && chmod +x cloudflared && CF="./cloudflared"
    fi
  elif [ -n "$ARQ" ] && baixar "$BASE/cloudflared-linux-$ARQ" cloudflared.tmp; then
    chmod +x cloudflared.tmp && mv cloudflared.tmp cloudflared && CF="./cloudflared"
  fi
  if [ -z "$CF" ]; then
    rm -f cloudflared.tmp cloudflared.tgz
    echo
    echo "  Não consegui baixar o cloudflared. Instale à mão:"
    echo "  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    echo "  (ou baixe o arquivo do seu sistema em https://github.com/cloudflare/cloudflared/releases/latest,"
    echo "   renomeie para cloudflared, coloque nesta pasta e rode: chmod +x cloudflared)"
    exit 1
  fi
fi

mesa_no_ar() {
  node -e "const s=require('net').connect(process.env.PORT,'127.0.0.1');s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1))"
}

MESA_PID=""
TUNEL_PID=""
encerrar() {
  trap - INT TERM EXIT
  echo
  [ -n "$TUNEL_PID" ] && kill "$TUNEL_PID" 2>/dev/null
  if [ -n "$MESA_PID" ]; then
    echo "  Fechando a mesa e salvando a campanha..."
    kill -INT "$MESA_PID" 2>/dev/null
    wait "$MESA_PID" 2>/dev/null
    tail -n 3 tabula.log | grep -i "salva" | sed 's/^ */  /'
  fi
  echo "  Até a próxima!"
  exit 0
}
trap encerrar INT TERM EXIT

# ---- a mesa: abre em segundo plano (o registro fica em tabula.log)
if mesa_no_ar; then
  echo "  A mesa já está aberta na porta $PORT. Abrindo só o link."
else
  ./iniciar.sh > tabula.log 2>&1 &
  MESA_PID=$!
  for _ in $(seq 1 40); do mesa_no_ar && break; sleep 0.5; done
  if ! mesa_no_ar; then
    echo
    echo "  A mesa não abriu. O que ela disse:"
    sed 's/^/    /' tabula.log
    MESA_PID=""
    exit 1
  fi
  grep -i "campanha salva em" tabula.log | head -n 1 | sed 's/^ */  /'
fi

# ---- o túnel
"$CF" tunnel --no-autoupdate --url "http://localhost:$PORT" > tunel.log 2>&1 &
TUNEL_PID=$!
echo "  Abrindo o link para os jogadores (alguns segundos)..."
LINK=""
for _ in $(seq 1 60); do
  # o link do túnel tem a forma https://palavra-palavra-palavra.trycloudflare.com
  LINK="$(grep -o 'https://[a-z0-9]*-[a-z0-9-]*\.trycloudflare\.com' tunel.log | head -n 1)"
  [ -n "$LINK" ] && break
  kill -0 "$TUNEL_PID" 2>/dev/null || break
  sleep 0.5
done
if [ -z "$LINK" ]; then
  echo
  echo "  O link não apareceu. Confira a internet. O que o cloudflared disse:"
  tail -n 15 tunel.log | sed 's/^/    /'
  exit 1
fi

echo
echo "  ============================================================"
echo "   Mande ESTE endereço para os jogadores:"
echo
echo "     $LINK"
echo
echo "   Você (mestre) pode usar http://localhost:$PORT"
echo "   Deixe este terminal aberto durante a sessão."
echo "   Para encerrar a mesa e o link: Ctrl + C"
echo "  ============================================================"
echo
wait "$TUNEL_PID"
echo "  O link caiu. Rode ./online.sh de novo para ter um novo."
