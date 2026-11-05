// Tábula — servidor da mesa virtual.
// Rode com:  npm start   (ou: node server.js)
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { Server } = require('socket.io');
const store = require('./server/store');
const { roll } = require('./server/dice');
const world = require('./server/world');
const itemsLib = require('./server/items');
const cls = require('./server/classes');
const pkg = require('./package.json');

const PORT = Number(process.env.PORT) || 3000;
const D = () => store.data;
const uid = () => crypto.randomBytes(8).toString('hex');
const COLORS = ['#e0b44c', '#5fb3d9', '#e06c75', '#98c379', '#c678dd', '#d19a66', '#56b6c2', '#f08fc0', '#a7a9ff'];

// ---------------------------------------------------------------- helpers
const ATTRS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SKILLS = ['acrobatics', 'animal', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation',
  'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight', 'stealth', 'survival'];

const str = (v, max = 20000) => String(v ?? '').slice(0, max);
const int = (v, lo, hi, def = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};
const num = (v, lo, hi, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};
const imgUrl = (v) => {
  const s = String(v ?? '');
  if (s === '') return '';
  if (/^\/uploads\/[a-f0-9]+\.(png|jpg|webp|gif)$/.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]{1,1000}$/.test(s)) return s;
  throw new Error('Imagem inválida');
};
// Modelo 3D (Vista 3D): .glb enviado para a mesa, ou um link https para um .glb
const modelUrl = (v) => {
  const s = String(v ?? '');
  if (s === '') return '';
  if (/^\/uploads\/[a-f0-9]+\.glb$/.test(s) || /^\/modelos\/[a-z0-9-]+\.glb$/.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]{1,1000}\.glb(\?[^\s"'<>]*)?$/i.test(s)) return s;
  throw new Error('Modelo 3D inválido (use um arquivo .glb)');
};
const modelScale = (v) => Math.round(num(v, 0.2, 5, 1) * 100) / 100;
const modelTurn = (v) => ((Math.round(num(v, -720, 720, 0) / 15) * 15) % 360 + 360) % 360;
const abilityMod = (score) => Math.floor((score - 10) / 2);

function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(String(pw), salt, 64).toString('hex') };
}
function checkPw(user, pw) {
  const h = crypto.scryptSync(String(pw), user.salt, 64);
  return crypto.timingSafeEqual(h, Buffer.from(user.hash, 'hex'));
}
function userByToken(t) {
  const id = t && D().sessions[t];
  return id ? D().users.find((u) => u.id === id) || null : null;
}
function newSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  D().sessions[token] = userId;
  return token;
}
function validName(name) {
  const n = str(name, 40).trim();
  if (!n) throw new Error('Informe um nome');
  return n;
}
function validPassword(pw) {
  const p = String(pw ?? '');
  if (p.length < 4) throw new Error('A senha precisa ter pelo menos 4 caracteres');
  if (p.length > 200) throw new Error('Senha longa demais');
  return p;
}
function nextColor() {
  return COLORS[D().users.length % COLORS.length];
}

function newCharacter(name, ownerId) {
  return {
    id: uid(), name, ownerId: ownerId || null, img: '',
    class: '', race: '', background: '', level: 1,
    hp: 10, hpMax: 10, hpTemp: 0, ac: 10, speed: '9 m', initBonus: 0,
    attrs: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saves: {}, skills: {}, attacks: [],
    features: '', spells: '', inventory: '', notes: '',
    ...world.characterDefaults(),
  };
}

const CHAR_FIELDS = {
  name: (v) => str(v, 80).trim() || 'Sem nome',
  img: imgUrl,
  // Vista 3D: miniatura do personagem (.glb), tamanho e para onde ela olha
  model: modelUrl,
  modelScale,
  modelTurn,
  class: (v) => str(v, 80),
  race: (v) => str(v, 80),
  background: (v) => str(v, 80),
  level: (v) => int(v, 1, 20, 1),
  hp: (v) => int(v, -999, 9999),
  hpMax: (v) => int(v, 0, 9999),
  hpTemp: (v) => int(v, 0, 999),
  ac: (v) => int(v, 0, 99, 10),
  speed: (v) => str(v, 30),
  initBonus: (v) => int(v, -20, 20),
  attrs: (v) => Object.fromEntries(ATTRS.map((a) => [a, int(v?.[a], 1, 30, 10)])),
  saves: (v) => Object.fromEntries(ATTRS.filter((a) => v?.[a]).map((a) => [a, true])),
  skills: (v) => Object.fromEntries(SKILLS.filter((s) => v?.[s]).map((s) => [s, int(v[s], 0, 2)])),
  attacks: (v) => (Array.isArray(v) ? v : []).slice(0, 30).map((a) => ({
    name: str(a?.name, 80), bonus: int(a?.bonus, -30, 30), damage: str(a?.damage, 60),
  })),
  features: (v) => str(v),
  spells: (v) => str(v),
  // magias escolhidas na Biblioteca (ou escritas à mão): id do SRD, nome, círculo e se está preparada
  spellbook: (v) => (Array.isArray(v) ? v : []).slice(0, 300).map((x) => ({
    id: str(x?.id, 60), name: str(x?.name, 80).trim() || 'Magia', level: int(x?.level, 0, 9), prep: !!x?.prep,
  })),
  inventory: (v) => str(v),
  notes: (v) => str(v),
  conditions: (v) => [...new Set((Array.isArray(v) ? v : []).filter((c) => world.CONDITIONS.includes(c)))],
  slots: (v) => Array.from({ length: 9 }, (_, i) => {
    const max = int(v?.[i]?.max, 0, 9);
    return { max, used: int(v?.[i]?.used, 0, max) };
  }),
  hitDie: (v) => (['d6', 'd8', 'd10', 'd12'].includes(v) ? v : 'd8'),
  hdUsed: (v) => int(v, 0, 20),
  hdUsedBy: (v) => Object.fromEntries(['d6', 'd8', 'd10', 'd12'].map((d) => [d, int(v?.[d], 0, 20)])),
  coins: (v) => Object.fromEntries(['pc', 'pp', 'pe', 'po', 'pl'].map((k) => [k, int(v?.[k], 0, 9999999)])),
  xp: (v) => int(v, 0, 9999999),
  inspiration: (v) => !!v,
  deathSaves: (v) => ({ s: int(v?.s, 0, 3), f: int(v?.f, 0, 3) }),
  autoAc: (v) => !!v,
  hpBonus: (v) => int(v, -5, 10),
  // definidos pelo mestre (o jogador só vê)
  aspect: (v) => ({ month: str(v?.month, 40), name: str(v?.name, 80), base: str(v?.base, 2000), upgraded: str(v?.upgraded, 2000) }),
  ring: (v) => ({ name: str(v?.name, 80), base: str(v?.base, 2000), upgraded: str(v?.upgraded, 2000) }),
};
const GM_ONLY_CHAR = new Set(['aspect', 'ring']);

// fichas e cenas antigas ganham os campos novos ao carregar
function migrate() {
  const d = D();
  for (const c of d.characters) {
    for (const [k, v] of Object.entries(world.characterDefaults())) if (c[k] === undefined) c[k] = v;
    cls.syncClasses(c);
    c.hpRolls = cls.hpEntries(c);
  }
  for (const s of d.scenes) {
    if (!s.fog) s.fog = { enabled: false, ops: [] };
    if (!s.drawings) s.drawings = [];
    for (const t of s.tokens) {
      if (!t.conditions) t.conditions = [];
      if (t.model === undefined) Object.assign(t, { model: '', modelScale: 1, modelTurn: 0 });
    }
  }
  d.calendar = world.normalizeCalendar(d.calendar);
  if (!d.rules) d.rules = { hp: 'choose' };
  for (const h of d.handouts) if (h.queuedFor === undefined) { h.queuedFor = null; h.order = 0; }
}
migrate();

