# Guia do mestre

Tudo que é exclusivo do mestre fica na aba **👑 Mestre**, além das ferramentas de edição nas outras abas.

## Antes da primeira sessão

### Criar os jogadores
**Mestre → Jogadores e personagens → Usuários**

1. Preencha **nome** e **senha** do jogador.
2. Deixe **"Já criar personagem"** marcado e escreva o nome do personagem: a ficha já nasce vinculada a ele.
3. Mande o link da mesa, o nome e a senha para cada jogador (a senha, de preferência, no privado).

Papéis possíveis:
- **Jogador**: vê e edita só o próprio personagem, move só o próprio token.
- **Telão (só assiste)**: vê só o mapa e a iniciativa, sem nenhuma aba. Para uma TV no presencial.

Para trocar a senha de alguém, use o 🔑 ao lado do nome. Para trocar o dono de um personagem, use o
menu ao lado dele em **Personagens**.

### Criar uma cena (mapa)
**Mestre → Cenas (mapas)**

1. Dê um nome à cena.
2. Em **Quadrados na largura do mapa**, conte quantos quadrados o desenho tem de uma borda à outra, na horizontal. Isso faz o token ter o tamanho de um quadrado.
3. Clique em **Escolher imagem e criar** (PNG, JPG, WEBP ou GIF, até 25 MB).

A primeira cena já vai ao ar. Para trocar o que os jogadores veem, clique em **Mostrar** em outra cena.

### Acertar a grade
**Mestre → Cena ativa (grade)**

- **Quadrados na largura**: o jeito mais fácil; a mesa calcula o tamanho do quadrado.
- **Quadrado (px)**: ajuste fino.
- **Desloc. X / Y**: empurra a grade até as linhas coincidirem com as do desenho.
- **Mostrar grade** e **Encaixar tokens na grade** podem ser desligados para mapas sem grade.

> Se um token parecer minúsculo ou "não aparecer", quase sempre é a grade com o tamanho errado.

## Tokens

**Mestre → Tokens**

- **Personagens**: **Colocar no mapa** / **Tirar do mapa**. A foto do token é a foto da ficha.
- **NPCs e monstros**: nome, PV, tamanho e imagem (opcional). Se o nome terminar em número
  (`Goblin 1`), o próximo já vem como `Goblin 2`.
- Marque **Oculto** para preparar uma emboscada: o token fica semitransparente para você e invisível para os jogadores.

O token novo aparece **no centro da tela**, num quadrado livre, e pisca para você achar.

**Clicar num token** abre um painel no canto do mapa: nome, tamanho, PV do NPC, imagem,
ocultar/revelar e remover. Com o token selecionado, as **setas do teclado** andam um quadrado.

Os jogadores veem a barra de vida dos personagens, mas não a dos monstros: só um **aro vermelho**
quando o monstro está com metade da vida ou menos, e o token **cinza com ✖** quando ele cai.

## Durante o jogo

- **Sinalizar**: dois cliques no mapa mostram um círculo para todos.
- **Rolagem oculta**: na aba Dados, marque "Rolagem oculta". Só você vê o resultado.
- **Fichas**: na aba Ficha, a fileira de retratos no topo troca de personagem. Tudo salva sozinho ("✓ Salvo").

### Iniciativa
1. Peça aos jogadores para clicarem em **Rolar minha iniciativa**.
2. Clique em **+ Todos os tokens da cena**: rola para quem ainda não está na lista (monstros ocultos ficam ocultos).
3. **⚔ Começar combate**, depois **Próximo ▶** a cada turno. O jogador da vez também pode passar o turno.
4. O valor de cada um pode ser editado direto na lista. **Encerrar** limpa tudo.

### Segredos
Para memórias, pistas, cartas, mapas do tesouro…

1. Aba **✉ Segredos** → título, texto, imagem → **Criar segredo**.
2. Escolha quem vê: **Todos** ou jogadores específicos. Quem recebe é avisado na hora; os outros não veem nada.

### Diário do grupo
Todos escrevem. Cada jogador edita e apaga só o que escreveu; o mestre pode apagar qualquer entrada.

### Compêndio
Material de consulta: regras da casa, tabelas de XP, preços, locais, NPCs, anotações da aventura.

- Cada página tem **título, categoria, texto e imagens** (tire um print de uma tabela e adicione como imagem).
- **🔒 Só eu (mestre)**: suas anotações. **👁 Todos os jogadores**: material liberado.
- Dá para liberar ou esconder uma página depois, com um botão.

## Backups

**Mestre → Sessão e backups**

A campanha salva sozinha a cada alteração. Além disso, a mesa guarda **pontos de backup**:

| Quando | Nome na lista |
|---|---|
| Ao abrir a mesa | Abertura da mesa |
| A cada 30 min de jogo (se algo mudou) | Automático |
| Ao fechar a janela preta | Mesa fechada |
| Ao clicar em "Salvar e encerrar a sessão" | Fim da sessão |
| Quando você pede | o nome que você deu |

- **Restaurar** volta a campanha para aquele ponto. Antes, a mesa guarda o estado atual como
  "Antes de restaurar", então dá para desfazer.
- **📂 Carregar arquivo…** abre um backup baixado (por exemplo, de outro computador).
- **⬇ Baixar** salva a campanha num arquivo `.json`.

Ficam guardados os 30 backups automáticos mais recentes e os 100 mais recentes dos outros tipos.
