// Tábula — servidor da mesa virtual.
// Rode com:  npm start   (ou: node server.js)
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { Server } = require('socket.io');
const store = require('./server/store');
const { roll } = require('./server/dice');

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
  };
}

const CHAR_FIELDS = {
  name: (v) => str(v, 80).trim() || 'Sem nome',
  img: imgUrl,
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
  inventory: (v) => str(v),
  notes: (v) => str(v),
};

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
    hp: c.hp, hpMax: c.hpMax, hpTemp: c.hpTemp,
  }));

  const act = activeScene();
  let scene = null;
  if (act) {
    scene = {
      ...act,
      tokens: act.tokens
        .filter((t) => gm || !t.hidden)
        .map((t) => {
          if (gm || t.characterId) return t;
          const { hp, hpMax, ...rest } = t; // jogador não vê PV exato de NPC
          return { ...rest, hpState: hpState(hp, hpMax) };
        }),
    };
  }

  const ini = d.initiative;
  const initiative = { ...ini, entries: ini.entries.filter((e) => gm || !e.hidden) };

  const handouts = gm
    ? d.handouts
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
const upload = multer({
  storage: multer.diskStorage({
    destination: store.UPLOADS,
    filename: (req, file, cb) => cb(null, uid() + uid() + EXT[file.mimetype]),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!EXT[file.mimetype]),
});
app.post('/api/upload', auth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Imagem grande demais (máx. 25 MB)' : err.message;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem PNG, JPG, WEBP ou GIF' });
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
    D().characters.push(c);
    return { id: c.id };
  },
  'character:update'(user, p) {
    const c = findChar(p.id);
    const gm = user.role === 'gm';
    if (!gm && c.ownerId !== user.id) throw new Error('Esse personagem não é seu');
    const patch = p.patch || {};
    if ('ownerId' in patch) requireGM(user);
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'ownerId') {
        requireGM(user);
        c.ownerId = v && D().users.some((u) => u.id === v) ? v : null;
      } else if (CHAR_FIELDS[k]) {
        c[k] = CHAR_FIELDS[k](v);
      }
    }
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
    const t = {
      id: uid(), characterId,
      name: str(p.name, 80).trim() || 'Token', img: imgUrl(p.img || ''),
      x: num(p.x, -1e5, 1e5), y: num(p.y, -1e5, 1e5), size: num(p.size, 0.5, 10, 1),
      hidden: !!p.hidden,
      hp: int(p.hp, -999, 9999), hpMax: int(p.hpMax ?? p.hp, 0, 9999),
    };
    s.tokens.push(t);
    return { id: t.id };
  },
  'token:update'(user, p) {
    requireGM(user);
    const t = findToken(p.sceneId, p.id);
    const f = p.patch || {};
    if (f.name !== undefined) t.name = str(f.name, 80).trim() || t.name;
    if (f.img !== undefined) t.img = imgUrl(f.img);
    if (f.size !== undefined) t.size = num(f.size, 0.5, 10, 1);
    if (f.hidden !== undefined) t.hidden = !!f.hidden;
    if (f.hp !== undefined) t.hp = int(f.hp, -999, 9999);
    if (f.hpMax !== undefined) t.hpMax = int(f.hpMax, 0, 9999);
    if (f.x !== undefined) t.x = num(f.x, -1e5, 1e5);
    if (f.y !== undefined) t.y = num(f.y, -1e5, 1e5);
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
    const h = {
      id: uid(), title: str(p.title, 120).trim() || 'Sem título', body: str(p.body), img: imgUrl(p.img || ''),
      recipients: [], createdAt: Date.now(),
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
    console.error('  Feche a outra janela da mesa (ou rode: taskkill /IM node.exe /F) e tente de novo.\n');
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