function activeScene() {
  return D().scenes.find((s) => s.id === D().activeSceneId) || null;
}
function findScene(id) {
  const s = D().scenes.find((x) => x.id === id);
  if (!s) throw new Error('Cena não encontrada');
  return s;
}
function findToken(sceneId, id) {
  const t = findScene(sceneId).tokens.find((x) => x.id === id);
  if (!t) throw new Error('Token não encontrado');
  return t;
}
function findChar(id) {
  const c = D().characters.find((x) => x.id === id);
  if (!c) throw new Error('Personagem não encontrado');
  return c;
}
function requireGM(user) {
  if (user.role !== 'gm') throw new Error('Só o mestre pode fazer isso');
}
function canMoveToken(user, token) {
  if (user.role === 'gm') return true;
  if (!token.characterId) return false;
  const c = D().characters.find((x) => x.id === token.characterId);
  return !!c && c.ownerId === user.id;
}

// ----------------------------------------------------------- state views
const online = new Map(); // userId -> nº de conexões abertas

function hpState(hp, hpMax) {
  if (!hpMax) return 'ok';
  if (hp <= 0) return 'down';
  if (hp <= hpMax / 2) return 'bloodied';
  return 'ok';
}

function viewFor(u) {
  const d = D();
  const gm = u.role === 'gm';
  const users = d.users.map((x) => ({ id: x.id, name: x.name, role: x.role, color: x.color, online: online.has(x.id) }));

  const characters = d.characters.map((c) => (gm || c.ownerId === u.id ? c : {
    id: c.id, name: c.name, img: c.img, ownerId: c.ownerId, class: c.class, race: c.race, level: c.level,
    hp: c.hp, hpMax: c.hpMax, hpTemp: c.hpTemp, conditions: c.conditions,
    equip: itemsLib.publicEquipment(c),
    model: c.model, modelScale: c.modelScale, modelTurn: c.modelTurn,
  }));

  const act = activeScene();
  let scene = null;
  if (act) {
    scene = {
      ...act,
      // jogador não recebe NPC oculto nem NPC escondido pela névoa
      tokens: act.tokens
        .filter((t) => gm || !t.hidden)
        .filter((t) => gm || t.characterId || !world.isCovered(act.fog, t.x + (t.size * act.gridSize) / 2, t.y + (t.size * act.gridSize) / 2))
        .map((t) => {
          if (gm || t.characterId) return t;
          const { hp, hpMax, monsterId, ...rest } = t; // jogador não vê PV exato nem a ficha do NPC
          return { ...rest, hpState: hpState(hp, hpMax) };
        }),
    };
  }

  const ini = d.initiative;
  const initiative = { ...ini, entries: ini.entries.filter((e) => gm || !e.hidden) };

  const handouts = gm
    ? d.handouts.slice().sort((a, b) => (a.queuedFor && b.queuedFor ? a.order - b.order : 0))
    : d.handouts
      .filter((h) => h.recipients.includes('all') || h.recipients.includes(u.id))
      .map(({ id, title, body, img, createdAt }) => ({ id, title, body, img, createdAt }));

  const compendium = gm ? d.compendium : d.compendium.filter((x) => x.visibility === 'all');

  return {
    me: { id: u.id, name: u.name, role: u.role, color: u.color },
    users,
    characters,
    scene,
    scenes: gm ? d.scenes.map((s) => ({ id: s.id, name: s.name, img: s.img, tokens: s.tokens.length })) : [],
    activeSceneId: d.activeSceneId,
    initiative,
    handouts,
    journal: d.journal,
    compendium,
    monsters: gm ? d.monsters : [],
    calendar: d.calendar,
    rules: d.rules || { hp: 'choose' },
    update: gm && latestVersion && newer(latestVersion, pkg.version) ? { current: pkg.version, latest: latestVersion, script: UPDATE_SCRIPT } : null,
  };
}

function canSeeMsg(user, m) {
  if (!m.private) return true;
  return user.role === 'gm' || m.userId === user.id;
}

// --------------------------------------------------------------- app http
const app = express();
app.disable('x-powered-by');
const smallJson = express.json({ limit: '1mb' });
app.use((req, res, next) => (req.path === '/api/restore' ? next() : smallJson(req, res, next)));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(store.UPLOADS, { maxAge: '7d' }));

function auth(req, res, next) {
  const u = userByToken(req.get('x-token'));
  if (!u) return res.status(401).json({ error: 'Sessão expirada. Entre de novo.' });
  req.user = u;
  next();
}

app.get('/api/status', (req, res) => {
  res.json({
    needsSetup: D().users.length === 0,
    users: D().users.map((u) => ({ id: u.id, name: u.name })),
  });
});

