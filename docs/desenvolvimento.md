# Desenvolvimento

Sem etapa de compilação: Node.js no servidor e JavaScript puro (módulos ES) no navegador.
Edite o arquivo, recarregue o navegador; se mexer no servidor, reinicie a mesa.

## Estrutura

```
server.js            HTTP (login, upload, backup) + Socket.IO (tempo real) + regras de permissão
server/store.js      campaign.json: leitura, gravação atômica, pontos de backup, restauração
server/dice.js       rolador de dados (rola no servidor, com crypto.randomInt)
server/world.js      calendário do mundo, névoa (isCovered), condições, padrões novos da ficha
public/index.html    esqueleto da página
public/style.css     visual (cores em :root, no topo)
public/js/
  main.js            login, conexão, abas, distribui o estado para os módulos
  core.js            estado do cliente, emit() com aviso de erro, rolagens d20
  util.js            h() para criar elementos, upload, avatar, lightbox…
  map.js             mapa, grade, tokens, zoom/arrasto/pinça, ping, faixa de iniciativa, condições no token
  tools.js           ferramentas do mapa: régua, áreas de magia, desenho, borracha, névoa
  calendar.js        relógio do mundo no topo, janela do calendário, aviso de versão nova
  sheet.js           ficha 5e e seletor de fichas
  chat.js            dados e mensagens
  initiative.js      rastreador de iniciativa
  handouts.js        segredos e fila de memórias
  journal.js         diário do grupo
  compendium.js      compêndio
  gm.js              painel do mestre (cenas, tokens, usuários, backups)
  bestiary.js        bestiário: bloco de estatísticas, editor, biblioteca SRD, ajuste de ND, colocar no mapa
  rules.js           regras do Livro do Mestre: tabela por ND, XP, dificuldade de encontro, ajuste de ND
docs/index.html      página do projeto (GitHub Pages, servida da pasta docs/)
public/data/srd-monstros.json   334 monstros do SRD 5.1 já convertidos (gerado por tools/srd/converter.py)
test/api.test.js     teste automático do servidor (npm test)
tools/redefinir-senha.js   redefine a senha de um usuário (mesa fechada)
tools/srd/converter.py     converte os monstros do 5e-database para o formato da Tábula (com traduções)
*.bat                atalhos para Windows (instalar, iniciar, online, atualizar, redefinir-senha)
*.sh                 os mesmos atalhos para Linux e Mac (bash; testados também com o dash)
```

## Como funciona

- O servidor guarda **um único objeto** com a campanha e grava em `campaign.json` 400 ms após cada mudança.
- Cada navegador recebe, via Socket.IO, uma **visão filtrada** desse objeto (`viewFor` em `server.js`).
  O jogador nunca recebe o que não pode ver: tokens ocultos, PV de monstros, fichas completas
  dos outros, segredos de outras pessoas, páginas privadas do compêndio, rolagens secretas.
- Ações chegam como eventos (`token:move`, `character:update`, `roll`, …). Cada uma é validada
  no servidor (`handlers` em `server.js`) antes de mudar o estado.
- O movimento de token durante o arrasto usa um evento leve (`token:moved`), sem reenviar o estado inteiro.
  A régua ao vivo também (`measure`), e não é salva.
- **Névoa**: cada cena guarda `fog: { enabled, ops[] }`, uma lista de retângulos/círculos de revelar ou
  esconder aplicados em ordem sobre o mapa coberto. O cliente desenha a lista num `<canvas>`; o servidor usa
  `world.isCovered()` para não mandar aos jogadores os tokens de NPC cujo centro está na névoa.
- **Desenhos** ficam em `scene.drawings[]` (`kind`, `pts` como lista plana `[x1, y1, x2, y2…]`, `userId`, cor).
- **Calendário** em `calendar` (meses, ano, dia, minutos); `world.advance()` cuida da virada de dia, mês e ano.
- Campanhas antigas ganham os campos novos em `migrate()` ao abrir.

## Bestiário e ajuste de ND

- As fichas ficam em `monsters[]` na campanha; só o mestre as recebe (`viewFor`). O token guarda
  `monsterId` e os próprios PV; o jogador nunca recebe o `monsterId`.
- `rescale()` em `rules.js`: CA, ataque e CD por diferença na tabela do Livro do Mestre; PV e dano
  pela razão entre os valores típicos de cada ND (medianas dos 334 monstros do SRD, suavizadas:
  PV ≈ 15·ND + 15 até o ND 20; dano/rodada ≈ 4,5·ND + 5,5).
- Para atualizar a biblioteca: `python3 tools/srd/converter.py 5e-SRD-Monsters.json docs/index.html      página do projeto (GitHub Pages, servida da pasta docs/)
public/data/srd-monstros.json`
  (o arquivo de entrada vem de `src/2014/en/` do repositório 5e-bits/5e-database).

## Variáveis de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3000` | porta do servidor |
| `TABULA_DATA` | `./data` (o `iniciar.bat` e o `iniciar.sh` usam `../campanha`) | onde fica a campanha |
| `TABULA_SEM_NAVEGADOR` | — | o `iniciar.sh` não abre o navegador (útil num servidor sem tela) |
| `TABULA_NO_UPDATE_CHECK` | — | se definida, não consulta o GitHub atrás de versão nova |

## Testes

```
npm test
```

Sobe um servidor temporário e confere permissões (quem move o quê, quem vê o quê), segredos,
diário, compêndio, rolagens, iniciativa, backups, bestiário, névoa, desenhos, condições, fila de memórias,
calendário e descansos.

## Lançar uma versão nova

1. Faça as mudanças e rode `npm test`.
2. Suba o número em `package.json` (`version`). É ele que a mesa compara com o GitHub para avisar o
   mestre, e o `atualizar.bat`/`atualizar.sh` baixa o que estiver na branch `main` (só se for mais nova).
3. Atualize o `CHANGELOG.md`.
4. Faça o commit e crie uma tag: `git tag v4` (no GitHub Desktop: *History* → botão direito no commit → *Create Tag*).
5. No GitHub, em **Releases → Draft a new release**, escolha a tag e anexe um zip da pasta
   (sem `node_modules` e sem `data`) com o nome `Tabula_v4.zip`.

## Finais de linha e permissões

- Os `.bat` precisam de CRLF; o `.gitattributes` os guarda como estão (`-text`), e o ZIP do GitHub sai certo.
- Os `.sh` precisam de LF e da permissão de execução: ao criar um novo, `git update-index --chmod=+x arquivo.sh`.
  O `instalar.sh` e o `atualizar.sh` também rodam `chmod +x *.sh`, para o caso de o descompactador tirar a permissão.

## Página do projeto

`docs/index.html` é uma página só, sem dependências além das fontes do Google. Para publicar:
**Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/docs`**. As imagens ficam em `docs/img/`.
