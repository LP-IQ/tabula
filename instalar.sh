#!/usr/bin/env bash
# Tábula — instalação (Linux e Mac). Rode uma vez:  ./instalar.sh
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  O Node.js não está instalado neste computador."
  echo "  Instale a versão LTS (18 ou mais nova). Alguns jeitos:"
  echo "    Ubuntu/Debian/Mint:  https://nodejs.org/pt/download (opção 'Linux', com nvm)"
  echo "    Fedora:              sudo dnf install nodejs"
  echo "    Arch/Manjaro:        sudo pacman -S nodejs npm"
  echo "    Mac (Homebrew):      brew install node"
  echo "  Depois rode ./instalar.sh de novo."
  echo
  exit 1
fi

if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"; then
  echo
  echo "  O Node.js deste computador é antigo ($(node --version)). A Tábula precisa da versão 18 ou mais nova."
  echo "  No Ubuntu/Debian, o 'apt install nodejs' costuma trazer uma versão velha:"
  echo "  instale pelo site https://nodejs.org/pt/download (opção 'Linux', com nvm)."
  echo
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo
  echo "  O Node.js está instalado, mas falta o npm. No Ubuntu/Debian: sudo apt install npm"
  echo
  exit 1
fi

echo
echo "  Instalando o que a Tábula precisa. Só é preciso fazer isso uma vez..."
echo
if ! npm install --no-audit --no-fund; then
  echo
  echo "  Algo deu errado na instalação. Copie as mensagens acima e mande para quem cuida da mesa."
  exit 1
fi
chmod +x ./*.sh 2>/dev/null

echo
echo "  Pronto! Para abrir a mesa:"
echo "    ./iniciar.sh   jogar em casa (mesma rede/Wi-Fi)"
echo "    ./online.sh    jogar pela internet"
echo
