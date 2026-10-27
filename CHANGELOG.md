# Histórico de versões

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
