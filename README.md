# Tábula — mesa virtual da nossa campanha

Uma mesa virtual simples, feita para o nosso grupo: o mestre roda no próprio computador
(igual ao Foundry) e os jogadores entram pelo navegador, no PC ou no celular.

**O que tem nesta versão 1**

- **Contas criadas pelo mestre.** Cada jogador entra com o nome e a senha que você definiu, e só mexe no personagem vinculado a ele.
- **Mapa** com imagem de fundo enviada pelo mestre, grade ajustável, zoom e arrasto (mouse, trackpad ou dedos).
- **Tokens redondos com foto.** O jogador só arrasta o dele; o mestre arrasta todos, cria NPCs/monstros, oculta e revela.
- **Ficha 5e simplificada**: atributos, resistências (*Saving Throws*), perícias com proficiência/especialização, PV com dano e cura, ataques, magias, inventário e anotações. Clicar num número rola o dado.
- **Dados no servidor** (ninguém “rola no próprio PC”): `1d20+5`, `2d6+1d4-1`, vantagem/desvantagem, rolagem secreta.
- **Iniciativa**: o jogador rola a dele, o mestre adiciona os tokens da cena (rolagem automática), passa os turnos; a ordem aparece no topo do mapa para todos.
- **Segredos (handouts)**: texto e/ou imagem que o mestre libera para um jogador, alguns ou todos. Quem recebe é avisado na hora, e os outros não veem. Ideal para as memórias voltando na torre.
- **Sinalizar no mapa**: dois cliques (ou dois toques) mostram um círculo para todos.
- **Modo “Telão”**: um usuário que só vê o mapa, para deixar numa TV quando jogarem presencialmente.

---

## 1. Instalar (uma vez só)

1. Instale o **Node.js** (versão 18 ou mais nova): <https://nodejs.org> → versão LTS.
2. Descompacte esta pasta onde quiser (ex.: `Documentos/tabula`).
3. Abra um terminal **dentro da pasta** e rode:

   ```
   npm install
   ```

## 2. Abrir a mesa (toda sessão)

```
npm start
```

O terminal mostra algo como:

```
  Tábula está no ar!
  Neste computador:   http://localhost:3000
  Na mesma rede/Wi-Fi: http://192.168.0.15:3000
```

Deixe esse terminal aberto enquanto jogam. Para fechar a mesa: `Ctrl + C`.

Quer outra porta? `PORT=8080 npm start` (Linux/Mac) ou `set PORT=8080 && npm start` (Windows).

## 3. Primeira vez: configurar

1. Abra `http://localhost:3000` e crie a **conta do mestre** (nome e senha).
2. Aba **Mestre → Jogadores e personagens**: crie um usuário para cada jogador
   (nome + senha). Deixe marcado “Já criar personagem” para criar a ficha vinculada a ele.
3. Aba **Mestre → Cenas**: dê um nome e clique em **Escolher imagem e criar**. A primeira cena já vai ao ar.
4. Em **Cena ativa**, ajuste o tamanho do **Quadrado** até a grade coincidir com a do desenho do mapa.
5. Em **Tokens**, clique **Colocar no mapa** em cada personagem e crie os NPCs/monstros.
6. Mande para cada jogador o endereço, o nome de usuário e a senha.

A foto do token é a foto do personagem: o jogador troca clicando no retrato da ficha.

## 4. Jogar online (amigos em outras casas)

O seu computador precisa ficar acessível pela internet. O jeito mais simples, sem configurar
roteador, é um **túnel do Cloudflare** (gratuito, não precisa de conta):

1. Instale o `cloudflared`:
   - Windows: `winget install --id Cloudflare.cloudflared`
   - Mac: `brew install cloudflared`
   - Linux: veja <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/>
2. Com a mesa aberta (`npm start`), em **outro** terminal:

   ```
   cloudflared tunnel --url http://localhost:3000
   ```

3. Ele mostra um endereço do tipo `https://palavras-aleatorias.trycloudflare.com`.
   Mande esse link aos jogadores. O endereço muda a cada vez que você abre o túnel.

Alternativas: **Tailscale** (cada jogador instala um app; mais privado) ou abrir a porta 3000
no roteador, como no Foundry (muitas operadoras no Brasil usam CGNAT e isso não funciona).

## 5. Jogar presencialmente

- Todos no **mesmo Wi-Fi** abrem no celular o endereço “Na mesma rede/Wi-Fi” que aparece no terminal.
  No celular a tela vira abas embaixo: Mapa, Ficha, Dados, Iniciativa, Segredos.
- Para uma **TV/monitor** mostrando só o mapa: crie um usuário com papel **Telão (só assiste)**
  e entre com ele no navegador da TV.
- Se o Windows perguntar sobre o firewall na primeira vez, permita o acesso em redes privadas.

---

## Atalhos úteis

| Onde | Como |
|---|---|
| Mapa | arrastar o fundo = mover a visão; rodinha/pinça = zoom; ⤢ = ajustar à tela |
| Token | arrastar para mover (encaixa na grade); selecionado + setas do teclado = andar 1 quadrado |
| Sinal | dois cliques/toques no mapa |
| Chat | `1d20+5`, `2d6+3`, `4d6kh3`, `2d20kh1` (vantagem), `2d20kl1` (desvantagem), `/r 1d8+3 machado` |
| Ficha | escolha **Vantagem/Desvantagem** antes de clicar numa perícia; volta ao normal depois da rolagem |
| Mestre | clicar num token abre o painel: nome, tamanho, PV do NPC, ocultar, remover |

Os jogadores veem a barra de vida dos outros personagens, mas a dos monstros não: só um aro
vermelho quando o monstro está com metade da vida ou menos, e cinza quando cai.

## Seus dados

Tudo fica na pasta `data/`:

- `data/campaign.json`: campanha inteira (usuários, fichas, cenas, chat…)
- `data/campaign.backup.json`: cópia automática feita a cada vez que a mesa abre
- `data/uploads/`: mapas e imagens enviadas

Para fazer backup, copie a pasta `data/` (ou use **Mestre → Mesa → Baixar backup**).
Para mudar de computador, leve a pasta `data/` junto.

## Para mexer no código

```
server.js            servidor: login, permissões, tempo real, regras de quem pode o quê
server/dice.js       rolador de dados
server/store.js      leitura/gravação do campaign.json
public/index.html    estrutura da página
public/style.css     visual (cores no topo do arquivo, em :root)
public/js/map.js     mapa e tokens
public/js/sheet.js   ficha
public/js/chat.js    dados e mensagens
public/js/initiative.js, handouts.js, gm.js   iniciativa, segredos, painel do mestre
test/api.test.js     teste automático das permissões (npm test)
```

Sem etapa de compilação: edite o arquivo, recarregue o navegador (e reinicie o `npm start` se
mexer no servidor).

## Ideias para as próximas versões

Névoa de guerra (*fog of war*), régua de distância, desenhos no mapa, ficha de monstros com
ataques prontos, música ambiente, e um painel para liberar as memórias da torre em sequência.
