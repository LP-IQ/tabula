# Desenvolvimento

Sem etapa de compilação: Node.js no servidor e JavaScript puro (módulos ES) no navegador.
Edite o arquivo, recarregue o navegador; se mexer no servidor, reinicie a mesa.

## Estrutura

```
server.js            HTTP (login, upload, backup) + Socket.IO (tempo real) + regras de permissão
server/store.js      campaign.json: leitura, gravação atômica, pontos de backup, restauração
server/dice.js       rolador de dados (rola no servidor, com crypto.randomInt)
server/world.js      calendário do mundo, névoa (isCovered), condições, padrões novos da ficha
server/classes.js    classes e multiclasse: dado de vida, PV por nível, dados de vida, requisitos
server/items.js      itens: tipos e espaços, validação, equipar (duas mãos/versátil), sintonia, CA automática
public/index.html    esqueleto da página
public/style.css     visual (cores em :root, no topo)
public/js/
  main.js            login, conexão, abas, distribui o estado para os módulos
  core.js            estado do cliente, emit() com aviso de erro, rolagens d20
  util.js            h() para criar elementos, upload, avatar, lightbox…
  map.js             mapa, grade, tokens, zoom/arrasto/pinça, ping, faixa de iniciativa, condições no token
  tools.js           ferramentas do mapa: régua, áreas de magia, desenho, borracha, névoa
  calendar.js        relógio do mundo no topo, janela do calendário, aviso de versão nova
  sheet.js           ficha 5e (createSheet: a da aba e as das janelas) e o seletor de fichas
  equipment.js       boneco de equipamento, mochila, editor e menu do item
  itemdata.js        tipos de item, raridades, modelos do Livro do Jogador, ícones SVG, CA e ataques pelo equipamento
  windows.js         janelas flutuantes (arrastar, redimensionar, lembrar posição)
  chat.js            dados e mensagens
  initiative.js      rastreador de iniciativa
  handouts.js        segredos e fila de memórias
  journal.js         diário do grupo
  compendium.js      compêndio (abas: páginas do mestre, magias, itens)
  library.js         Biblioteca: navegador de magias e itens do SRD, cartão da magia, "pôr na ficha/mochila"
  map3d.js           Vista 3D (three.js): tabuleiro, miniaturas .glb ou de papelão, câmera, arrasto — só carrega ao ligar
  model-ui.js        controles da miniatura 3D (enviar .glb, tamanho, giro) usados na ficha, no token e no bestiário
public/vendor/three/ three.js 0.170 (MIT) e os complementos usados (OrbitControls, GLTFLoader, Draco, Meshopt)
public/modelos/      miniatura de exemplo (gerada por tools/gerar-miniatura-exemplo.py)
  gm.js              painel do mestre (cenas, tokens, usuários, backups)
  bestiary.js        bestiário: bloco de estatísticas, editor, biblioteca SRD, ajuste de ND, colocar no mapa
  rules.js           regras: tabela por ND, XP, dificuldade de encontro, ajuste de ND, classes, multiclasse,
                     espaços de magia e listas/círculos de magia por classe (spellLists, spellAccess)
docs/index.html      página do projeto (GitHub Pages, servida da pasta docs/)
docs/*.html          manual, guias, instalar e novidades do site (gerados por tools/gerar-site.py a partir dos .md)
public/data/srd-monstros.json   334 monstros do SRD 5.1 já convertidos (gerado por tools/srd/converter.py)
public/data/srd-magias.json     319 magias do SRD 5.1 em português (gerado por tools/srd/converter_magias.py)
public/data/srd-itens.json      equipamento e itens mágicos do SRD 5.1 (gerado por tools/srd/converter_itens.py)
test/api.test.js     teste automático do servidor (npm test)
tools/redefinir-senha.js   redefine a senha de um usuário (mesa fechada)
tools/srd/converter.py     converte os monstros do 5e-database para o formato da Tábula (com traduções)
tools/srd/converter_magias.py, converter_itens.py   magias e itens do 5e-database + traduções
tools/srd/traducoes/       textos traduzidos: magias-0…7.json (nome, material, descrição, níveis superiores) e itens.json
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
- **Itens** ficam em `character.items[]` e mudam só por eventos próprios (`item:save`, `item:equip`,
  `item:attune`, `item:give`, `item:split`, `item:delete`). O servidor resolve os conflitos de espaço e recalcula a
  CA (`autoAc`). Os outros jogadores recebem só `equip` (o que está equipado, sem detalhes nem a mochila).
  A tabela de tipos/espaços existe em `server/items.js` e em `public/js/itemdata.js`: mantenha as duas iguais.
- **Calendário** em `calendar` (meses, ano, dia, minutos); `world.advance()` cuida da virada de dia, mês e ano.
- Campanhas antigas ganham os campos novos em `migrate()` ao abrir.

## Bestiário e ajuste de ND

- As fichas ficam em `monsters[]` na campanha; só o mestre as recebe (`viewFor`). O token guarda
  `monsterId` e os próprios PV; o jogador nunca recebe o `monsterId`.
- `rescale()` em `rules.js`: CA, ataque e CD por diferença na tabela do Livro do Mestre; PV e dano
  pela razão entre os valores típicos de cada ND (medianas dos 334 monstros do SRD, suavizadas:
  PV ≈ 15·ND + 15 até o ND 20; dano/rodada ≈ 4,5·ND + 5,5).
- Para atualizar a biblioteca: `python3 tools/srd/converter.py 5e-SRD-Monsters.json public/data/srd-monstros.json`
  (o arquivo de entrada vem de `src/2014/en/` do repositório 5e-bits/5e-database).

## Vista 3D

- `map.js` cria a vista sob demanda (`import('./map3d.js')`); um *import map* em `index.html` aponta `three` para
  `public/vendor/three`. A vista recebe do `map.js` o estado da cena, as funções de permissão (`canMove`), encaixe
  na grade (`snap`), seleção e o canvas da névoa (reaproveitado como textura). Nada novo vai para o servidor além
  dos campos `model`, `modelScale` e `modelTurn` (personagem, token e ficha do bestiário).
- 1 unidade da cena = 1 quadrado da grade. O chão é um canvas com o mapa, a grade e os desenhos (SVG da camada 2D).
  Desenha só quando algo muda; animações de fundo a 30 quadros/s; no celular, resolução e sombra menores.
- Os modelos `.glb` chegam por `/api/upload` (a assinatura "glTF" é conferida) e ficam em `uploads/`. Aceitos:
  `/uploads/<id>.glb`, `/modelos/<nome>.glb` e links `https://….glb`.

