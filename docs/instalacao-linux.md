# Instalação e uso no Linux e no Mac

> Os **jogadores não instalam nada**: abrem o link no navegador, em qualquer sistema.
> Este guia é para quem **hospeda** a mesa num computador com Linux ou macOS.
> No Windows, veja [instalacao.md](instalacao.md).

A mesa é a mesma do Windows; só os atalhos mudam: no lugar dos `.bat` há os `.sh`, que rodam no terminal.

| Windows | Linux e Mac | Para quê |
|---|---|---|
| `instalar.bat` | `./instalar.sh` | instalar (uma vez só) |
| `iniciar.bat` | `./iniciar.sh` | abrir a mesa para jogar em casa |
| `online.bat` | `./online.sh` | abrir a mesa e o link para jogar pela internet |
| `atualizar.bat` | `./atualizar.sh` | baixar a versão nova do GitHub |
| `redefinir-senha.bat` | `./redefinir-senha.sh` | trocar a senha de alguém (com a mesa fechada) |

## 1. Instalar (uma vez só)

1. Instale o **Node.js 18 ou mais novo**:
   - **Ubuntu, Debian, Mint, Pop!_OS**: o `apt install nodejs` costuma trazer uma versão velha.
     Use o instalador do site: <https://nodejs.org/pt/download>, opção *Linux*, com *nvm*.
   - **Fedora**: `sudo dnf install nodejs`
   - **Arch, Manjaro**: `sudo pacman -S nodejs npm`
   - **Mac**: o instalador do site <https://nodejs.org>, ou `brew install node`
2. Baixe a Tábula (<https://github.com/LP-IQ/tabula/archive/refs/heads/main.zip>) e descompacte.
   Organize as pastas assim:

   ```
   tabula/
   ├── campanha/   ← criada sozinha na primeira vez; é onde a campanha mora
   └── Tabula/     ← os arquivos da Tábula
   ```

3. Abra um terminal **dentro da pasta da Tábula** (no gerenciador de arquivos, botão direito →
   *Abrir no terminal*) e rode:

   ```
   ./instalar.sh
   ```

   Se aparecer *Permissão negada*, rode antes `chmod +x *.sh` (alguns descompactadores tiram a permissão
   de execução). Também dá para rodar sem ela: `bash instalar.sh`.

## 2. Abrir a mesa

```
./iniciar.sh
```

O navegador abre sozinho em `http://localhost:3000`. O terminal precisa ficar **aberto** durante o jogo;
**Ctrl + C** fecha a mesa e salva a campanha.

Na primeira vez, a mesa pede para você criar a **conta do mestre** (nome e senha). **Anote a senha.**

## 3. Jogar online

```
./online.sh
```

Na primeira vez, ele baixa o `cloudflared` (o programa que cria o link) para dentro da pasta da Tábula.
Depois abre a mesa e mostra, num quadro, o endereço terminando em **`.trycloudflare.com`**: mande esse
endereço para os jogadores. Você mesmo pode usar `http://localhost:3000`.

Tudo roda num terminal só. **Ctrl + C** fecha o link e a mesa, salvando a campanha.
O que a mesa escreve fica no arquivo `tabula.log`, e o do link em `tunel.log`, se precisar investigar algo.

> O endereço muda a cada vez que você abre o `online.sh`. Mande o novo antes de cada sessão.

## 4. Jogar presencialmente

Rode `./iniciar.sh`. O terminal mostra o endereço **"Na mesma rede/Wi-Fi"** (algo como
`http://192.168.0.12:3000`): os celulares na mesma rede entram por ele. Se não conseguirem,
o firewall pode estar bloqueando a porta 3000 (no Ubuntu: `sudo ufw allow 3000/tcp`).

## 5. Atualizar

Com a mesa fechada:

```
./atualizar.sh
```

Ele só atualiza se a versão do GitHub for mais nova. Antes, guarda uma cópia da versão atual em
`Tabula_anterior` (ao lado); depois copia os arquivos novos e roda o `npm install`. A campanha não é tocada.

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| `Permissão negada` ao rodar um `.sh` | `chmod +x *.sh` na pasta da Tábula, ou rode com `bash nome.sh` |
| "O Node.js deste computador é antigo" | Instale o Node.js pelo site (nvm), não pelo `apt` |
| "Já existe uma mesa aberta" | Feche o outro terminal da mesa. Se não achar: `pkill -f "node server.js"` |
| Esqueci a senha do mestre | Feche a mesa e rode `./redefinir-senha.sh` |
| O link do `online.sh` não aparece | Confira a internet; o motivo fica no fim do `tunel.log` |
| O navegador não abriu sozinho | Abra você mesmo `http://localhost:3000` |
