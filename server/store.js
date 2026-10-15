// Guarda todos os dados da campanha num único arquivo JSON (data/campaign.json).
// Salva com atraso curto (para não escrever no disco a cada movimento de token)
// e de forma atômica (escreve num .tmp e renomeia), para não corromper o arquivo.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.TABULA_DATA || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'campaign.json');
const UPLOADS = path.join(DATA_DIR, 'uploads');

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
  };
}

fs.mkdirSync(UPLOADS, { recursive: true });

let data = defaults();
if (fs.existsSync(FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    data = Object.assign(defaults(), loaded);
    data.initiative = Object.assign(defaults().initiative, loaded.initiative || {});
    // cópia de segurança do último estado bom, a cada vez que o servidor sobe
    fs.copyFileSync(FILE, FILE.replace(/\.json$/, '.backup.json'));
  } catch (e) {
    console.error(`\n[ERRO] Não consegui ler ${FILE}: ${e.message}`);
    console.error('Corrija o arquivo ou restaure o campaign.backup.json antes de iniciar.\n');
    process.exit(1);
  }
}

let timer = null;
function save() {
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

module.exports = {
  get data() { return data; },
  save,
  flush,
  DATA_DIR,
  UPLOADS,
  FILE,
};