## Biblioteca (magias e itens)

- Os dados ficam em `public/data/srd-magias.json` e `srd-itens.json`; o navegador baixa na primeira vez que a aba é
  aberta (`library.js`). Nada disso vai para a campanha: o que entra é o que o jogador põe na ficha.
- Magias da ficha em `character.spellbook[]` (`{ id, name, level, prep }`, validado em `CHAR_FIELDS`).
  `spellLists(c)` em `rules.js` diz que listas a ficha usa e até que círculo (cada classe pelo próprio nível;
  cavaleiro/trapaceiro arcano pela lista do mago; Arcana Mística do bruxo).
- Itens da Biblioteca entram por `item:addMany` (um item, um pacote inteiro ou um item mágico dado pelo mestre);
  o campo `srd` guarda a origem e itens iguais que não vão no corpo empilham.
- Para gerar de novo: `python3 tools/srd/converter_magias.py 5e-SRD-Spells.json public/data/srd-magias.json` e
  `python3 tools/srd/converter_itens.py 5e-SRD-Equipment.json 5e-SRD-Magic-Items.json public/data/srd-itens.json`.
  Para corrigir uma tradução, edite `tools/srd/traducoes/` e rode o conversor.

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
calendário, descansos e itens (espaços, duas mãos, sintonia, CA, dar e passar).

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

O site é a pasta `docs/`, publicada pelo GitHub Pages:
**Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/docs`**.

- `index.html` é a capa, escrita à mão; `demo-mapa.js` e `demo-3d.js` são as duas demonstrações (o 3D usa a cópia
  do three.js em `docs/vendor/three`).
- `manual.html`, `guias.html`, `instalar.html` e `novidades.html` **são gerados** a partir dos `.md` da mesma pasta.
  Depois de mexer num `.md`, rode `python3 tools/gerar-site.py` (precisa do `pip install markdown`). O script também
  preenche na capa o sumário do manual, as últimas versões e o rodapé (entre os comentários `<!-- gerado:… -->`).
  Links entre os `.md` viram links entre as páginas; links para fora de `docs/` apontam para o GitHub.
- Listas dentro de listas no `.md` precisam de **4 espaços** de recuo (o GitHub aceita menos; o gerador não).
- `site.css` tem as cores, as fontes e as peças comuns (capa de lápis, página de velino, moldura dourada);
  `livro.css`, o sumário lateral das páginas de leitura.
- As fontes ficam em `docs/fonts/` (Grenze Gotisch e Alegreya, licença OFL, arquivos junto): o site não carrega
  nada de fora. As imagens ficam em `docs/img/`.
