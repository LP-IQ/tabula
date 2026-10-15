// Guarda todos os dados da campanha num único arquivo JSON (campaign.json).
// Salva com atraso curto (para não escrever no disco a cada movimento de token)
// e de forma atômica (escreve num .tmp e renomeia), para não corromper o arquivo.
//
// Pontos de backup: cópias datadas na pasta backups/ — ao abrir a mesa, a cada 30 min
// de jogo (se algo mudou), ao fechar, e quando o mestre pede. O mestre pode restaurar qualquer um.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.env.TABULA_DATA || path.join(__dirname, '..', 'data'));
const FILE = path.join(DATA_DIR, 'campaign.json');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const BACKUPS = path.join(DATA_DIR, 'backups');

function defaults() {
  return {
    version: 1,
    users: [],          // { id, name, role: 'gm'|'player'|'viewer', salt, hash, color }
    sessions: {},       // token -> userId
    characters: [],
    scenes: [],         // { id, name, img, gridSize, gridOffsetX, gridOffsetY, showGrid, snap, tokens: [] }
    activeSceneId: null,
    initiative: { entries: [], currentId: null, round: 1, active: false },
    handouts: [],       // { id, title, body, img, recipients: ['all' | userId], createdAt }
    chat: [],
    journal: [],        // diário do grupo: { id, userId, title, body, img, createdAt, updatedAt }
    compendium: [],     // { id, title, category, body, images: [], visibility: 'gm'|'all', createdAt, updatedAt }
    monsters: [],       // bestiário do mestre (fichas de NPC/monstro) — ver monsterFields em server.js
  };
}

function normalize(obj) {
  const d = Object.assign(defaults(), obj);
  d.initiative = Object.assign(defaults().initiative, obj.initiative || {});
  if (!d.sessions || typeof d.sessions !== 'object') d.sessions = {};
  return d;
}

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(BACKUPS, { recursive: true });

let data = defaults();
if (fs.existsSync(FILE)) {
  try {
    data = normalize(JSON.parse(fs.readFileSync(FILE, 'utf8')));
    // cópia do último estado bom, a cada vez que o servidor sobe
    fs.copyFileSync(FILE, FILE.replace(/\.json$/, '.backup.json'));
  } catch (e) {
    console.error(`\n[ERRO] Não consegui ler ${FILE}: ${e.message}`);
    console.error('Restaure um arquivo da pasta "backups" (copie-o por cima do campaign.json) antes de iniciar.\n');
    process.exit(1);
  }
}

let timer = null;
let changedSinceSnapshot = false;
function save() {
  changedSinceSnapshot = true;
  clearTimeout(timer);
  timer = setTimeout(flush, 400);
}
function flush() {
  clearTimeout(timer);
  timer = null;
  const json = JSON.stringify(data, null, 1);
  const tmp = FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, FILE);
  } catch (e) {
    // No Windows, antivírus ou indexador às vezes seguram o arquivo por um instante.
    // Em vez de derrubar a mesa, grava direto ou tenta de novo daqui a pouco.
    try {
      fs.writeFileSync(FILE, json);
    } catch (e2) {
      console.error(`[aviso] Não consegui salvar agora (${e2.code || e2.message}); tento de novo em 2 s.`);
      timer = setTimeout(flush, 2000);
    }
  }
}

// ------------------------------------------------------------ backups
const AUTO_KINDS = new Set(['abertura', 'auto']);
const pad = (n) => String(n).padStart(2, '0');
function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
function slug(label) {
  return String(label || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'manual';
}
const FILE_RE = /^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})(?:-\d+)?_([a-z0-9-]+)\.json$/;

// Cria um ponto de backup. Devolve o nome do arquivo.
function snapshot(label) {
  const { sessions, ...rest } = data;
  let name = `${stamp()}_${slug(label)}.json`;
  for (let i = 2; fs.existsSync(path.join(BACKUPS, name)); i++) name = `${stamp()}-${i}_${slug(label)}.json`;
  fs.writeFileSync(path.join(BACKUPS, name), JSON.stringify(rest));
  changedSinceSnapshot = false;
  prune();
  return name;
}

function listBackups() {
  return fs.readdirSync(BACKUPS)
    .map((file) => {
      const m = FILE_RE.exec(file);
      if (!m) return null;
      const [date, time] = m[1].split('_');
      const ts = new Date(`${date}T${time.replace(/-/g, ':')}`).getTime();
      let size = 0;
      try { size = fs.statSync(path.join(BACKUPS, file)).size; } catch { /* ok */ }
      return { file, label: m[2], ts, size };
    })
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts || b.file.localeCompare(a.file));
}

// guarda até 30 backups automáticos e 100 dos outros (manuais, fim de sessão, antes de restaurar)
function prune() {
  const all = listBackups();
  const auto = all.filter((b) => AUTO_KINDS.has(b.label));
  const other = all.filter((b) => !AUTO_KINDS.has(b.label));
  for (const b of [...auto.slice(30), ...other.slice(100)]) {
    try { fs.unlinkSync(path.join(BACKUPS, b.file)); } catch { /* ok */ }
  }
}

function readBackup(file) {
  if (!FILE_RE.test(String(file))) throw new Error('Backup inválido');
  const p = path.join(BACKUPS, file);
  if (!fs.existsSync(p)) throw new Error('Esse backup não existe mais');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Troca a campanha inteira pelo conteúdo de um backup (mantém quem está logado, se o usuário existir no backup)
function replace(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.users) || !obj.users.some((u) => u && u.role === 'gm')) {
    throw new Error('Esse arquivo não parece um backup da Tábula');
  }
  const sessions = data.sessions;
  data = normalize(obj);
  const ids = new Set(data.users.map((u) => u.id));
  data.sessions = Object.fromEntries(Object.entries(sessions).filter(([, uid]) => ids.has(uid)));
  save();
  flush();
}

module.exports = {
  get data() { return data; },
  save,
  flush,
  snapshot,
  listBackups,
  readBackup,
  replace,
  get changedSinceSnapshot() { return changedSinceSnapshot; },
  DATA_DIR,
  UPLOADS,
  BACKUPS,
  FILE,
};