app.post('/api/setup', (req, res) => {
  try {
    if (D().users.length) return res.status(403).json({ error: 'A mesa já foi configurada' });
    const { salt, hash } = hashPw(validPassword(req.body.password));
    const user = { id: uid(), name: validName(req.body.name), role: 'gm', salt, hash, color: COLORS[0] };
    D().users.push(user);
    const token = newSession(user.id);
    store.save();
    res.json({ token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const failed = new Map(); // ip -> { n, until }
app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const f = failed.get(ip);
  if (f && f.until > Date.now()) return res.status(429).json({ error: 'Muitas tentativas. Espere um minuto.' });
  const user = D().users.find((u) => u.id === req.body.userId);
  if (!user || !checkPw(user, req.body.password ?? '')) {
    const n = (f?.n || 0) + 1;
    failed.set(ip, { n, until: n >= 8 ? Date.now() + 60_000 : 0 });
    return setTimeout(() => res.status(401).json({ error: 'Senha incorreta' }), 400);
  }
  failed.delete(ip);
  const token = newSession(user.id);
  store.save();
  res.json({ token });
});

app.post('/api/logout', auth, (req, res) => {
  delete D().sessions[req.get('x-token')];
  store.save();
  res.json({ ok: true });
});

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
// Modelos 3D (.glb): o navegador costuma mandar como "application/octet-stream", então vale a extensão
const isGlb = (file) => /\.glb$/i.test(file.originalname || '')
  && ['model/gltf-binary', 'application/octet-stream', ''].includes(file.mimetype || '');
const fileExt = (file) => EXT[file.mimetype] || (isGlb(file) ? '.glb' : null);
const upload = multer({
  storage: multer.diskStorage({
    destination: store.UPLOADS,
    filename: (req, file, cb) => cb(null, uid() + uid() + fileExt(file)),
  }),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!fileExt(file)),
});
app.post('/api/upload', auth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo grande demais (máx. 40 MB)' : err.message;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem PNG, JPG, WEBP ou GIF (ou um modelo 3D .glb)' });
    if (req.file.filename.endsWith('.glb')) {
      // confere a assinatura do arquivo ("glTF" nos 4 primeiros bytes)
      let head = Buffer.alloc(0);
      try {
        const fd = fs.openSync(req.file.path, 'r');
        head = Buffer.alloc(4);
        fs.readSync(fd, head, 0, 4, 0);
        fs.closeSync(fd);
      } catch { /* trata como inválido */ }
      if (head.toString('latin1') !== 'glTF') {
        fs.rm(req.file.path, () => {});
        return res.status(400).json({ error: 'Esse arquivo não é um modelo .glb válido' });
      }
    }
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

// Carregar um arquivo de backup (.json baixado antes) — só o mestre
app.post('/api/restore', express.json({ limit: '50mb' }), auth, (req, res) => {
  if (req.user.role !== 'gm') return res.status(403).json({ error: 'Só o mestre' });
  try {
    restoreFrom(req.body, req.user);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/backup', auth, (req, res) => {
  if (req.user.role !== 'gm') return res.status(403).json({ error: 'Só o mestre' });
  const { sessions, ...rest } = D();
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="tabula-backup-${stamp}.json"`);
  res.json(rest);
});

// ------------------------------------------------------------- realtime
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 2e6 });

function eachSocket(fn) {
  for (const s of io.sockets.sockets.values()) {
    const u = D().users.find((x) => x.id === s.data.userId);
    if (u) fn(s, u);
  }
}
let pending = false;
function broadcastState() {
  if (pending) return;
  pending = true;
  setImmediate(() => {
    pending = false;
    eachSocket((s, u) => s.emit('state', viewFor(u)));
  });
}
function pushChat(msg) {
  const d = D();
  d.chat.push(msg);
  if (d.chat.length > 300) d.chat.splice(0, d.chat.length - 300);
  eachSocket((s, u) => { if (canSeeMsg(u, msg)) s.emit('chat', msg); });
}
function chatBase(user, extra) {
  return { id: uid(), ts: Date.now(), userId: user.id, userName: user.name, color: user.color, private: false, ...extra };
}
function sortInitiative() {
  D().initiative.entries.sort((a, b) => b.value - a.value || (b.tiebreak || 0) - (a.tiebreak || 0));
}
// avisa o dono de um personagem que um item chegou na mochila dele (se não foi ele mesmo que pôs)
function notifyItem(actor, c, name, fromName) {
  if (!c.ownerId || c.ownerId === actor.id) return;
  eachSocket((s, u) => {
    if (u.id === c.ownerId) s.emit('item:new', { char: c.name, name, from: fromName || (actor.role === 'gm' ? 'O mestre' : actor.name) });
  });
}
function myChar(user, id) {
  const c = findChar(id);
  if (user.role !== 'gm' && c.ownerId !== user.id) throw new Error('Esse personagem não é seu');
  if (!Array.isArray(c.items)) c.items = [];
  return c;
}
function findItem(c, id) {
  const it = c.items.find((x) => x.id === id);
  if (!it) throw new Error('Item não encontrado');
  return it;
}

function notifyHandout(h, prevRecipients) {
  const before = new Set(prevRecipients);
  eachSocket((s, u) => {
    if (u.role === 'gm') return;
    const now = h.recipients.includes('all') || h.recipients.includes(u.id);
    const had = before.has('all') || before.has(u.id);
    if (now && !had) s.emit('handout:new', { id: h.id, title: h.title });
  });
}

// Volta a campanha para um backup. Antes, guarda o estado atual (para poder desfazer).
function restoreFrom(obj, user) {
  const before = store.snapshot('antes-de-restaurar');
  store.replace(obj);
  migrate();
  console.log(`  [backup] ${user.name} restaurou um backup (o estado anterior ficou em backups/${before})`);
  eachSocket((s, u) => s.emit('chat:history', D().chat.filter((m) => canSeeMsg(u, m))));
  for (const s of io.sockets.sockets.values()) {
    if (!D().users.some((x) => x.id === s.data.userId)) s.disconnect(true);
    else s.emit('restored', { by: user.name });
  }
  broadcastState();
}

let closing = false;
function closeTable(reason, label) {
  if (closing) return;
  closing = true;
  console.log('\n  Salvando a campanha…');
  try {
    store.flush();
    if (D().users.length) {
      const name = store.snapshot(label);
      console.log(`  ✓ Campanha salva. Backup desta sessão: backups${path.sep}${name}`);
    } else {
      console.log('  ✓ Campanha salva.');
    }
  } catch (e) {
    console.error('  [ERRO] ao salvar:', e.message);
  }
  console.log(`  ${reason}\n`);
}

const handlers = {
  // ---------- usuários (mestre)
  'user:create'(user, p) {
    requireGM(user);
    const name = validName(p.name);
    if (D().users.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw new Error('Já existe alguém com esse nome');
    const role = ['gm', 'player', 'viewer'].includes(p.role) ? p.role : 'player';
    const { salt, hash } = hashPw(validPassword(p.password));
    const u = { id: uid(), name, role, salt, hash, color: nextColor() };
    D().users.push(u);
    return { id: u.id };
  },
  'user:update'(user, p) {
    requireGM(user);
    const u = D().users.find((x) => x.id === p.id);
    if (!u) throw new Error('Usuário não encontrado');
    if (p.name !== undefined) u.name = validName(p.name);
    if (p.password !== undefined) Object.assign(u, hashPw(validPassword(p.password)));
    if (p.role !== undefined && u.id !== user.id) u.role = ['gm', 'player', 'viewer'].includes(p.role) ? p.role : u.role;
    if (p.color !== undefined && /^#[0-9a-f]{6}$/i.test(p.color)) u.color = p.color;
  },
  'user:delete'(user, p) {
    requireGM(user);
    if (p.id === user.id) throw new Error('Você não pode excluir a sua própria conta');
    const d = D();
    d.users = d.users.filter((u) => u.id !== p.id);
    for (const [t, id] of Object.entries(d.sessions)) if (id === p.id) delete d.sessions[t];
    for (const c of d.characters) if (c.ownerId === p.id) c.ownerId = null;
    for (const h of d.handouts) h.recipients = h.recipients.filter((r) => r !== p.id);
    io.in('u:' + p.id).disconnectSockets(true);
  },

  // ---------- personagens
  'character:create'(user, p) {
    requireGM(user);
    const owner = p.ownerId && D().users.find((u) => u.id === p.ownerId);
    const c = newCharacter(CHAR_FIELDS.name(p.name), owner ? owner.id : null);
    cls.syncClasses(c);
    D().characters.push(c);
    return { id: c.id };
  },
  'character:update'(user, p) {
    const c = findChar(p.id);
    const gm = user.role === 'gm';
    if (!gm && c.ownerId !== user.id) throw new Error('Esse personagem não é seu');
    const patch = { ...(p.patch || {}) };
    if ('ownerId' in patch) requireGM(user);
    if (c.hpAuto) delete patch.hpMax;          // com PV pela classe, o máximo é calculado
    if ((c.classes?.length || 0) > 1 && !('classes' in patch)) { delete patch.class; delete patch.level; delete patch.hitDie; }
    const prevMax = c.hpMax;
    if (!gm && Object.keys(patch).some((k) => GM_ONLY_CHAR.has(k))) throw new Error('O aspecto e o anel são definidos pelo mestre');
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'ownerId') {
        requireGM(user);
        c.ownerId = v && D().users.some((u) => u.id === v) ? v : null;
      } else if (CHAR_FIELDS[k]) {
        c[k] = CHAR_FIELDS[k](v);
      }
    }
    // classes: com uma classe só, a ficha edita class/level/hitDie; com várias (multiclasse), a lista manda
    const keys = new Set(Object.keys(patch));
    if (keys.has('classes')) {
      const next = cls.normalizeClasses(patch.classes, c.classes || []);
      if (!next.length) throw new Error('O personagem precisa de pelo menos uma classe');
      const ids = new Set(next.map((k) => k.id));
      c.hpRolls = cls.hpEntries(c).filter((r) => ids.has(r.cid));   // classe removida leva junto os PV dela
      c.classes = next;
    }
    cls.syncClasses(c, keys);
    cls.applyAutoHp(c, prevMax);
    itemsLib.applyAutoAc(c);
    return { hitDie: c.hitDie };
  },

  // ---------- PV pela classe
  'hp:auto'(user, p) {
    const c = myChar(user, p.charId);
    if (!p.on) {
      requireGM(user);   // só o mestre volta para os PV digitados à mão
      c.hpAuto = false;
      return {};
    }
    const prevMax = c.hpMax;
    c.hpAuto = true;
    if (!Array.isArray(c.hpRolls)) c.hpRolls = [];
    cls.syncClasses(c);
    cls.applyAutoHp(c, prevMax);
    return { pending: cls.hpPending(c) };
  },
  'hp:level'(user, p) {
    const c = myChar(user, p.charId);
    if (!c.hpAuto) throw new Error('Ligue antes os PV pela classe');
    const pend = cls.hpPendingList(c);
    if (!pend.length) throw new Error('Não há nível novo para ganhar PV');
    const which = pend.find((x) => x.cid === p.cid) || pend[0];
    const rule = D().rules?.hp || 'choose';
    const mode = p.mode === 'avg' ? 'avg' : 'roll';
    if (user.role !== 'gm' && rule !== 'choose' && rule !== mode) {
      throw new Error(rule === 'roll' ? 'Nesta mesa os PV de cada nível são rolados' : 'Nesta mesa os PV de cada nível são a média fixa');
    }
    const k = c.classes.find((x) => x.id === which.cid);
    const sides = k.die;
    const done = cls.hpEntries(c).filter((r) => r.cid === k.id).length;
    const classLevel = done + (c.classes[0].id === k.id ? 2 : 1);
    const label = c.classes.length > 1 ? `${k.name || 'classe'} ${classLevel}` : `${classLevel}º nível`;
    const per = cls.conMod(c) + (Number(c.hpBonus) || 0);
    let value;
    if (mode === 'roll') {
      // rola o dado já com a CON (e o bônus por nível), para o chat mostrar o total ganho
      const r = roll(`1d${sides}${per ? (per > 0 ? '+' : '') + per : ''}`);
      value = r.total - per;
      pushChat(chatBase(user, { type: 'roll', label: `${c.name} — PV de ${label}`, roll: r }));
    } else {
      value = cls.dieAverage(sides);
    }
    const prevMax = c.hpMax;
    c.hpRolls = [...cls.hpEntries(c), { cid: k.id, v: value }];
    cls.applyAutoHp(c, prevMax);
    const gain = c.hpMax - prevMax;
    pushChat(chatBase(user, { type: 'system', text: `⬆ ${c.name}, ${label}: +${gain} PV (${mode === 'roll' ? `rolou ${value}` : `média ${value}`}${per ? ` ${per > 0 ? '+' : '−'} ${Math.abs(per)}` : ''}). PV máximos: ${c.hpMax}.` }));
    return { value, gain, hpMax: c.hpMax, pending: cls.hpPending(c) };
  },
  'hp:undo'(user, p) {
    requireGM(user);
    const c = myChar(user, p.charId);
    if (!c.hpRolls?.length) throw new Error('Não há rolagem de PV para desfazer');
    const prevMax = c.hpMax;
    c.hpRolls = cls.hpEntries(c).slice(0, -1);
    cls.applyAutoHp(c, prevMax);
    return { hpMax: c.hpMax };
  },
  'rules:set'(user, p) {
    requireGM(user);
    D().rules = { ...(D().rules || {}), hp: ['choose', 'roll', 'avg'].includes(p.hp) ? p.hp : 'choose' };
  },

  // ---------- itens e equipamento (dono do personagem ou mestre)
  'item:save'(user, p) {
    const c = myChar(user, p.charId);
    const raw = p.item || {};
    let it;
    if (raw.id) {
      const i = c.items.findIndex((x) => x.id === raw.id);
      if (i < 0) throw new Error('Item não encontrado');
      it = itemsLib.normalizeItem(raw, c.items[i], imgUrl);
      c.items[i] = it;
    } else {
      if (c.items.length >= itemsLib.MAX_ITEMS) throw new Error('A mochila está cheia (máximo de 200 itens)');
      it = itemsLib.normalizeItem(raw, null, imgUrl);
      it.id = uid();
      c.items.push(it);
      notifyItem(user, c, it.name);
    }
    if (it.slot) {
      try { itemsLib.equip(c.items, it, it.slot, it.grip); } catch { it.slot = null; }
    }
    itemsLib.applyAutoAc(c);
    return { id: it.id };
  },
  // Vários itens de uma vez (Biblioteca do compêndio: um item, um pacote inteiro, um item mágico dado pelo mestre).
  // Itens iguais que não vão no corpo (tochas, rações…) juntam na mesma pilha.
  'item:addMany'(user, p) {
    const c = myChar(user, p.charId);
    const list = (Array.isArray(p.items) ? p.items : []).slice(0, 40);
    if (!list.length) throw new Error('Nenhum item');
    const names = [];
    for (const raw of list) {
      const it = itemsLib.normalizeItem(raw, null, imgUrl);
      const stack = !itemsLib.KINDS[it.kind].length && it.srd
        && c.items.find((x) => x.srd === it.srd && x.name === it.name && !x.slot);
      if (stack) {
        stack.qty = Math.min(9999, stack.qty + it.qty);
      } else {
        if (c.items.length >= itemsLib.MAX_ITEMS) throw new Error('A mochila está cheia (máximo de 200 itens)');
        it.id = uid();
        c.items.push(it);
      }
      names.push(it.qty > 1 ? `${it.name} (×${it.qty})` : it.name);
    }
    notifyItem(user, c, p.label ? str(p.label, 80) : names.join(', ').slice(0, 200));
    itemsLib.applyAutoAc(c);
    return { count: list.length };
  },
  'item:delete'(user, p) {
    const c = myChar(user, p.charId);
    c.items = c.items.filter((x) => x.id !== p.itemId);
    itemsLib.applyAutoAc(c);
  },
  'item:equip'(user, p) {
    const c = myChar(user, p.charId);
    const it = findItem(c, p.itemId);
    itemsLib.equip(c.items, it, p.slot ?? null, p.grip);
    itemsLib.applyAutoAc(c);
  },
  'item:attune'(user, p) {
    const c = myChar(user, p.charId);
    const it = findItem(c, p.itemId);
    if (p.on) {
      if (!it.attune) throw new Error('Esse item não precisa de sintonização');
      const n = c.items.filter((x) => x.attuned && x !== it).length;
      if (n >= itemsLib.MAX_ATTUNED) throw new Error(`Já há ${itemsLib.MAX_ATTUNED} itens sintonizados. Desfaça a sintonia de um antes.`);
      it.attuned = true;
    } else {
      it.attuned = false;
    }
    itemsLib.applyAutoAc(c);
  },
  'item:split'(user, p) {
    const c = myChar(user, p.charId);
    const it = findItem(c, p.itemId);
    if (it.qty < 2) throw new Error('Só há um');
    if (c.items.length >= itemsLib.MAX_ITEMS) throw new Error('A mochila está cheia');
    it.qty -= 1;
    const copy = { ...it, id: uid(), qty: 1, slot: null, attuned: false };
    c.items.splice(c.items.indexOf(it) + 1, 0, copy);
    return { id: copy.id };
  },
  'item:give'(user, p) {
    const from = myChar(user, p.charId);
    const it = findItem(from, p.itemId);
    const to = findChar(p.toCharId);
    if (to === from) throw new Error('Escolha outro personagem');
    if (to.items.length >= itemsLib.MAX_ITEMS) throw new Error(`A mochila de ${to.name} está cheia`);
    const qty = int(p.qty, 1, it.qty, it.qty);
    let moved;
    if (qty < it.qty) {
      it.qty -= qty;
      moved = { ...it, id: uid(), qty };
    } else {
      from.items = from.items.filter((x) => x !== it);
      moved = it;
    }
    moved.slot = null;
    moved.attuned = false;
    to.items.push(moved);
    itemsLib.applyAutoAc(from);
    notifyItem(user, to, qty > 1 ? `${moved.name} (×${qty})` : moved.name, from.name);
    return { name: moved.name, to: to.name };
  },
  'character:delete'(user, p) {
    requireGM(user);
    const d = D();
    d.characters = d.characters.filter((c) => c.id !== p.id);
    for (const s of d.scenes) s.tokens = s.tokens.filter((t) => t.characterId !== p.id);
    d.initiative.entries = d.initiative.entries.filter((e) => e.characterId !== p.id);
  },

  // ---------- cenas
  'scene:create'(user, p) {
    requireGM(user);
    const s = {
      id: uid(), name: str(p.name, 80).trim() || 'Nova cena', img: imgUrl(p.img),
      gridSize: num(p.gridSize, 10, 1000, 70), gridOffsetX: 0, gridOffsetY: 0, showGrid: true, snap: true, tokens: [],
      fog: { enabled: false, ops: [] }, drawings: [],
    };
    D().scenes.push(s);
    if (!D().activeSceneId) D().activeSceneId = s.id;
    return { id: s.id };
  },
  'scene:update'(user, p) {
    requireGM(user);
    const s = findScene(p.id);
    const f = p.patch || {};
    if (f.name !== undefined) s.name = str(f.name, 80).trim() || s.name;
    if (f.img !== undefined) s.img = imgUrl(f.img);
    if (f.gridSize !== undefined) s.gridSize = num(f.gridSize, 10, 1000, 70);
    if (f.gridOffsetX !== undefined) s.gridOffsetX = num(f.gridOffsetX, -500, 500);
    if (f.gridOffsetY !== undefined) s.gridOffsetY = num(f.gridOffsetY, -500, 500);
    if (f.showGrid !== undefined) s.showGrid = !!f.showGrid;
    if (f.snap !== undefined) s.snap = !!f.snap;
  },
  'scene:activate'(user, p) {
    requireGM(user);
    findScene(p.id);
    D().activeSceneId = p.id;
  },
  'scene:delete'(user, p) {
    requireGM(user);
    const d = D();
    d.scenes = d.scenes.filter((s) => s.id !== p.id);
    if (d.activeSceneId === p.id) d.activeSceneId = d.scenes[0]?.id || null;
  },

  // ---------- tokens
  'token:create'(user, p) {
    requireGM(user);
    const s = findScene(p.sceneId);
    let characterId = null;
    if (p.characterId) {
      characterId = findChar(p.characterId).id;
      if (s.tokens.some((t) => t.characterId === characterId)) throw new Error('Esse personagem já está nesta cena');
    }
    const monster = p.monsterId ? findMonster(p.monsterId) : null;
    const t = {
      id: uid(), characterId, monsterId: monster ? monster.id : null,
      name: str(p.name, 80).trim() || monster?.name || 'Token', img: imgUrl(p.img ?? monster?.img ?? ''),
      model: modelUrl(p.model ?? monster?.model ?? ''), modelScale: modelScale(p.modelScale ?? monster?.modelScale ?? 1),
      modelTurn: modelTurn(p.modelTurn ?? monster?.modelTurn ?? 0),
      x: num(p.x, -1e5, 1e5), y: num(p.y, -1e5, 1e5), size: num(p.size, 0.5, 10, 1),
      hidden: !!p.hidden, conditions: [],
      hp: int(p.hp ?? monster?.hp, -999, 9999), hpMax: int(p.hpMax ?? p.hp ?? monster?.hp, 0, 9999),
    };
    s.tokens.push(t);
    return { id: t.id };
  },
  // Coloca vários tokens de uma ficha do bestiário de uma vez (Goblin 1, Goblin 2…)
  'token:createMany'(user, p) {
    requireGM(user);
    const s = findScene(p.sceneId);
    const monster = findMonster(p.monsterId);
    const list = (Array.isArray(p.tokens) ? p.tokens : []).slice(0, 30);
    if (!list.length) throw new Error('Nada para colocar');
    const ids = [];
    for (const q of list) {
      const t = {
        id: uid(), characterId: null, monsterId: monster.id,
        name: str(q.name, 80).trim() || monster.name, img: monster.img || '',
        model: monster.model || '', modelScale: monster.modelScale || 1, modelTurn: monster.modelTurn || 0,
        x: num(q.x, -1e5, 1e5), y: num(q.y, -1e5, 1e5), size: num(q.size, 0.5, 10, 1),
        hidden: !!p.hidden, conditions: [],
        hp: int(q.hp ?? monster.hp, -999, 9999), hpMax: int(q.hp ?? monster.hp, 0, 9999),
      };
      s.tokens.push(t);
      ids.push(t.id);
    }
    return { ids };
  },
  'token:update'(user, p) {
    requireGM(user);
    const t = findToken(p.sceneId, p.id);
    const f = p.patch || {};
    if (f.name !== undefined) t.name = str(f.name, 80).trim() || t.name;
    if (f.img !== undefined) t.img = imgUrl(f.img);
    if (f.model !== undefined) t.model = modelUrl(f.model);
    if (f.modelScale !== undefined) t.modelScale = modelScale(f.modelScale);
    if (f.modelTurn !== undefined) t.modelTurn = modelTurn(f.modelTurn);
    if (f.size !== undefined) t.size = num(f.size, 0.5, 10, 1);
    if (f.hidden !== undefined) t.hidden = !!f.hidden;
    if (f.hp !== undefined) t.hp = int(f.hp, -999, 9999);
    if (f.hpMax !== undefined) t.hpMax = int(f.hpMax, 0, 9999);
    if (f.x !== undefined) t.x = num(f.x, -1e5, 1e5);
    if (f.y !== undefined) t.y = num(f.y, -1e5, 1e5);
    if (f.monsterId !== undefined) t.monsterId = f.monsterId ? findMonster(f.monsterId).id : null;
    if (f.conditions !== undefined) t.conditions = CHAR_FIELDS.conditions(f.conditions);
  },
  'token:delete'(user, p) {
    requireGM(user);
    const s = findScene(p.sceneId);
    s.tokens = s.tokens.filter((t) => t.id !== p.id);
    D().initiative.entries = D().initiative.entries.filter((e) => e.tokenId !== p.id);
  },
  // movimento: não reenvia o estado inteiro, só a posição (mais leve durante o arrasto)
  'token:move'(user, p) {
    const t = findToken(p.sceneId, p.id);
    if (!canMoveToken(user, t)) throw new Error('Você só pode mover o seu próprio token');
    t.x = num(p.x, -1e5, 1e5);
    t.y = num(p.y, -1e5, 1e5);
    const msg = { sceneId: p.sceneId, id: t.id, x: t.x, y: t.y, by: user.id };
    eachSocket((s, u) => { if (!t.hidden || u.role === 'gm') s.emit('token:moved', msg); });
    store.save();
    return { silent: true };
  },
  'ping'(user, p) {
    const msg = { x: num(p.x, -1e5, 1e5), y: num(p.y, -1e5, 1e5), color: user.color, name: user.name };
    io.emit('ping', msg);
    return { silent: true };
  },

  // ---------- dados e chat
  'roll'(user, p) {
    const result = roll(p.formula);
    pushChat(chatBase(user, {
      type: 'roll', label: str(p.label, 120), roll: result, private: !!p.private,
    }));
    return { total: result.total };
  },
  'chat:send'(user, p) {
    const text = str(p.text, 2000).trim();
    if (!text) throw new Error('Mensagem vazia');
    pushChat(chatBase(user, { type: 'text', text }));
  },
  'chat:clear'(user) {
    requireGM(user);
    D().chat = [];
    io.emit('chat:history', []);
  },

  // ---------- iniciativa
  'init:add'(user, p) {
    requireGM(user);
    D().initiative.entries.push({
      id: uid(), name: str(p.name, 80).trim() || '?', value: int(p.value, -50, 99),
      hidden: !!p.hidden, tokenId: null, characterId: null, img: '',
    });
    sortInitiative();
  },
  'init:addScene'(user) {
    requireGM(user);
    const s = activeScene();
    if (!s) throw new Error('Nenhuma cena ativa');
    const ini = D().initiative;
    const lines = [];
    for (const t of s.tokens) {
      if (ini.entries.some((e) => e.tokenId === t.id || (t.characterId && e.characterId === t.characterId))) continue;
      const c = t.characterId ? D().characters.find((x) => x.id === t.characterId) : null;
      const bonus = c ? abilityMod(c.attrs.dex) + (c.initBonus || 0) : 0;
      const r = roll('1d20' + (bonus ? (bonus > 0 ? '+' : '') + bonus : ''));
      ini.entries.push({
        id: uid(), name: c ? c.name : t.name, value: r.total, tiebreak: bonus,
        hidden: !!t.hidden, tokenId: t.id, characterId: c ? c.id : null, img: c ? c.img : t.img,
      });
      lines.push(`${c ? c.name : t.name}: ${r.total}`);
    }
    sortInitiative();
    if (lines.length) pushChat(chatBase(user, { type: 'text', text: 'Iniciativa (rolada pelo mestre)\n' + lines.join('\n'), private: true }));
  },
  'init:rollMine'(user) {
    const chars = D().characters.filter((c) => c.ownerId === user.id);
    if (!chars.length) throw new Error('Você não tem personagem vinculado');
    const ini = D().initiative;
    const scene = activeScene();
    for (const c of chars) {
      const bonus = abilityMod(c.attrs.dex) + (c.initBonus || 0);
      const r = roll('1d20' + (bonus ? (bonus > 0 ? '+' : '') + bonus : ''));
      pushChat(chatBase(user, { type: 'roll', label: `Iniciativa — ${c.name}`, roll: r }));
      const tok = scene?.tokens.find((t) => t.characterId === c.id);
      const existing = ini.entries.find((e) => e.characterId === c.id);
      if (existing) Object.assign(existing, { value: r.total, tiebreak: bonus });
      else ini.entries.push({
        id: uid(), name: c.name, value: r.total, tiebreak: bonus, hidden: false,
        tokenId: tok?.id || null, characterId: c.id, img: c.img,
      });
    }
    sortInitiative();
  },
  'init:update'(user, p) {
    requireGM(user);
    const e = D().initiative.entries.find((x) => x.id === p.id);
    if (!e) throw new Error('Entrada não encontrada');
    if (p.value !== undefined) e.value = int(p.value, -50, 99);
    if (p.name !== undefined) e.name = str(p.name, 80).trim() || e.name;
    if (p.hidden !== undefined) e.hidden = !!p.hidden;
    sortInitiative();
  },
  'init:remove'(user, p) {
    requireGM(user);
    const ini = D().initiative;
    if (ini.currentId === p.id) {
      const i = ini.entries.findIndex((e) => e.id === p.id);
      const next = ini.entries[i + 1] || ini.entries[0];
      ini.currentId = next && next.id !== p.id ? next.id : null;
    }
    ini.entries = ini.entries.filter((e) => e.id !== p.id);
  },
  'init:start'(user) {
    requireGM(user);
    const ini = D().initiative;
    if (!ini.entries.length) throw new Error('Adicione combatentes antes de começar');
    sortInitiative();
    Object.assign(ini, { active: true, round: 1, currentId: ini.entries[0].id });
    pushChat(chatBase(user, { type: 'system', text: '⚔ O combate começou! Rodada 1.' }));
  },
  'init:next'(user, p) {
    const ini = D().initiative;
    if (!ini.active || !ini.entries.length) throw new Error('Nenhum combate em andamento');
    const cur = ini.entries.find((e) => e.id === ini.currentId);
    const mine = cur?.characterId && D().characters.find((c) => c.id === cur.characterId)?.ownerId === user.id;
    if (user.role !== 'gm' && !mine) throw new Error('Não é a sua vez');
    const dir = user.role === 'gm' && p.dir === -1 ? -1 : 1;
    let i = ini.entries.findIndex((e) => e.id === ini.currentId);
    i += dir;
    if (i >= ini.entries.length) { i = 0; ini.round += 1; pushChat(chatBase(user, { type: 'system', text: `Rodada ${ini.round}.` })); }
    if (i < 0) { i = ini.entries.length - 1; ini.round = Math.max(1, ini.round - 1); }
    ini.currentId = ini.entries[i].id;
  },
  'init:end'(user) {
    requireGM(user);
    D().initiative = { entries: [], currentId: null, round: 1, active: false };
    pushChat(chatBase(user, { type: 'system', text: 'O combate terminou.' }));
  },

  // ---------- segredos / handouts
  'handout:create'(user, p) {
    requireGM(user);
    const queuedFor = p.queuedFor && D().users.some((u) => u.id === p.queuedFor) ? p.queuedFor : null;
    const order = queuedFor ? Math.max(0, ...D().handouts.filter((x) => x.queuedFor === queuedFor).map((x) => x.order)) + 1 : 0;
    const h = {
      id: uid(), title: str(p.title, 120).trim() || 'Sem título', body: str(p.body), img: imgUrl(p.img || ''),
      recipients: [], createdAt: Date.now(), queuedFor, order,
    };
    D().handouts.unshift(h);
    return { id: h.id };
  },
  'handout:update'(user, p) {
    requireGM(user);
    const h = D().handouts.find((x) => x.id === p.id);
    if (!h) throw new Error('Segredo não encontrado');
    const f = p.patch || {};
    const prev = h.recipients.slice();
    if (f.title !== undefined) h.title = str(f.title, 120).trim() || h.title;
    if (f.body !== undefined) h.body = str(f.body);
    if (f.img !== undefined) h.img = imgUrl(f.img);
    if (f.recipients !== undefined) {
      const ids = new Set(D().users.map((u) => u.id));
      h.recipients = (Array.isArray(f.recipients) ? f.recipients : []).filter((r) => r === 'all' || ids.has(r));
    }
    notifyHandout(h, prev);
  },
  'handout:delete'(user, p) {
    requireGM(user);
    D().handouts = D().handouts.filter((h) => h.id !== p.id);
  },

  // ---------- diário do grupo (todos escrevem; autor ou mestre editam/apagam)
  'journal:create'(user, p) {
    if (user.role === 'viewer') throw new Error('O telão não escreve no diário');
    const body = str(p.body, 20000).trim();
    const img = imgUrl(p.img || '');
    if (!body && !img) throw new Error('Escreva alguma coisa antes de publicar');
    const e = {
      id: uid(), userId: user.id, title: str(p.title, 120).trim(), body, img,
      createdAt: Date.now(), updatedAt: null,
    };
    D().journal.unshift(e);
    return { id: e.id };
  },
  'journal:update'(user, p) {
    const e = D().journal.find((x) => x.id === p.id);
    if (!e) throw new Error('Entrada não encontrada');
    if (e.userId !== user.id && user.role !== 'gm') throw new Error('Só quem escreveu (ou o mestre) pode editar');
    const f = p.patch || {};
    if (f.title !== undefined) e.title = str(f.title, 120).trim();
    if (f.body !== undefined) e.body = str(f.body, 20000).trim();
    if (f.img !== undefined) e.img = imgUrl(f.img);
    e.updatedAt = Date.now();
  },
  'journal:delete'(user, p) {
    const e = D().journal.find((x) => x.id === p.id);
    if (!e) return;
    if (e.userId !== user.id && user.role !== 'gm') throw new Error('Só quem escreveu (ou o mestre) pode apagar');
    D().journal = D().journal.filter((x) => x.id !== p.id);
  },

  // ---------- compêndio (só o mestre escreve; cada página é "só mestre" ou "todos")
  'compendium:create'(user, p) {
    requireGM(user);
    const page = {
      id: uid(), createdAt: Date.now(), updatedAt: Date.now(),
      ...compendiumFields(p, { title: 'Sem título', category: 'Geral', body: '', images: [], visibility: 'gm' }),
    };
    D().compendium.unshift(page);
    return { id: page.id };
  },
  'compendium:update'(user, p) {
    requireGM(user);
    const page = D().compendium.find((x) => x.id === p.id);
    if (!page) throw new Error('Página não encontrada');
    Object.assign(page, compendiumFields(p.patch || {}, page), { updatedAt: Date.now() });
  },
  'compendium:delete'(user, p) {
    requireGM(user);
    D().compendium = D().compendium.filter((x) => x.id !== p.id);
  },

  // ---------- névoa de guerra (mestre)
  'fog:set'(user, p) {
    requireGM(user);
    const s = findScene(p.sceneId);
    s.fog.enabled = !!p.enabled;
  },
  'fog:op'(user, p) {
    requireGM(user);
    const s = findScene(p.sceneId);
    const op = p.op === 'hide' ? 'hide' : 'reveal';
    let o;
    if (p.shape === 'circle') o = { op, shape: 'circle', x: num(p.x, -1e5, 1e5), y: num(p.y, -1e5, 1e5), r: num(p.r, 1, 1e5) };
    else if (p.shape === 'rect') o = { op, shape: 'rect', x: num(p.x, -1e5, 1e5), y: num(p.y, -1e5, 1e5), w: num(p.w, 1, 2e5), h: num(p.h, 1, 2e5) };
    else throw new Error('Forma inválida');
    s.fog.enabled = true;
    s.fog.ops.push(o);
    if (s.fog.ops.length > 600) s.fog.ops.splice(0, s.fog.ops.length - 600);
  },
  'fog:reset'(user, p) {
    requireGM(user);
    const s = findScene(p.sceneId);
    s.fog.ops = p.mode === 'reveal' ? [{ op: 'reveal', shape: 'all' }] : [];
    s.fog.enabled = true;
  },
  'fog:undo'(user, p) {
    requireGM(user);
    findScene(p.sceneId).fog.ops.pop();
  },

  // ---------- desenhos e áreas de magia (todos; cada um apaga o que é seu)
  'draw:add'(user, p) {
    if (user.role === 'viewer') throw new Error('O telão não desenha');
    const s = findScene(p.sceneId);
    const kinds = ['free', 'arrow', 'circle', 'cone', 'line', 'square'];
    if (!kinds.includes(p.kind)) throw new Error('Desenho inválido');
    const pts = (Array.isArray(p.pts) ? p.pts : []).slice(0, 2000).map((v) => Math.round(num(v, -1e5, 1e5)));
    if (pts.length < 4 || pts.length % 2) throw new Error('Desenho vazio');
    const d = { id: uid(), userId: user.id, kind: p.kind, pts, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : user.color };
    s.drawings.push(d);
    if (s.drawings.length > 300) s.drawings.shift();
    return { id: d.id };
  },
  'draw:delete'(user, p) {
    const s = findScene(p.sceneId);
    const d = s.drawings.find((x) => x.id === p.id);
    if (!d) return;
    if (d.userId !== user.id && user.role !== 'gm') throw new Error('Só quem desenhou (ou o mestre) pode apagar');
    s.drawings = s.drawings.filter((x) => x.id !== p.id);
  },
  'draw:clear'(user, p) {
    const s = findScene(p.sceneId);
    s.drawings = user.role === 'gm' && p.all ? [] : s.drawings.filter((x) => x.userId !== user.id);
  },
  // régua: não salva nada, só mostra para todos enquanto alguém mede
  'measure'(user, p) {
    const msg = p.clear ? { userId: user.id, clear: true } : {
      userId: user.id, name: user.name, color: user.color,
      x1: num(p.x1, -1e5, 1e5), y1: num(p.y1, -1e5, 1e5), x2: num(p.x2, -1e5, 1e5), y2: num(p.y2, -1e5, 1e5), label: str(p.label, 40),
    };
    io.emit('measure', msg);
    return { silent: true };
  },

  // ---------- fila de memórias (segredos que o mestre libera em ordem)
  'handout:releaseNext'(user, p) {
    requireGM(user);
    const d = D();
    const targets = p.userId === 'all'
      ? [...new Set(d.handouts.filter((h) => h.queuedFor).map((h) => h.queuedFor))]
      : [p.userId];
    let n = 0;
    for (const uidT of targets) {
      const next = d.handouts.filter((h) => h.queuedFor === uidT).sort((a, b) => a.order - b.order)[0];
      if (!next) continue;
      const prev = next.recipients.slice();
      next.recipients = [uidT];
      next.queuedFor = null;
      next.createdAt = Date.now();
      notifyHandout(next, prev);
      n += 1;
    }
    if (!n) throw new Error('Não há memórias na fila');
    return { released: n };
  },
  'handout:queueMove'(user, p) {
    requireGM(user);
    const h = D().handouts.find((x) => x.id === p.id);
    if (!h || !h.queuedFor) return;
    const list = D().handouts.filter((x) => x.queuedFor === h.queuedFor).sort((a, b) => a.order - b.order);
    const i = list.indexOf(h);
    const j = i + (p.dir < 0 ? -1 : 1);
    if (j < 0 || j >= list.length) return;
    [list[i].order, list[j].order] = [list[j].order, list[i].order];
  },
  'handout:queue'(user, p) {
    requireGM(user);
    const h = D().handouts.find((x) => x.id === p.id);
    if (!h) throw new Error('Segredo não encontrado');
    const q = p.userId && D().users.some((u) => u.id === p.userId) ? p.userId : null;
    h.queuedFor = q;
    if (q) {
      h.recipients = [];
      h.order = Math.max(0, ...D().handouts.filter((x) => x.queuedFor === q && x !== h).map((x) => x.order)) + 1;
    }
  },

  // ---------- calendário e descansos
  'calendar:advance'(user, p) {
    requireGM(user);
    const before = world.describe(D().calendar);
    world.advance(D().calendar, int(p.minutes, -525600, 525600));
    if (p.announce) pushChat(chatBase(user, { type: 'system', text: `⏳ ${str(p.announce, 80)} — agora: ${world.describe(D().calendar)}` }));
    return { before };
  },
  'calendar:set'(user, p) {
    requireGM(user);
    const c = D().calendar;
    c.year = int(p.year, -99999, 99999, c.year);
    c.month = int(p.month, 0, c.months.length - 1, c.month);
    c.day = int(p.day, 1, c.months[c.month].days, 1);
    c.minutes = int(p.hour, 0, 23, 8) * 60 + int(p.minute, 0, 59, 0);
  },
  'calendar:config'(user, p) {
    requireGM(user);
    const months = (Array.isArray(p.months) ? p.months : []).slice(0, 40)
      .map((m) => ({ name: str(m?.name, 40).trim() || '?', days: int(m?.days, 1, 100, 30), festival: !!m?.festival }));
    if (!months.length) throw new Error('O calendário precisa de pelo menos um mês');
    D().calendar = world.normalizeCalendar({ ...D().calendar, months, era: str(p.era, 12).trim() || 'DR' });
  },
  'calendar:reset'(user) {
    requireGM(user);
    D().calendar = world.defaultCalendar();
  },
  'rest:long'(user) {
    requireGM(user);
    world.advance(D().calendar, 8 * 60);
    const players = new Set(D().users.filter((u) => u.role === 'player').map((u) => u.id));
    for (const c of D().characters) {
      if (!c.ownerId || !players.has(c.ownerId)) continue;
      c.hp = c.hpMax;
      c.hpTemp = 0;
      c.slots = c.slots.map((sl) => ({ ...sl, used: 0 }));
      cls.longRestHitDice(c);
      c.deathSaves = { s: 0, f: 0 };
      c.conditions = c.conditions.filter((x) => x !== 'inconsciente');
    }
    pushChat(chatBase(user, { type: 'system', text: `🌙 Descanso longo — PV e espaços de magia recuperados. Agora: ${world.describe(D().calendar)}` }));
  },
  'rest:short'(user) {
    requireGM(user);
    world.advance(D().calendar, 60);
    pushChat(chatBase(user, { type: 'system', text: `☕ Descanso curto (1 hora). Quem quiser pode gastar dados de vida na ficha. Agora: ${world.describe(D().calendar)}` }));
  },

  // ---------- bestiário (só o mestre)
  'monster:create'(user, p) {
    requireGM(user);
    if (D().monsters.length >= 2000) throw new Error('Bestiário cheio');
    const m = { id: uid(), createdAt: Date.now(), updatedAt: Date.now(), ...monsterFields(p, null) };
    D().monsters.push(m);
    return { id: m.id };
  },
  'monster:update'(user, p) {
    requireGM(user);
    const m = findMonster(p.id);
    const oldImg = m.img;
    const old3d = [m.model || '', m.modelScale || 1, m.modelTurn || 0];
    Object.assign(m, monsterFields(p.patch || {}, m), { updatedAt: Date.now() });
    if (m.img !== oldImg) {
      for (const s of D().scenes) for (const t of s.tokens) if (t.monsterId === m.id && (!t.img || t.img === oldImg)) t.img = m.img;
    }
    // o modelo 3D da ficha vale para os tokens dela que ainda usam o modelo antigo
    if (m.model !== old3d[0] || m.modelScale !== old3d[1] || m.modelTurn !== old3d[2]) {
      for (const s of D().scenes) {
        for (const t of s.tokens) {
          if (t.monsterId !== m.id || (t.model || '') !== old3d[0]) continue;
          Object.assign(t, { model: m.model, modelScale: m.modelScale, modelTurn: m.modelTurn });
        }
      }
    }
  },
  'monster:delete'(user, p) {
    requireGM(user);
    const d = D();
    d.monsters = d.monsters.filter((x) => x.id !== p.id);
    for (const s of d.scenes) for (const t of s.tokens) if (t.monsterId === p.id) t.monsterId = null;
  },

  // ---------- backups e encerramento (mestre)
  'backup:list'(user) {
    requireGM(user);
    return { silent: true, list: store.listBackups(), folder: store.BACKUPS };
  },
  'backup:create'(user, p) {
    requireGM(user);
    store.flush();
    return { silent: true, file: store.snapshot(p.label || 'manual') };
  },
  'backup:restore'(user, p) {
    requireGM(user);
    restoreFrom(store.readBackup(p.file), user);
    return { silent: true };
  },
  'session:end'(user) {
    requireGM(user);
    closeTable('O mestre encerrou a sessão pelo navegador. Até a próxima!', 'fim-da-sessao');
    io.emit('server:closing', { by: user.name });
    setTimeout(() => process.exit(0), 800);
    return { silent: true };
  },
};

function findMonster(id) {
  const m = D().monsters.find((x) => x.id === id);
  if (!m) throw new Error('Ficha do bestiário não encontrada');
  return m;
}

const CR_OK = /^(0|1\/8|1\/4|1\/2|[1-9]|[12]\d|30)$/;
const SIZES = ['Miúdo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Imenso'];
function abilityBlock(list) {
  return (Array.isArray(list) ? list : []).slice(0, 40).map((a) => {
    const out = { name: str(a?.name, 120).trim() || '—', text: str(a?.text, 4000) };
    if (a?.toHit !== undefined && a.toHit !== null && a.toHit !== '') out.toHit = int(a.toHit, -10, 40);
    if (a?.damage) out.damage = str(a.damage, 60).replace(/\s+/g, '');
    if (a?.damageType) out.damageType = str(a.damageType, 60);
    if (a?.dc !== undefined && a.dc !== null && a.dc !== '') out.dc = int(a.dc, 1, 40);
    if (a?.dcAbility) out.dcAbility = str(a.dcAbility, 10);
    return out;
  });
}
// Valida os campos de uma ficha de monstro/NPC. base = ficha atual (para atualizações parciais) ou null.
function monsterFields(f, base) {
  const pick = (k, fn, def) => (f[k] !== undefined ? fn(f[k]) : base ? base[k] : def);
  const text = (n) => (v) => str(v, n);
  return {
    name: pick('name', (v) => str(v, 80).trim() || 'Sem nome', 'Sem nome'),
    img: pick('img', imgUrl, ''),
    model: pick('model', modelUrl, ''),
    modelScale: pick('modelScale', modelScale, 1),
    modelTurn: pick('modelTurn', modelTurn, 0),
    size: pick('size', (v) => (SIZES.includes(v) ? v : 'Médio'), 'Médio'),
    type: pick('type', text(80), ''),
    alignment: pick('alignment', text(80), ''),
    ac: pick('ac', (v) => int(v, 0, 40, 10), 10),
    acNote: pick('acNote', text(80), ''),
    hp: pick('hp', (v) => int(v, 1, 9999, 1), 1),
    hpFormula: pick('hpFormula', (v) => str(v, 40).replace(/\s+/g, ''), ''),
    speed: pick('speed', text(120), '9 m'),
    attrs: pick('attrs', (v) => Object.fromEntries(ATTRS.map((a) => [a, int(v?.[a], 1, 30, 10)])),
      Object.fromEntries(ATTRS.map((a) => [a, 10]))),
    saves: pick('saves', (v) => Object.fromEntries(ATTRS.filter((a) => v?.[a] !== undefined && v[a] !== '').map((a) => [a, int(v[a], -10, 30)])), {}),
    skills: pick('skills', (v) => (Array.isArray(v) ? v : []).slice(0, 18).map((x) => ({ name: str(x?.name, 40), bonus: int(x?.bonus, -10, 30) })), []),
    vulnerabilities: pick('vulnerabilities', text(300), ''),
    resistances: pick('resistances', text(300), ''),
    immunities: pick('immunities', text(300), ''),
    conditionImmunities: pick('conditionImmunities', text(300), ''),
    senses: pick('senses', text(200), ''),
    languages: pick('languages', text(200), ''),
    cr: pick('cr', (v) => (CR_OK.test(String(v)) ? String(v) : '0'), '0'),
    traits: pick('traits', abilityBlock, []),
    actions: pick('actions', abilityBlock, []),
    reactions: pick('reactions', abilityBlock, []),
    legendary: pick('legendary', abilityBlock, []),
    notes: pick('notes', text(10000), ''),
    srd: pick('srd', (v) => str(v, 60), ''),
    variantOf: pick('variantOf', (v) => (v ? str(v, 40) : null), null),
  };
}

function compendiumFields(f, base) {
  return {
    title: f.title !== undefined ? str(f.title, 120).trim() || 'Sem título' : base.title,
    category: f.category !== undefined ? str(f.category, 40).trim() || 'Geral' : base.category,
    body: f.body !== undefined ? str(f.body, 50000) : base.body,
    images: f.images !== undefined ? (Array.isArray(f.images) ? f.images : []).slice(0, 20).map(imgUrl).filter(Boolean) : base.images,
    visibility: f.visibility !== undefined ? (f.visibility === 'all' ? 'all' : 'gm') : base.visibility,
  };
}

io.use((socket, next) => {
  const u = userByToken(socket.handshake.auth?.token);
  if (!u) return next(new Error('auth'));
  socket.data.userId = u.id;
  next();
});

io.on('connection', (socket) => {
  const id = socket.data.userId;
  const me = () => D().users.find((u) => u.id === id);
  socket.join('u:' + id);
  online.set(id, (online.get(id) || 0) + 1);
  socket.emit('chat:history', D().chat.filter((m) => canSeeMsg(me(), m)));
  broadcastState();

  socket.on('disconnect', () => {
    const n = (online.get(id) || 1) - 1;
    if (n <= 0) online.delete(id); else online.set(id, n);
    broadcastState();
  });

  for (const [ev, fn] of Object.entries(handlers)) {
    socket.on(ev, (payload, ack) => {
      const user = me();
      if (!user) return socket.disconnect(true);
      try {
        const r = fn(user, payload && typeof payload === 'object' ? payload : {}) || {};
        if (!r.silent) { store.save(); broadcastState(); }
        if (typeof ack === 'function') ack({ ok: true, ...r });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: e.message });
      }
    });
  }
});

// ------------------------------------------------- versão nova no GitHub
const REPO_RAW = process.env.TABULA_REPO_RAW || 'https://raw.githubusercontent.com/LP-IQ/tabula/main/package.json';
let latestVersion = null;
// nome do atalho de atualização em cada sistema (Windows: .bat; Linux e Mac: .sh)
const WIN = process.platform === 'win32';
const UPDATE_SCRIPT = WIN ? 'atualizar.bat' : './atualizar.sh';
function newer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}
async function checkUpdate() {
  if (process.env.TABULA_NO_UPDATE_CHECK) return;
  try {
    const r = await fetch(REPO_RAW, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return;
    const v = (await r.json()).version;
    if (v && v !== latestVersion) { latestVersion = v; broadcastState(); }
    if (newer(v, pkg.version)) console.log(`  ★ Versão nova disponível: ${v} (você tem ${pkg.version}). Feche a mesa e rode ${UPDATE_SCRIPT}`);
  } catch { /* sem internet: tudo bem */ }
}
setTimeout(checkUpdate, 3000).unref();
setInterval(checkUpdate, 6 * 60 * 60 * 1000).unref();

function shutdown() {
  closeTable('A mesa foi fechada. Até a próxima!', 'encerramento');
  io.emit('server:closing', {});
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown);   // Ctrl + C
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);   // janela do Windows fechada no X

// backup automático a cada 30 minutos, se algo mudou
setInterval(() => {
  if (store.changedSinceSnapshot && D().users.length) store.snapshot('auto');
}, 30 * 60 * 1000).unref();

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  [ERRO] Já tem uma mesa aberta na porta ${PORT} neste computador.`);
    console.error(WIN
      ? '  Feche a outra janela da mesa (ou rode: taskkill /IM node.exe /F) e tente de novo.\n'
      : '  Feche o outro terminal da mesa (ou rode: pkill -f "node server.js") e tente de novo.\n');
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, () => {
  const os = require('os');
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i.address}:${PORT}`);
  console.log('\n  Tábula está no ar!');
  console.log(`  Neste computador:   http://localhost:${PORT}`);
  if (lan.length) console.log(`  Na mesma rede/Wi-Fi: ${lan.join('  ')}`);
  console.log(`  Campanha salva em:  ${store.DATA_DIR}`);
  if (D().users.length) store.snapshot('abertura');
  console.log('  (salva sozinha a cada alteração; pontos de backup ficam na pasta "backups")\n');
});

module.exports = { server };
