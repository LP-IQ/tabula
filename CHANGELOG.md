# Histórico de versões

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
