# Instalação e uso no Windows

> Os **jogadores não instalam nada**: abrem o link no navegador (Chrome, Edge, Firefox ou celular).
> Este guia é para quem **hospeda** a mesa, ou seja, o mestre.

## 1. Instalar (uma vez só)

1. Instale o **Node.js**, versão **LTS**, em <https://nodejs.org>, com as opções padrão.
2. Organize as pastas assim (o nome da pasta de fora pode ser qualquer um):

   ```
   tabula\
   ├── campanha\      ← criada sozinha na primeira vez; é onde a campanha mora
   ├── Tabula_v2\     ← a versão que você usa
   └── Tabula_v1\     ← versões antigas, se quiser guardar
   ```

3. Dentro da pasta da versão, dê dois cliques em **`instalar.bat`** e espere aparecer "Pronto!".

> Se o Windows mostrar "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo**.

## 2. Abrir a mesa

| Atalho | Quando usar |
|---|---|
| `iniciar.bat` | Todos na mesma casa / mesmo Wi-Fi, ou só você testando |
| `online.bat` | Amigos jogando de outras casas |

A janela preta precisa ficar **aberta** durante o jogo. Minimizar pode; fechar encerra a mesa.

Na primeira vez, a mesa pede para você criar a **conta do mestre** (nome e senha). **Anote a senha.**

## 3. Jogar online

1. Abra o **`online.bat`**. Na primeira vez, ele tenta instalar o `cloudflared` sozinho; se conseguir, feche a janela e abra de novo.
2. Ele abre **duas janelas**: a da mesa e a do túnel.
3. Na janela do **túnel**, procure uma caixinha assim:

   ```
   |  Your quick Tunnel has been created! Visit it at ...   |
   |  https://palavras-aleatorias.trycloudflare.com          |
   ```

4. Mande **esse link** para os jogadores (selecione com o mouse e aperte Enter para copiar).

> ⚠ **O link muda toda vez** que você abre o `online.bat`. Mande o novo a cada sessão.
>
> Antes de mandar, teste o link no celular **com o Wi-Fi desligado** (usando os dados móveis).

Se o `cloudflared` não instalar sozinho, baixe `cloudflared-windows-amd64.exe` em
<https://github.com/cloudflare/cloudflared/releases/latest>, renomeie para `cloudflared.exe` e
coloque na pasta da versão.

## 4. Jogar presencialmente

- Abra o **`iniciar.bat`**. A janela mostra o endereço **"Na mesma rede/Wi-Fi"** (ex.: `http://192.168.15.55:3000`).
- Todos no mesmo Wi-Fi abrem esse endereço no celular.
- Na primeira vez, o Windows pergunta sobre o firewall: permita em **redes privadas**.
- Para uma **TV** mostrando só o mapa: crie um usuário do tipo **Telão (só assiste)** e entre com ele no navegador da TV.

## 5. Fechar a mesa

Qualquer um destes salva a campanha e cria um ponto de backup:

- No navegador: **Mestre → Sessão e backups → ⏻ Salvar e encerrar a sessão** (avisa os jogadores na tela deles).
- Na janela preta: **Ctrl + C**, ou fechar no **X**.

## Onde fica a campanha

```
campanha\
├── campaign.json          ← a campanha inteira (salva a cada alteração)
├── campaign.backup.json   ← cópia de como estava quando a mesa abriu
├── backups\               ← pontos de backup datados (abertura, a cada 30 min, encerramento…)
└── uploads\               ← mapas e imagens enviadas
```

- Para fazer uma cópia de segurança, copie a pasta `campanha` inteira (Google Drive, pendrive…).
- Para levar para outro computador, leve a pasta `campanha` junto e coloque ao lado da pasta da versão.

## Atualizar para uma versão nova

1. Feche a mesa.
2. Extraia a versão nova (ex.: `Tabula_v3`) **ao lado** das outras, na mesma pasta onde está a `campanha`.
3. Dentro dela, rode `instalar.bat` e depois `iniciar.bat`.

A versão nova abre a mesma campanha. Se algo der errado, é só voltar a usar a pasta da versão anterior.

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| `EADDRINUSE` ou "Já tem uma mesa aberta" | Outra mesa está aberta. Feche a outra janela preta. Se não achar, abra o Prompt de Comando e rode `taskkill /IM node.exe /F` |
| "O Node.js não está instalado" logo depois de instalar | Feche e abra o `.bat` de novo. Se continuar, reinicie o computador |
| Esqueci a senha do mestre | Feche a mesa e dê dois cliques em **`redefinir-senha.bat`**: escolha o usuário e digite a senha nova |
| Esqueci a senha de um jogador | Mestre → Jogadores e personagens → 🔑 ao lado do nome |
| Token "não aparece" ou fica minúsculo | A grade não bate com o mapa. Mestre → **Cena ativa (grade)** → informe **Quadrados na largura** |
| Jogadores não conseguem entrar pelo link | Confira se as duas janelas (mesa e túnel) estão abertas e se mandou o link desta sessão |
| Celulares no Wi-Fi não entram | Permita o Node.js no firewall do Windows (redes privadas) |
