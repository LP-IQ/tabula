# Desenvolvimento

Sem etapa de compilação: Node.js no servidor e JavaScript puro (módulos ES) no navegador.
Edite o arquivo, recarregue o navegador; se mexer no servidor, reinicie a mesa.

## Estrutura

```
server.js            HTTP (login, upload, backup) + Socket.IO (tempo real) + regras de permissão
server/store.js      campaign.json: leitura, gravação atômica, pontos de backup, restauração
server/dice.js       rolador de dados (rola no servidor, com crypto.randomInt)
public/index.html    esqueleto da página
public/style.css     visual (cores em :root, no topo)
public/js/
  main.js            login, conexão, abas, distribui o estado para os módulos
  core.js            estado do cliente, emit() com aviso de erro, rolagens d20
  util.js            h() para criar elementos, upload, avatar, lightbox…
  map.js             mapa, grade, tokens, zoom/arrasto/pinça, ping, faixa de iniciativa
  sheet.js           ficha 5e e seletor de fichas
  chat.js            dados e mensagens
  initiative.js      rastreador de iniciativa
  handouts.js        segredos
  journal.js         diário do grupo
  compendium.js      compêndio
  gm.js              painel do mestre (cenas, tokens, usuários, backups)
  bestiary.js        bestiário: bloco de estatísticas, editor, biblioteca SRD, ajuste de ND, colocar no mapa
  rules.js           regras do Livro do Mestre: tabela por ND, XP, dificuldade de encontro, ajuste de ND
public/data/srd-monstros.json   334 monstros do SRD 5.1 já convertidos (gerado por tools/srd/converter.py)
test/api.test.js     teste automático do servidor (npm test)
tools/redefinir-senha.js   redefine a senha de um usuário (mesa fechada)
tools/srd/converter.py     converte os monstros do 5e-database para o formato da Tábula (com traduções)
*.bat                atalhos para Windows (instalar, iniciar, online, redefinir-senha)
```

## Como funciona

- O servidor guarda **um único objeto** com a campanha e grava em `campaign.json` 400 ms após cada mudança.
- Cada navegador recebe, via Socket.IO, uma **visão filtrada** desse objeto (`viewFor` em `server.js`).
  O jogador nunca recebe o que não pode ver: tokens ocultos, PV de monstros, fichas completas
  dos outros, segredos de outras pessoas, páginas privadas do compêndio, rolagens secretas.
- Ações chegam como eventos (`token:move`, `character:update`, `roll`, …). Cada uma é validada
  no servidor (`handlers` em `server.js`) antes de mudar o estado.
- O movimento de token durante o arrasto usa um evento leve (`token:moved`), sem reenviar o estado inteiro.

## Bestiário e ajuste de ND

- As fichas ficam em `monsters[]` na campanha; só o mestre as recebe (`viewFor`). O token guarda
  `monsterId` e os próprios PV; o jogador nunca recebe o `monsterId`.
- `rescale()` em `rules.js`: CA, ataque e CD por diferença na tabela do Livro do Mestre; PV e dano
  pela razão entre os valores típicos de cada ND (medianas dos 334 monstros do SRD, suavizadas:
  PV ≈ 15·ND + 15 até o ND 20; dano/rodada ≈ 4,5·ND + 5,5).
- Para atualizar a biblioteca: `python3 tools/srd/converter.py 5e-SRD-Monsters.json public/data/srd-monstros.json`
  (o arquivo de entrada vem de `src/2014/en/` do repositório 5e-bits/5e-database).

## Variáveis de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3000` | porta do servidor |
| `TABULA_DATA` | `./data` (o `iniciar.bat` usa `..\campanha`) | onde fica a campanha |

## Testes

```
npm test
```

Sobe um servidor temporário e confere permissões (quem move o quê, quem vê o quê), segredos,
diário, compêndio, rolagens, iniciativa e backups.

## Lançar uma versão nova

1. Faça as mudanças e rode `npm test`.
2. Atualize o `CHANGELOG.md`.
3. Faça o commit e crie uma tag: `git tag v4` (no GitHub Desktop: *History* → botão direito no commit → *Create Tag*).
4. No GitHub, em **Releases → Draft a new release**, escolha a tag e anexe um zip da pasta
   (sem `node_modules` e sem `data`) com o nome `Tabula_v4.zip`.
