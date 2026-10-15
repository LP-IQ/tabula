# Histórico de versões

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
