// Teste rápido do servidor: sobe uma mesa temporária e confere permissões e segredos.
// Rode com: npm test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.TABULA_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tabula-test-'));
process.env.PORT = '3999';
const { io } = require('socket.io-client');
const { server } = require('../server');

const URL = 'http://localhost:3999';
const post = async (p, body, token) => {
  const r = await fetch(URL + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-token': token } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const connect = (token) => new Promise((resolve, reject) => {
  const s = io(URL, { auth: { token }, transports: ['websocket'] });
  s.once('state', (st) => { s.last = st; resolve(s); });
  s.on('state', (st) => { s.last = st; });
  s.once('connect_error', reject);
});
const call = (s, ev, p = {}) => new Promise((r) => s.emit(ev, p, r));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let ok = 0;
  const check = (cond, msg) => { assert.ok(cond, msg); ok++; console.log('  ✓', msg); };

  await new Promise((r) => server.once('listening', r));
  const setup = await post('/api/setup', { name: 'Lucas', password: 'mestre123' });
  check(setup.status === 200 && setup.body.token, 'mestre cria a mesa');
  check((await post('/api/setup', { name: 'X', password: 'xxxx' })).status === 403, 'não dá pra configurar a mesa duas vezes');

  const gm = await connect(setup.body.token);
  check(gm.last.me.role === 'gm', 'mestre conectado em tempo real');

  const pat = await call(gm, 'user:create', { name: 'Patrique', password: 'tharkino', role: 'player' });
  const and = await call(gm, 'user:create', { name: 'Andrei', password: 'bao123', role: 'player' });
  check(pat.ok && and.ok, 'mestre cria usuários dos jogadores');
  const cT = await call(gm, 'character:create', { name: 'Tharkino', ownerId: pat.id });
  const cB = await call(gm, 'character:create', { name: 'Bao, O Errante', ownerId: and.id });
  const sc = await call(gm, 'scene:create', { name: 'Torre', img: '' });
  const tT = await call(gm, 'token:create', { sceneId: sc.id, characterId: cT.id, x: 0, y: 0 });
  const tB = await call(gm, 'token:create', { sceneId: sc.id, characterId: cB.id, x: 70, y: 0 });
  const tG = await call(gm, 'token:create', { sceneId: sc.id, name: 'Goblin', hp: 7, x: 140, y: 0, hidden: true });
  check(tT.ok && tB.ok && tG.ok, 'mestre cria cena e tokens');

  check((await post('/api/login', { userId: pat.id, password: 'errada' })).status === 401, 'senha errada é recusada');
  const lp = await post('/api/login', { userId: pat.id, password: 'tharkino' });
  const p = await connect(lp.body.token);
  check(p.last.me.name === 'Patrique' && p.last.me.role === 'player', 'jogador entra com a senha');

  check((await call(p, 'token:move', { sceneId: sc.id, id: tT.id, x: 210, y: 70 })).ok, 'jogador move o próprio token');
  const r2 = await call(p, 'token:move', { sceneId: sc.id, id: tB.id, x: 999, y: 999 });
  check(!r2.ok && /próprio/.test(r2.error), 'jogador NÃO move token de outro jogador');
  check(!(await call(p, 'token:move', { sceneId: sc.id, id: tG.id, x: 1, y: 1 })).ok, 'jogador NÃO move NPC');
  check(!p.last.scene.tokens.some((t) => t.id === tG.id), 'jogador não vê token oculto');
  check(!(await call(p, 'scene:create', { name: 'hack' })).ok, 'jogador não cria cenas');

  check((await call(p, 'character:update', { id: cT.id, patch: { hp: 3, attrs: { dex: 16 } } })).ok, 'jogador edita a própria ficha');
  check(!(await call(p, 'character:update', { id: cB.id, patch: { hp: 0 } })).ok, 'jogador NÃO edita ficha alheia');
  check(!(await call(p, 'character:update', { id: cT.id, patch: { ownerId: and.id } })).ok, 'jogador não troca o dono do personagem');
  await wait(50);
  const otherChar = p.last.characters.find((c) => c.id === cB.id);
  check(otherChar && otherChar.attrs === undefined && otherChar.notes === undefined, 'jogador vê só o básico da ficha dos outros');

  // segredos
  let newHandout = null;
  p.on('handout:new', (x) => { newHandout = x; });
  const ho = await call(gm, 'handout:create', { title: 'Memória: o anel', body: 'Você se lembra…' });
  await wait(50);
  check(p.last.handouts.length === 0, 'segredo novo fica invisível até o mestre liberar');
  await call(gm, 'handout:update', { id: ho.id, patch: { recipients: [and.id] } });
  await wait(50);
  check(p.last.handouts.length === 0 && newHandout === null, 'segredo do Andrei não aparece para o Patrique');
  await call(gm, 'handout:update', { id: ho.id, patch: { recipients: [and.id, pat.id] } });
  await wait(50);
  check(p.last.handouts.length === 1 && newHandout?.title === 'Memória: o anel', 'Patrique recebe o segredo e é avisado');

  // dados
  const msgs = [];
  p.on('chat', (m) => msgs.push(m));
  check((await call(p, 'roll', { formula: '2d20kh1+5', label: 'Ataque' })).ok, 'rolagem com vantagem');
  check(!(await call(p, 'roll', { formula: '1d20+abc' })).ok, 'fórmula inválida é recusada');
  await call(gm, 'roll', { formula: '1d20', private: true });
  await wait(50);
  check(msgs.length === 1 && msgs[0].roll.total >= 6 && msgs[0].roll.total <= 25, 'jogador vê a própria rolagem (total válido)');
  check(!msgs.some((m) => m.private), 'rolagem oculta do mestre não chega ao jogador');

  // iniciativa
  check((await call(p, 'init:rollMine')).ok, 'jogador rola a própria iniciativa');
  await call(gm, 'init:addScene');
  await wait(50);
  check(gm.last.initiative.entries.length === 3, 'mestre adiciona os tokens da cena sem duplicar o do jogador');
  check(p.last.initiative.entries.length === 2, 'jogador não vê o goblin oculto na iniciativa');
  await call(gm, 'init:start');
  await wait(50);
  check(p.last.initiative.active && p.last.initiative.round === 1, 'combate iniciado e visível ao jogador');

  // diário
  const j = await call(p, 'journal:create', { title: 'Sessão 1', body: 'Acordamos na torre.' });
  check(j.ok, 'jogador escreve no diário');
  const lb = await post('/api/login', { userId: and.id, password: 'bao123' });
  const a = await connect(lb.body.token);
  check(a.last.journal.length === 1 && a.last.journal[0].body === 'Acordamos na torre.', 'outro jogador lê o diário');
  check(!(await call(a, 'journal:update', { id: j.id, patch: { body: 'hackeado' } })).ok, 'jogador NÃO edita entrada alheia do diário');
  check(!(await call(a, 'journal:delete', { id: j.id })).ok, 'jogador NÃO apaga entrada alheia do diário');
  check((await call(p, 'journal:update', { id: j.id, patch: { body: 'Acordamos na torre dos sonhos.' } })).ok, 'autor edita a própria entrada');
  check((await call(gm, 'journal:delete', { id: j.id })).ok, 'mestre pode apagar qualquer entrada');

  // compêndio
  const cp1 = await call(gm, 'compendium:create', { title: 'Tabela de XP', category: 'Regras', body: 'nível 2: 300 XP', visibility: 'all' });
  const cp2 = await call(gm, 'compendium:create', { title: 'Plano do Oziel', category: 'Segredos do mestre', body: 'spoiler' });
  await wait(50);
  check(cp1.ok && cp2.ok && gm.last.compendium.length === 2, 'mestre cria páginas no compêndio');
  check(a.last.compendium.length === 1 && a.last.compendium[0].title === 'Tabela de XP', 'jogador só vê páginas públicas do compêndio');
  check(!(await call(a, 'compendium:create', { title: 'x' })).ok, 'jogador NÃO cria páginas no compêndio');
  await call(gm, 'compendium:update', { id: cp2.id, patch: { visibility: 'all' } });
  await wait(50);
  check(a.last.compendium.length === 2, 'mestre libera página e ela aparece para os jogadores');
  check(!(await call(gm, 'compendium:create', { title: 'x', images: ['javascript:alert(1)'] })).ok, 'imagem com endereço inválido é recusada');

  // bestiário
  const mon = await call(gm, 'monster:create', {
    name: 'Goblin', size: 'Pequeno', cr: '1/4', ac: 15, hp: 7, hpFormula: '2d6',
    attrs: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    actions: [{ name: 'Cimitarra', text: 'Ataque…', toHit: 4, damage: '1d6 + 2' }],
  });
  await wait(50);
  check(mon.ok && gm.last.monsters.length === 1 && gm.last.monsters[0].actions[0].damage === '1d6+2', 'mestre cria ficha no bestiário');
  check(p.last.monsters.length === 0, 'jogador NÃO recebe as fichas do bestiário');
  check(!(await call(p, 'monster:create', { name: 'x' })).ok, 'jogador NÃO cria fichas de monstro');
  const odd = await call(gm, 'monster:create', { name: 'ND estranho', cr: '99' }); await wait(50);
  check(gm.last.monsters.find((x) => x.id === odd.id)?.cr === '0', 'ND inválido vira 0'); await call(gm, 'monster:delete', { id: odd.id });
  const many = await call(gm, 'token:createMany', {
    sceneId: sc.id, monsterId: mon.id, hidden: false,
    tokens: [{ name: 'Goblin 1', x: 0, y: 0, size: 1 }, { name: 'Goblin 2', x: 70, y: 0, size: 1, hp: 9 }],
  });
  await wait(50);
  const gTok = gm.last.scene.tokens.filter((t) => t.monsterId === mon.id);
  check(many.ok && gTok.length === 2 && gTok[1].hp === 9 && gTok[0].hp === 7, 'mestre coloca vários tokens de uma ficha (PV de cada um)');
  const pTok = p.last.scene.tokens.find((t) => t.name === 'Goblin 1');
  check(pTok && pTok.monsterId === undefined && pTok.hp === undefined, 'jogador vê o token, mas não a ficha nem os PV');
  await call(gm, 'monster:update', { id: mon.id, patch: { ac: 16 } });
  await wait(50);
  check(gm.last.monsters[0].ac === 16 && gm.last.monsters[0].hp === 7, 'editar a ficha muda só o que foi alterado');
  await call(gm, 'monster:delete', { id: mon.id });
  await wait(50);
  check(gm.last.monsters.length === 0 && gm.last.scene.tokens.filter((t) => t.name.startsWith('Goblin ')).every((t) => t.monsterId === null),
    'apagar a ficha mantém os tokens no mapa');

  // backups
  const bk = await call(gm, 'backup:create', { label: 'Antes do chefão!' });
  check(bk.ok && /antes-do-chefao\.json$/.test(bk.file), 'mestre cria ponto de backup com nome');
  check(!(await call(p, 'backup:list')).ok, 'jogador NÃO vê a lista de backups');
  await call(gm, 'compendium:create', { title: 'Página nova depois do backup', visibility: 'all' });
  await wait(50);
  const pagesBefore = a.last.compendium.length;
  let restoredMsg = null;
  a.on('restored', (m) => { restoredMsg = m; });
  check((await call(gm, 'backup:restore', { file: bk.file })).ok, 'mestre restaura o backup');
  await wait(100);
  check(a.last.compendium.length === pagesBefore - 1 && restoredMsg, 'campanha volta ao ponto salvo e jogadores são avisados');
  const list = (await call(gm, 'backup:list')).list;
  check(list.some((b) => b.label === 'antes-de-restaurar'), 'estado anterior fica guardado antes de restaurar');
  check(!(await call(gm, 'backup:restore', { file: '../campaign.json' })).ok, 'nome de backup malicioso é recusado');
  const bad = await post('/api/restore', { qualquer: 'coisa' }, setup.body.token);
  check(bad.status === 400, 'arquivo que não é backup da Tábula é recusado');
  const backupJson = await (await fetch(URL + '/api/backup', { headers: { 'x-token': setup.body.token } })).json();
  check((await post('/api/restore', backupJson, setup.body.token)).status === 200, 'carregar arquivo de backup baixado funciona');
  check((await post('/api/restore', backupJson, lp.body.token)).status === 403, 'jogador NÃO carrega backup');

  a.close();
  gm.close(); p.close();
  server.close();
  require('../server/store').flush();
  console.log(`\n${ok} verificações passaram.`);
  process.exit(0);
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
