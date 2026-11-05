# Histórico de versões

## v5.6 — 04/11/2026
**Novidades**
- **Vista 3D do mapa** (botão **3D**, cada um liga para si): o mapa vira o chão de um tabuleiro e os tokens viram
  miniaturas, com luz e sombra. Câmera livre (arrastar, girar, aproximar, vista de cima), mover a própria miniatura,
  dois cliques para a ficha e para sinalizar, névoa e desenhos no chão, anel do turno da iniciativa, miniatura que
  tomba com 0 PV, tokens ocultos transparentes para o mestre.
- **Miniaturas 3D (.glb)** para personagens (na ficha), tokens e fichas do bestiário, com tamanho e giro. Animações
  *idle* e *walk* tocam sozinhas. Sem modelo, o token aparece como miniatura de papelão em pé com a imagem dele.
- Um **aventureiro de exemplo** vem junto (`public/modelos/`, gerado por `tools/gerar-miniatura-exemplo.py`).
- O envio de arquivos aceita modelos `.glb` (até 40 MB), com conferência do conteúdo do arquivo.
- three.js 0.170 (MIT) vem dentro da mesa (`public/vendor/three`): funciona sem internet e só é baixado quando
  alguém liga a vista 3D.

## v5.5 — 01/11/2026
**Novidades**
- **Biblioteca no compêndio** (abas **✨ Magias** e **🎒 Itens**), com o conteúdo do SRD 5.1 (CC-BY-4.0) em português:
  - **319 magias** traduzidas, com os nomes do Livro do Jogador e as medidas em metros/quilos. Cartão no formato do
    livro (tempo, alcance, componentes, duração, efeito, níveis superiores). Filtro **"Só as que pode conjurar"** pelas
    classes e níveis da ficha (multiclasse incluída, cada classe com o próprio nível; cavaleiro/trapaceiro arcano pela
    lista do mago; Arcana Mística do bruxo). Busca em português ou inglês, filtros de círculo, classe, escola, ritual
    e concentração.
  - **237 itens** do Livro do Jogador (armas, armaduras, equipamento, ferramentas, pacotes, montarias e veículos) com
    preço, peso, dano, propriedades e CA. **＋ Pôr na mochila** já preenche o item (ataque e CA automáticos); pacotes
    entram item por item; itens iguais empilham; montarias não contam no peso.
  - **Itens mágicos** (só o mestre vê): 341 itens com nome em português, raridade e sintonização; **🎁 Dar a…** com
    escolha da arma/armadura base, bônus mágico e CA já calculados. Descrição ainda no original em inglês.
- **Magias da ficha**: lista por círculo, com "preparada", cartão da magia ao tocar o nome e **＋ Procurar magias**.
  O campo de texto antigo virou **Anotações de magias** (nada se perde).

**Correções**
- O tipo de dano "força" das sugestões do editor de item virou **energia**, como no Livro do Jogador.
- No celular, conteúdo largo (tabelas) não empurra mais a tela para os lados.

## v5.4 — 01/11/2026
**Novidades**
- **Multiclasse**: lista de classes por personagem (nome, nível, dado de vida). Nível total e "Classe A 3 / Classe B 2"
  calculados; fichas antigas viram uma lista com uma classe, sem perder nada.
- PV por nível de cada classe (o 1º nível vem da primeira classe); dados de vida em montes por tipo; descanso longo
  recupera metade do total, maiores primeiro.
- Aviso dos requisitos de multiclasse (atributo 13).
- Sugestão de espaços de magia pela tabela da classe ou pela de conjurador multiclasse; Magia de Pacto do bruxo à parte.

## v5.3 — 01/11/2026
**Novidades**
- **A classe define o dado de vida**: o campo Classe sugere as classes do Livro do Jogador e, ao escolher (também em
  inglês ou com a subclasse junto), a ficha ajusta o dado de vida.
- **PV pela classe** (opcional, por personagem): 1º nível = máximo do dado + CON; cada nível seguinte = rolagem do dado
  ou média fixa + CON, no mínimo 1. Ao subir de nível, a ficha mostra o quadro para ganhar os PV de cada nível novo.
  A rolagem é feita pelo servidor e aparece no chat. Os PV máximos passam a ser calculados (mudar a CON ajusta todos os
  níveis) e os atuais sobem junto. Campo de bônus de PV por nível (anão da colina, Robusto).
- **Regras da mesa** (mestre): PV ao subir de nível pelo jogador, sempre rolados ou sempre a média. O mestre pode
  desfazer a última rolagem de PV de um personagem ou desligar o cálculo.

## v5.2.1 — 01/11/2026
- Documentação nova: **[manual das ferramentas](docs/ferramentas.md)** (cada ferramenta passo a passo) e
  **[novidades](docs/novidades.md)** (o que chegou em cada versão e como experimentar). A página do projeto
  ganhou a seção de novidades e o link para o manual.
