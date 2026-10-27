#!/usr/bin/env bash
# Tábula — atualizar para a versão mais nova do GitHub (Linux e Mac):  ./atualizar.sh
# A campanha não é tocada (ela fica na pasta "campanha", ao lado desta).
# Todo o script fica dentro de { } para o bash lê-lo inteiro antes de começar:
# assim ele pode ser substituído pela versão nova sem problema.
{
set -u
cd "$(dirname "$0")" || exit 1
PASTA="$(pwd)"
PAI="$(cd .. && pwd)"
PORT="${PORT:-3000}"
REPO="${TABULA_REPO:-https://github.com/LP-IQ/tabula}"
URL="$REPO/archive/refs/heads/main.tar.gz"
TMPD="$(mktemp -d "${TMPDIR:-/tmp}/tabula-atualizacao.XXXXXX")"
limpar() { rm -rf "$TMPD"; }
trap limpar EXIT

echo
echo "  ===== Atualizar a Tábula ====="
echo "  Pasta: $PASTA"

if ! command -v node >/dev/null 2>&1; then
  echo "  O Node.js não está instalado. Rode primeiro o ./instalar.sh"
  exit 1
fi
ATUAL="$(node -p "require('./package.json').version" 2>/dev/null || echo 0)"
echo "  Versão instalada: $ATUAL"
echo

if PORT="$PORT" node -e "const s=require('net').connect(process.env.PORT,'127.0.0.1');s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1))"; then
  echo "  A mesa está aberta agora (porta $PORT)."
  echo "  Feche a mesa (Ctrl + C no terminal dela) e rode de novo."
  exit 1
fi

echo "  1/4  Baixando a versão mais nova do GitHub..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$TMPD/main.tar.gz"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$URL" -O "$TMPD/main.tar.gz"
else
  echo "  Preciso do curl ou do wget (ex.: sudo apt install curl)."
  exit 1
fi
if [ $? -ne 0 ] || ! tar -xzf "$TMPD/main.tar.gz" -C "$TMPD" 2>/dev/null; then
  echo "  Não consegui baixar a versão nova. Confira a internet e tente de novo."
  echo "  Ou baixe à mão: $URL"
  exit 1
fi
NOVO="$(find "$TMPD" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [ ! -f "$NOVO/server.js" ]; then
  echo "  O arquivo baixado não parece ser da Tábula."
  exit 1
fi
NOVA="$(node -p "require(process.argv[1]).version" "$NOVO/package.json")"
echo "       Versão no GitHub: $NOVA"

# só atualiza se a do GitHub for mais nova
if ! node -e "
  const [a, b] = process.argv.slice(1).map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) { if ((b[i] || 0) !== (a[i] || 0)) process.exit((b[i] || 0) > (a[i] || 0) ? 0 : 1); }
  process.exit(1);" "$ATUAL" "$NOVA"; then
  echo
  echo "  Você já está na versão mais nova. Nada a fazer."
  exit 0
fi

if [ "$PASTA" = "$PAI/Tabula_anterior" ]; then
  echo "  Esta pasta é a própria Tabula_anterior. Renomeie a pasta (ex.: Tabula) e rode de novo."
  exit 1
fi
echo "  2/4  Guardando uma cópia desta versão em $PAI/Tabula_anterior ..."
rm -rf "$PAI/Tabula_anterior"
mkdir -p "$PAI/Tabula_anterior"
tar -cf - --exclude=./node_modules --exclude=./data --exclude=./cloudflared . | tar -xf - -C "$PAI/Tabula_anterior" || { echo "  Não consegui fazer a cópia."; exit 1; }

echo "  3/4  Copiando os arquivos novos..."
# só a pasta data da raiz fica de fora (public/data é do programa)
( cd "$NOVO" && tar -cf - --exclude=./data --exclude=./node_modules . ) | tar -xf - -C "$PASTA" || { echo "  Não consegui copiar."; exit 1; }
chmod +x "$PASTA"/*.sh 2>/dev/null

echo "  4/4  Instalando o que for preciso (npm install)..."
npm install --no-audit --no-fund || {
  echo
  echo "  Algo deu errado no npm install. A versão anterior está em $PAI/Tabula_anterior"
  exit 1
}

echo
echo "  Pronto! A Tábula foi de $ATUAL para $NOVA."
echo "  A campanha não foi mexida: ela fica na pasta \"campanha\", ao lado desta."
echo "  Se algo der errado, a versão anterior está em $PAI/Tabula_anterior"
echo "  Agora é só abrir a mesa com ./iniciar.sh ou ./online.sh"
exit 0
}
