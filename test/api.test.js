// Teste rápido do servidor: sobe uma mesa temporária e confere permissões e segredos.
// Rode com: npm test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.TABULA_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tabula-test-'));
process.env.PORT = '3999';
process.env.TABULA_NO_UPDATE_CHECK = '1';
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

  // ---------- v5: névoa, desenhos, condições, fila de memórias, calendário, ficha
  const sid = sc.id;
  await call(gm, 'token:create', { sceneId: sid, name: 'Espreitador', x: 1400, y: 1400, hp: 5 });
  await call(gm, 'fog:reset', { sceneId: sid, mode: 'cover' });
  await wait(50);
  check(!p.last.scene.tokens.some((t) => t.name === 'Espreitador') && p.last.scene.tokens.some((t) => t.characterId === cT.id),
    'névoa esconde NPC do jogador, mas não o próprio personagem');
  await call(gm, 'fog:op', { sceneId: sid, op: 'reveal', shape: 'rect', x: 1300, y: 1300, w: 300, h: 300 });
  await wait(50);
  check(p.last.scene.tokens.some((t) => t.name === 'Espreitador'), 'revelar a área mostra o NPC');
  check(!(await call(p, 'fog:op', { sceneId: sid, op: 'reveal', shape: 'rect', x: 0, y: 0, w: 9, h: 9 })).ok, 'jogador NÃO mexe na névoa');
  await call(gm, 'fog:set', { sceneId: sid, enabled: false });

  const dr = await call(p, 'draw:add', { sceneId: sid, kind: 'circle', pts: [100, 100, 160, 100] });
  await wait(50);
  check(dr.ok && gm.last.scene.drawings.length === 1, 'jogador desenha uma área de magia e o mestre vê');
  check(!(await call(a, 'draw:delete', { sceneId: sid, id: dr.id })).ok, 'outro jogador NÃO apaga o desenho alheio');
  check((await call(gm, 'draw:delete', { sceneId: sid, id: dr.id })).ok, 'mestre apaga qualquer desenho');

  check((await call(p, 'character:update', { id: cT.id, patch: { conditions: ['envenenado', 'xyz', 'envenenado'] } })).ok, 'jogador marca condição no próprio personagem');
  await wait(50);
  check(a.last.characters.find((c) => c.id === cT.id).conditions.join() === 'envenenado', 'condição válida aparece para os outros (inválida e repetida descartadas)');
  check(!(await call(p, 'character:update', { id: cT.id, patch: { aspect: { name: 'trapaça' } } })).ok, 'jogador NÃO edita o próprio aspecto mágico');
  check((await call(gm, 'character:update', { id: cT.id, patch: { aspect: { month: 'Hammer', name: 'Centelha', base: 'choque', upgraded: 'raio' } } })).ok, 'mestre define o aspecto mágico');

  const m1 = await call(gm, 'handout:create', { title: 'Memória 1', body: 'a', queuedFor: pat.id });
  const m2 = await call(gm, 'handout:create', { title: 'Memória 2', body: 'b', queuedFor: pat.id });
  await call(gm, 'handout:create', { title: 'Memória do Bao', body: 'c', queuedFor: and.id });
  await wait(50);
  const before = p.last.handouts.length;
  check(!p.last.handouts.some((x) => x.title.startsWith('Memória ')), 'memórias na fila ficam invisíveis');
  await call(gm, 'handout:queueMove', { id: m2.id, dir: -1 });
  await call(gm, 'handout:releaseNext', { userId: pat.id });
  await wait(50);
  check(p.last.handouts.length === before + 1 && p.last.handouts.some((x) => x.title === 'Memória 2'), 'liberar próxima entrega a primeira da fila (respeitando a ordem)');
  const rAll = await call(gm, 'handout:releaseNext', { userId: 'all' });
  await wait(50);
  check(rAll.released === 2 && a.last.handouts.some((x) => x.title === 'Memória do Bao') && !a.last.handouts.some((x) => x.title === 'Memória 1'),
    'liberar para todos entrega uma de cada, cada um só vê a sua');

  check(gm.last.calendar.months.length === 17 && gm.last.calendar.year === 1492, 'calendário padrão (Harptos)');
  await call(gm, 'calendar:set', { year: 1492, month: 0, day: 30, hour: 20, minute: 0 });
  await call(gm, 'calendar:advance', { minutes: 6 * 60 });
  await wait(50);
  const cal = p.last.calendar;
  check(cal.month === 1 && cal.day === 1 && cal.minutes === 120, 'passar o tempo vira o dia e o mês (Hammer 30 → Midwinter, 02:00)');
  check(!(await call(p, 'calendar:advance', { minutes: 60 })).ok, 'jogador NÃO mexe no calendário');

  await call(p, 'character:update', { id: cT.id, patch: { hpMax: 20, hp: 3, slots: [{ max: 2, used: 2 }, { max: 9, used: 99 }], hdUsed: 2, level: 4 } });
  await wait(50);
  check(p.last.characters.find((c) => c.id === cT.id).slots[1].used === 9, 'espaços de magia não passam do máximo');
  await call(gm, 'rest:long');
  await wait(50);
  const th = p.last.characters.find((c) => c.id === cT.id);
  check(th.hp === 20 && th.slots[0].used === 0 && th.hdUsed === 0, 'descanso longo recupera PV, espaços e dados de vida');
  const rr = await call(p, 'roll', { formula: '1d8+2' });
  check(rr.ok && rr.total >= 3 && rr.total <= 10, 'rolagem devolve o total (para gastar dado de vida)');

  // ---------- v5.2: itens e equipamento
  let gift = null;
  p.on('item:new', (x) => { gift = x; });
  const th0 = () => p.last.characters.find((c) => c.id === cT.id);
  await call(p, 'character:update', { id: cT.id, patch: { ac: 13 } });
  const sw = await call(p, 'item:save', { charId: cT.id, item: { name: 'Espada longa', kind: 'espada', dmg: '1d8', dmg2: '1d10', hands: 'versatile', weight: 1.5 } });
  const sh = await call(p, 'item:save', { charId: cT.id, item: { name: 'Escudo', kind: 'escudo', acBase: 2, weight: 3 } });
  const ar = await call(p, 'item:save', { charId: cT.id, item: { name: 'Cota de malha', kind: 'armadura', armorType: 'pesada', acBase: 16, weight: 27.5 } });
  check(sw.ok && sh.ok && ar.ok && th0().items.length === 3, 'jogador cria itens na própria mochila');
  check(th0().ac === 13, 'sem nada equipado, vale a CA digitada');
  check(!(await call(p, 'item:save', { charId: cB.id, item: { name: 'roubo' } })).ok, 'jogador NÃO mexe na mochila de outro');
  check(!(await call(p, 'item:equip', { charId: cT.id, itemId: sh.id, slot: 'head' })).ok, 'item só vai no espaço certo (escudo na cabeça, não)');
  await call(p, 'item:equip', { charId: cT.id, itemId: ar.id, slot: 'body' });
  await wait(30);
  check(th0().ac === 16, 'cota de malha (pesada) dá CA 16 sem somar Destreza');
  await call(p, 'item:equip', { charId: cT.id, itemId: sw.id, slot: 'main', grip: 'two' });
  await call(p, 'item:equip', { charId: cT.id, itemId: sh.id, slot: 'off' });
  await wait(30);
  let it = (id) => th0().items.find((x) => x.id === id);
  check(it(sh.id).slot === 'off' && it(sw.id).slot === 'main' && it(sw.id).grip === 'one' && th0().ac === 18,
    'escudo na mão esquerda faz a espada versátil voltar a uma mão; CA 18');
  await call(p, 'item:equip', { charId: cT.id, itemId: sw.id, slot: 'main', grip: 'two' });
  await wait(30);
  check(it(sh.id).slot === null && th0().ac === 16, 'empunhar com as duas mãos guarda o escudo');
  const gs = await call(p, 'item:save', { charId: cT.id, item: { name: 'Espada grande', kind: 'espada', dmg: '2d6', hands: 'two' } });
  check(!(await call(p, 'item:equip', { charId: cT.id, itemId: gs.id, slot: 'off' })).ok, 'arma de duas mãos não vai na mão esquerda');
  await call(p, 'item:equip', { charId: cT.id, itemId: ar.id, slot: null });
  await call(p, 'item:save', { charId: cT.id, item: { name: 'Couro batido', kind: 'armadura', armorType: 'leve', acBase: 12 } }).then((r) => call(p, 'item:equip', { charId: cT.id, itemId: r.id, slot: 'body' }));
  await wait(30);
  check(th0().ac === 15, 'armadura leve soma a Destreza (12 + 3)');
  await call(p, 'character:update', { id: cT.id, patch: { autoAc: false, ac: 14 } });
  await wait(30);
  check(th0().ac === 14, 'com a CA automática desligada vale a digitada');
  await call(p, 'character:update', { id: cT.id, patch: { autoAc: true } });
  // sintonia
  const rings = [];
  for (const n of ['Anel A', 'Anel B', 'Amuleto C', 'Capa D']) rings.push(await call(p, 'item:save', { charId: cT.id, item: { name: n, kind: 'anel', attune: true, acBonus: 1 } }));
  for (const r of rings.slice(0, 3)) await call(p, 'item:attune', { charId: cT.id, itemId: r.id, on: true });
  const fourth = await call(p, 'item:attune', { charId: cT.id, itemId: rings[3].id, on: true });
  check(!fourth.ok && /3 itens/.test(fourth.error), 'no máximo 3 itens sintonizados');
  await call(p, 'item:equip', { charId: cT.id, itemId: rings[0].id, slot: 'ring1' });
  await call(p, 'item:equip', { charId: cT.id, itemId: rings[3].id, slot: 'ring2' });
  await wait(30);
  check(th0().ac === 16, 'anel de proteção sintonizado soma +1; o não sintonizado não soma');
  // o que os outros veem
  const seen = a.last.characters.find((c) => c.id === cT.id);
  check(Array.isArray(seen.equip) && seen.equip.length === 4 && seen.items === undefined && seen.equip.every((x) => x.desc === undefined),
    'os outros jogadores veem só o equipamento (sem a mochila)');
  // dar e passar
  const pot = await call(gm, 'item:save', { charId: cT.id, item: { name: 'Poção de cura', kind: 'pocao', qty: 3 } });
  await wait(50);
  check(pot.ok && gift && gift.name === 'Poção de cura' && gift.from === 'O mestre', 'mestre dá um item e o jogador é avisado');
  const give = await call(p, 'item:give', { charId: cT.id, itemId: pot.id, toCharId: cB.id, qty: 1 });
  await wait(30);
  const bao = gm.last.characters.find((c) => c.id === cB.id);
  check(give.ok && it(pot.id).qty === 2 && bao.items.some((x) => x.name === 'Poção de cura' && x.qty === 1), 'jogador passa 1 poção para outro personagem');
  check(!(await call(p, 'item:give', { charId: cB.id, itemId: bao.items[0].id, toCharId: cT.id })).ok, 'jogador NÃO tira item da mochila de outro');
  const sp = await call(p, 'item:split', { charId: cT.id, itemId: pot.id });
  await wait(30);
  check(sp.ok && it(pot.id).qty === 1 && it(sp.id).qty === 1, 'separar um item de uma pilha');
  check(!(await call(p, 'item:save', { charId: cT.id, item: { name: 'x', img: 'javascript:alert(1)' } })).ok, 'imagem de item inválida é recusada');

  // ---------- v5.3: PV pela classe
  const tk = () => p.last.characters.find((c) => c.id === cT.id);
  await call(p, 'character:update', { id: cT.id, patch: { class: 'Guerreiro (Campeão)', level: 1, attrs: { con: 14, dex: 16 } } });
  await wait(30);
  check(tk().hitDie === 'd10', 'escolher a classe define o dado de vida (Guerreiro → d10)');
  const on = await call(p, 'hp:auto', { charId: cT.id, on: true });
  await wait(30);
  check(on.ok && tk().hpMax === 12, 'PV pela classe no 1º nível: máximo do dado + CON (10 + 2)');
  check(!(await call(p, 'hp:level', { charId: cT.id, mode: 'roll' })).ok, 'sem nível novo, não há PV para rolar');
  await call(p, 'character:update', { id: cT.id, patch: { level: 3, hpMax: 999 } });
  await wait(30);
  check(tk().hpMax === 12, 'subir de nível deixa os PV pendentes; o jogador não digita o máximo');
  const avg = await call(p, 'hp:level', { charId: cT.id, mode: 'avg' });
  check(avg.ok && avg.gain === 8 && avg.pending === 1, 'pegar a média: d10 → 6 + 2 = +8 PV');
  const rl = await call(p, 'hp:level', { charId: cT.id, mode: 'roll' });
  await wait(30);
  check(rl.ok && rl.value >= 1 && rl.value <= 10 && tk().hpMax === 20 + rl.value + 2 && rl.pending === 0, 'rolar o dado do nível 3 (servidor rola, vai para o chat)');
  const hpBefore = tk().hpMax;
  await call(p, 'character:update', { id: cT.id, patch: { attrs: { con: 16, dex: 16 } } });
  await wait(30);
  check(tk().hpMax === hpBefore + 3, 'CON +1 no modificador dá +1 PV por nível (retroativo)');
  await call(gm, 'rules:set', { hp: 'roll' });
  await call(p, 'character:update', { id: cT.id, patch: { level: 4 } });
  const forced = await call(p, 'hp:level', { charId: cT.id, mode: 'avg' });
  check(!forced.ok && /rolados/.test(forced.error) && gm.last.rules.hp === 'roll', 'regra da mesa "sempre rolar" bloqueia a média');
  check(!(await call(p, 'hp:auto', { charId: cT.id, on: false })).ok, 'só o mestre desliga os PV pela classe');
  check((await call(gm, 'hp:undo', { charId: cT.id })).ok, 'mestre desfaz a última rolagem de PV');
  check(!(await call(p, 'hp:undo', { charId: cT.id })).ok, 'jogador não desfaz rolagem de PV');
  await call(gm, 'rules:set', { hp: 'choose' });

  // ---------- v5.4: multiclasse
  while ((await call(gm, 'hp:level', { charId: cT.id, mode: 'avg' })).ok);   // completa os PV do guerreiro 4
  await wait(50);
  const g0 = tk().classes[0];
  check(tk().classes.length === 1 && g0.name === 'Guerreiro (Campeão)' && g0.level === 4 && g0.die === 10, 'ficha antiga vira uma lista com uma classe');
  const maxG4 = tk().hpMax;
  await call(p, 'character:update', { id: cT.id, patch: { classes: [{ id: g0.id, name: 'Guerreiro', level: 4 }, { name: 'Mago', level: 1 }] } });
  await wait(30);
  check(tk().level === 5 && tk().class === 'Guerreiro 4 / Mago 1' && tk().hitDie === 'd10', 'multiclasse: nível total 5, "Guerreiro 4 / Mago 1"');
  const mg = tk().classes[1];
  check(mg.die === 6, 'a classe nova traz o próprio dado de vida (mago d6)');
  const mlv = await call(p, 'hp:level', { charId: cT.id, mode: 'avg', cid: mg.id });
  await wait(30);
  check(mlv.ok && tk().hpMax === maxG4 + 4 + 3, 'PV do nível de mago: média do d6 (4) + CON');
  await call(p, 'character:update', { id: cT.id, patch: { level: 9 } });
  await wait(30);
  check(tk().level === 5, 'com multiclasse, o nível total vem das classes (não se digita)');
  check(tk().hdUsedBy.d10 === 0 && tk().hdUsedBy.d6 === 0 && Object.keys(tk().hdUsedBy).sort().join() === 'd10,d6', 'dados de vida separados por tipo (d10 e d6)');
  await call(p, 'character:update', { id: cT.id, patch: { hdUsedBy: { d10: 3, d6: 1 } } });
  await call(gm, 'rest:long');
  await wait(30);
  check(tk().hdUsedBy.d10 === 1 && tk().hdUsedBy.d6 === 1, 'descanso longo devolve metade do total (2), começando pelos maiores');
  await call(p, 'character:update', { id: cT.id, patch: { classes: [{ id: g0.id, name: 'Guerreiro', level: 4 }] } });
  await wait(30);
  check(tk().level === 4 && tk().hpMax === maxG4 && tk().class === 'Guerreiro', 'tirar a classe leva junto os níveis e os PV dela');
  check(!(await call(p, 'character:update', { id: cT.id, patch: { classes: [] } })).ok, 'o personagem precisa de pelo menos uma classe');

  // ---------- v5.5: Biblioteca (magias e itens do SRD no compêndio)
  const fs = require('fs');
  const path = require('path');
  const lib = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', f), 'utf8'));
  const mags = lib('srd-magias.json').magias;
  const fb = mags.find((x) => x.id === 'fireball');
  check(mags.length === 319 && mags.every((x) => x.n && x.d.length && x.t && x.a && x.du && x.cl.length),
    'as 319 magias do SRD estão traduzidas e completas');
  check(fb.n === 'Bola de Fogo' && fb.l === 3 && fb.e === 'evocação' && fb.a === '45 metros' && fb.cl.join() === 'feiticeiro,mago' && fb.h,
    'Bola de Fogo: 3º círculo, evocação, 45 metros, feiticeiro e mago, com "em níveis superiores"');
  const itensSrd = lib('srd-itens.json');
  check(itensSrd.itens.length === 237 && itensSrd.magicos.length > 300 && itensSrd.itens.every((x) => x.n && x.k),
    'equipamento (237) e itens mágicos do SRD com nome em português');
  const tchar = () => gm.last.characters.find((c) => c.id === cT.id);
  const nItems = tchar().items.length;
  const torch = { srd: 'torch', name: 'Tocha', kind: 'outro', qty: 1, weight: 0.5 };
  const am = await call(p, 'item:addMany', { charId: cT.id, items: [torch, { ...torch, qty: 4 }, { srd: 'dagger', name: 'Adaga', kind: 'adaga', dmg: '1d4', dmgType: 'perfurante', finesse: true, light: true }] });
  await wait(30);
  const torches = tchar().items.filter((x) => x.srd === 'torch');
  check(am.ok && torches.length === 1 && torches[0].qty === 5 && tchar().items.length === nItems + 2, 'pôr itens da Biblioteca na mochila: tochas iguais juntam numa pilha (5)');
  check(!(await call(p, 'item:addMany', { charId: cB.id, items: [torch] })).ok, 'jogador NÃO põe itens na mochila de outro pela Biblioteca');
  gift = null;
  await call(gm, 'item:addMany', { charId: cT.id, items: [{ srd: 'flame-tongue', name: 'Língua flamejante (espada longa)', kind: 'espada', rarity: 'raro', attune: true, dmg: '1d8', desc: 'x'.repeat(6000) }], label: 'Língua flamejante' });
  await wait(50);
  const ft = tchar().items.find((x) => x.srd === 'flame-tongue');
  check(gift && gift.name === 'Língua flamejante' && ft && ft.attune && ft.rarity === 'raro' && ft.desc.length === 6000, 'mestre dá item mágico da Biblioteca e o jogador é avisado (descrição longa cabe)');
  await call(p, 'character:update', { id: cT.id, patch: { spellbook: [{ id: 'fireball', name: 'Bola de Fogo', level: 3 }, { id: 'light', name: 'Luz', level: 0, prep: 1 }, { name: '', level: 42 }] } });
  await wait(30);
  const sbk = tchar().spellbook;
  check(sbk.length === 3 && sbk[0].prep === false && sbk[1].prep === true && sbk[2].name === "Magia" && sbk[2].level === 9, 'magias na ficha: validadas (nome, círculo 0–9, preparada)');

  // ---------- v5.6: Vista 3D (modelos .glb)
  const upGlb = async (buf, name) => {
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: 'application/octet-stream' }), name);
    const r = await fetch(URL + '/api/upload', { method: 'POST', headers: { 'x-token': setup.body.token }, body: fd });
    return { status: r.status, body: await r.json() };
  };
  const realGlb = fs.readFileSync(path.join(__dirname, '..', 'public', 'modelos', 'miniatura-exemplo.glb'));
  const goodUp = await upGlb(realGlb, 'heroi.glb');
  const badUp = await upGlb(Buffer.from('isto nao e um modelo'), 'falso.glb');
  check(goodUp.status === 200 && /^\/uploads\/[a-f0-9]+\.glb$/.test(goodUp.body.url) && badUp.status === 400,
    'envio de modelo .glb: arquivo de verdade aceito, arquivo falso com extensão .glb recusado');
  const served = await fetch(URL + goodUp.body.url);
  check(served.ok && (await served.arrayBuffer()).byteLength === realGlb.length, 'o modelo enviado é servido de volta');
  await call(p, 'character:update', { id: cT.id, patch: { model: goodUp.body.url, modelScale: 9, modelTurn: 100 } });
  await wait(30);
  check(tchar().model === goodUp.body.url && tchar().modelScale === 5 && tchar().modelTurn === 105, 'jogador põe a miniatura no personagem (tamanho e giro validados)');
  check(!(await call(p, 'character:update', { id: cT.id, patch: { model: 'javascript:alert(1)' } })).ok
    && !(await call(p, 'character:update', { id: cT.id, patch: { model: '/uploads/../server.js' } })).ok, 'modelo com endereço estranho é recusado');
  const colega = p.last.characters.find((c) => c.id === cB.id);
  await call(gm, 'character:update', { id: cB.id, patch: { model: '/modelos/miniatura-exemplo.glb' } });
  await wait(40);
  check(p.last.characters.find((c) => c.id === cB.id).model === '/modelos/miniatura-exemplo.glb' && colega && !('items' in colega),
    'o colega vê a miniatura do outro personagem (e continua sem ver a mochila dele)');
  const monG = await call(gm, 'monster:create', { name: 'Orc 3D', hp: 15, model: '/modelos/miniatura-exemplo.glb', modelScale: 1.5 });
  const t3 = await call(gm, 'token:create', { sceneId: sc.id, monsterId: monG.id, x: 0, y: 140 });
  await wait(30);
  const t3s = () => gm.last.scene.tokens.find((t) => t.id === t3.id);
  check(t3s().model === '/modelos/miniatura-exemplo.glb' && t3s().modelScale === 1.5, 'token criado da ficha do bestiário leva o modelo 3D');
  await call(gm, 'monster:update', { id: monG.id, patch: { model: goodUp.body.url } });
  await wait(30);
  check(t3s().model === goodUp.body.url, 'trocar o modelo na ficha troca nos tokens dela');
  await call(gm, 'token:update', { sceneId: sc.id, id: t3.id, patch: { model: '', modelTurn: -45 } });
  await wait(30);
  check(t3s().model === '' && t3s().modelTurn === 315, 'mestre tira o modelo de um token só');

  const rules = await import('../public/js/rules.js');
  const L = (c) => rules.spellLists(c).map((l) => `${l.key}:${l.max}${l.cantrips ? '+t' : ''}`).join(' ');
  check(L({ class: 'Mago', level: 5 }) === 'mago:3+t' && L({ class: 'Paladino', level: 1 }) === 'paladino:0' && L({ class: 'Paladino', level: 9 }) === 'paladino:3',
    'círculo máximo por classe: mago 5 → 3º; paladino 1 → nenhum; paladino 9 → 3º');
  check(L({ classes: [{ name: 'Guerreiro (Cavaleiro Arcano)', level: 7 }, { name: 'Clérigo', level: 3 }] }) === 'mago:2+t clerigo:2+t'
    && L({ class: 'Bruxo', level: 11 }) === 'bruxo:6+t' && L({ class: 'Ladino', level: 5 }) === '',
    'multiclasse: cada classe com o próprio nível (cavaleiro arcano usa a lista do mago; bruxo 11 tem Arcana Mística de 6º)');
  const lists = rules.spellLists({ classes: [{ name: 'Clérigo', level: 3 }, { name: 'Mago', level: 1 }] });
  check(rules.spellAccess(mags.find((x) => x.id === 'spiritual-weapon'), lists) && !rules.spellAccess(fb, lists)
    && rules.spellAccess(mags.find((x) => x.id === 'fire-bolt'), lists)?.key === 'mago', 'acesso: Arma Espiritual (clérigo 2º) sim, Bola de Fogo não; Raio de Fogo pelo mago');

  a.close();
  gm.close(); p.close();
  server.close();
  require('../server/store').flush();
  console.log(`\n${ok} verificações passaram.`);
  process.exit(0);
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