- No editor de item, o campo "Tipo de dano" ficou mais largo (o texto aparecia cortado).

## v5.2 — 01/11/2026
**Novidades**
- **Equipamento e mochila** na ficha (substitui o inventário em texto, que continua como "Anotações do inventário"):
  - boneco com os espaços cabeça, pescoço, capa, armadura, mão direita, mão esquerda, luvas, dois anéis, cinto e calçado;
  - armas de **duas mãos** ocupam as duas; armas **versáteis** perguntam se é com uma ou duas mãos; pôr um escudo
    na mão esquerda faz a versátil voltar a uma mão;
  - cada item tem um **desenho do tipo** (espada, arco, cajado, elmo, anel…) e a borda na cor da **raridade**.
    Para usar a arte final, escolha a imagem no item ou cole com Ctrl+V;
  - **modelos** com as armas e armaduras do Livro do Jogador, para criar um item com um clique;
  - **sintonização** (no máximo 3 itens) e **carga** (7,5 × Força, em kg);
  - **CA automática** pela armadura, escudo e itens como o Anel de Proteção (dá para desligar e digitar);
  - as **armas equipadas viram ataques** na ficha, com bônus e dano calculados (acuidade, distância, versátil,
    segunda arma como ação bônus sem o modificador no dano);
  - arrastar entre a mochila e os espaços (no computador) ou tocar no item (no celular);
  - **dar item** (mestre) e **passar para…** (jogadores trocam itens); quem recebe é avisado.
- **Ficha em janela**: o botão "⧉ Em janela" (ou dois cliques no token) abre a ficha por cima do mapa, com
  arrastar e redimensionar. O mestre pode abrir várias. A ficha de outro jogador abre só para olhar o retrato,
  a vida, as condições e o equipamento (sem a mochila).
- O jogador vê os retratos do grupo na própria ficha para abrir o equipamento dos colegas.

**Correções**
- Editar o nome e os efeitos do aspecto mágico muito rápido podia apagar um dos campos.

## v5.1 — 27/10/2026
**Novidades**
- **Linux e Mac**: atalhos `instalar.sh`, `iniciar.sh`, `online.sh`, `atualizar.sh` e `redefinir-senha.sh`,
  equivalentes aos `.bat`. O `online.sh` baixa o `cloudflared` sozinho na primeira vez, abre a mesa e o link
  num terminal só e mostra o endereço para os jogadores; Ctrl + C fecha tudo salvando a campanha.
  Guia novo: [docs/instalacao-linux.md](docs/instalacao-linux.md).
- O aviso de versão nova e as mensagens da mesa citam o atalho certo para o sistema.

**Correções**
- O `atualizar.bat` só atualiza se a versão do GitHub for **mais nova** (antes, bastava ser diferente).

## v5 — 27/10/2026
**Novidades no mapa**
- **Névoa de guerra**: na ferramenta 🌫 (só o mestre), ligue a névoa e revele ou esconda retângulos e
  círculos arrastando no mapa; dá para desfazer, cobrir tudo e revelar tudo. Para o mestre a névoa é
  translúcida; para os jogadores, escura. Tokens de monstros cobertos pela névoa nem são enviados aos jogadores.
- **Régua e áreas de magia**: régua em metros (regra de 1,5 m por quadrado, diagonal conta como um),
  esfera, cone, linha e cubo com a medida escrita. A régua de cada um aparece ao vivo para os outros.
- **Desenho livre, setas e borracha**: cada um apaga os seus; o mestre apaga qualquer um ou limpa a cena.
- **Condições nos tokens**: envenenado, caído, amedrontado, concentração e as outras aparecem como
  ícones no token. O mestre marca pelo painel do token; o jogador, pela ficha.

**Novidades na ficha**
- Condições, inspiração e **testes contra a morte** (com rolagem automática: 20 volta com 1 PV, 1 conta duas falhas).
- **Espaços de magia** por círculo, clicando para gastar e recuperar.
- **Dados de vida**: escolha o dado e gaste no descanso curto; a cura rolada entra direto nos PV.
- **XP e moedas** (PC, PP, PE, PO, PL), com aviso de quando já dá para subir de nível.
- **Aspecto mágico e anel**: o mestre escreve o efeito base e o do nível 5; o jogador vê na ficha,
  e a partir do nível 5 a versão melhorada aparece no lugar.
- **Colar imagem com Ctrl+V** na ficha (vira o retrato e o token) e nas fichas do bestiário.

**Novidades do mestre**
- **Calendário do mundo** no topo da tela, para todos. O mestre passa o tempo (+10 min, +1 h, +8 h,
  +1 dia…), define a data e troca os meses. O padrão é o calendário de Harptos (Faerûn).
- **Descanso curto e longo** para o grupo: o longo passa 8 horas e devolve PV, espaços de magia e metade dos dados de vida.
- **Fila de memórias** nos Segredos: guarde várias para um jogador, ordene e libere uma de cada vez.
- **Imagens em lote no bestiário**: escolha várias imagens de uma vez; o nome do arquivo diz de qual
  monstro é (português, inglês ou o código do SRD). Monstros da biblioteca viram fichas suas já com a imagem.
- Trocar a imagem de uma ficha atualiza os tokens dela que estão no mapa.
- **`atualizar.bat`**: baixa a versão mais nova do GitHub, guarda a anterior em `Tabula_anterior` e
  não mexe na campanha. Quando sai versão nova, o mestre vê um aviso no topo da mesa.

**Correções**
- A régua dos outros mostrava a posição de um instante antes, e não a final.

## v4.1 — 15/10/2026
**Correções**
- A biblioteca SRD não abria: o arquivo `public/data/srd-monstros.json` ficava de fora do pacote e do
  repositório (a regra que ignora a pasta `data` da campanha pegava também a `public/data`).
- Se a biblioteca não carregar, aparece um aviso só, explicando o motivo, com um botão "Tentar de novo"
  (antes, a tela tentava sem parar e enchia de avisos).

## v4 — 15/10/2026
**Novidades**
- **Pop-up das rolagens**: cada rolagem aparece num cartão ao lado do painel, para todos (as secretas, só para quem pode ver). Dá para desligar em *Dados → Rolagens na tela*.
- **Bestiário** (aba 🐉, só do mestre): fichas de NPCs e monstros salvas na campanha, no formato do Manual dos Monstros, com atributos, resistências, perícias, ataques e dano roláveis com um clique.
- **Biblioteca SRD**: os 334 monstros do SRD 5.1 prontos para copiar ou colocar no mapa. Nomes dos mais comuns e textos de ataque em português.
- **Ajustar ND**: muda o ND de uma ficha com prévia lado a lado. CA, ataque e CD seguem a tabela do Livro do Mestre; PV e dano crescem na proporção do que os monstros oficiais daquele ND têm. Salva como uma ficha nova (o original fica intacto).
- **Colocar no mapa a partir da ficha**: vários de uma vez (Goblin 1, 2, 3…), com PV médio ou rolado para cada um, ocultos ou não.
- **Medidor de dificuldade do encontro** (fácil, médio, difícil, mortal) pelos limites de XP do Livro do Mestre, no painel do mestre e na hora de colocar monstros.
- **Painel do token de NPC**: abre a ficha, rola os ataques, aplica dano/cura e permite vincular o token a uma ficha.

**Correções**
- PV de monstro não fica mais negativo ao levar dano.
- Com o mapa muito afastado, os nomes dos tokens somem em vez de se sobrepor.

## v3 — 14/10/2026
**Correções**
- Token "invisível" em mapas grandes: a grade agora é definida por **quadrados na largura do mapa** (na criação da cena e em *Cena ativa*), e o token ocupa um quadrado de verdade.
- Mestre no celular: tokens colocados pela aba Mestre caíam fora do mapa. Agora caem dentro.
- Token recém-colocado pisca e, se estiver fora da tela, a visão vai até ele.
- Nomes dos tokens continuam legíveis com o mapa afastado.

**Novidades**
- Documentação: guia do mestre, guia do jogador, instalação no Windows e desenvolvimento.
- `redefinir-senha.bat`: redefine a senha de qualquer usuário, inclusive do mestre (com a mesa fechada).

## v2 — 14/10/2026
- Pontos de backup automáticos (abertura, a cada 30 min, encerramento) e manuais com nome.
- Restaurar backup pela lista ou carregando um arquivo `.json`; o estado atual é guardado antes.
- "Salvar e encerrar a sessão": salva, cria backup, avisa os jogadores e fecha a mesa.
- Fechar a janela (Ctrl + C ou X) também salva e cria backup.
- Campanha numa pasta `campanha` compartilhada entre versões (`iniciar.bat`).
- Aviso claro quando já existe outra mesa aberta na mesma porta.

## v1 — 14/10/2026
- Fileira de retratos para trocar de ficha, botão **Ficha** no painel do mestre e indicador "✓ Salvo".
- **Diário do grupo**: todos escrevem; cada um edita o que é seu.
- **Compêndio**: páginas com categoria, texto e imagens; só do mestre ou visíveis a todos; busca.

## v0 — 14/10/2026
Primeira versão.
- Contas criadas pelo mestre; cada jogador controla só o próprio personagem.
- Mapa com imagem de fundo, grade, zoom, arrasto e pinça; tokens redondos com foto.
- Ficha 5e simplificada; dados rolados no servidor; rolagem secreta.
- Iniciativa; segredos (handouts); sinalização no mapa; modo Telão.
- Atalhos `.bat` para Windows; túnel do Cloudflare para jogar online.
