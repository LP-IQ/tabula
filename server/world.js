// Regras que não dependem de rede: calendário, névoa de guerra, ficha completa.
// Separado do server.js para ficar fácil de testar e de ler.

// ---------------------------------------------------------------- calendário
// Padrão: Calendário de Harptos (Faerûn). 12 meses de 30 dias + 5 festivais de 1 dia.
// O mestre pode renomear tudo (o mundo da campanha é um universo alternativo).
function defaultCalendar() {
  const m = (name, days = 30, festival = false) => ({ name, days, festival });
  return {
    era: 'DR',
    months: [
      m('Hammer'), m('Midwinter', 1, true), m('Alturiak'), m('Ches'), m('Tarsakh'), m('Greengrass', 1, true),
      m('Mirtul'), m('Kythorn'), m('Flamerule'), m('Midsummer', 1, true), m('Eleasis'), m('Eleint'),
      m('Highharvestide', 1, true), m('Marpenoth'), m('Uktar'), m('Feast of the Moon', 1, true), m('Nightal'),
    ],
    year: 1492, month: 0, day: 1, minutes: 8 * 60,   // minutos desde a meia-noite
  };
}

function normalizeCalendar(c) {
  const d = defaultCalendar();
  if (!c || typeof c !== 'object') return d;
  const months = Array.isArray(c.months) && c.months.length ? c.months : d.months;
  const out = { ...d, ...c, months };
  out.month = Math.min(Math.max(0, out.month | 0), months.length - 1);
  out.day = Math.min(Math.max(1, out.day | 0), months[out.month].days);
  out.minutes = Math.min(Math.max(0, out.minutes | 0), 24 * 60 - 1);
  return out;
}

// Avança o tempo em minutos (pode passar de dia, mês e ano)
function advance(cal, minutes) {
  let total = cal.minutes + Math.round(minutes);
  let days = Math.floor(total / 1440);
  cal.minutes = ((total % 1440) + 1440) % 1440;
  while (days > 0) {
    cal.day += 1;
    if (cal.day > cal.months[cal.month].days) {
      cal.day = 1;
      cal.month += 1;
      if (cal.month >= cal.months.length) { cal.month = 0; cal.year += 1; }
    }
    days -= 1;
  }
  while (days < 0) {
    cal.day -= 1;
    if (cal.day < 1) {
      cal.month -= 1;
      if (cal.month < 0) { cal.month = cal.months.length - 1; cal.year -= 1; }
      cal.day = cal.months[cal.month].days;
    }
    days += 1;
  }
  return cal;
}

function describe(cal) {
  const m = cal.months[cal.month];
  const hh = String(Math.floor(cal.minutes / 60)).padStart(2, '0');
  const mm = String(cal.minutes % 60).padStart(2, '0');
  const date = m.festival ? `${m.name}, ${cal.year} ${cal.era}` : `${cal.day} de ${m.name} de ${cal.year} ${cal.era}`;
  return `${date}, ${hh}:${mm}`;
}

// ---------------------------------------------------------------- névoa
// A névoa é uma lista de operações aplicadas em ordem sobre um mapa todo coberto:
// { op: 'reveal'|'hide', shape: 'rect'|'circle'|'all', x, y, w, h, r }
function opContains(o, x, y) {
  if (o.shape === 'all') return true;
  if (o.shape === 'rect') return x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
  if (o.shape === 'circle') return (x - o.x) ** 2 + (y - o.y) ** 2 <= o.r ** 2;
  return false;
}
function isCovered(fog, x, y) {
  if (!fog || !fog.enabled) return false;
  let covered = true;
  for (const o of fog.ops) if (opContains(o, x, y)) covered = o.op === 'hide';
  return covered;
}

// ---------------------------------------------------------------- ficha
// Tabela de XP por nível do Livro do Jogador
const XP_LEVELS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000,
  165000, 195000, 225000, 265000, 305000, 355000];

const CONDITIONS = ['agarrado', 'amedrontado', 'atordoado', 'caido', 'cego', 'enfeiticado', 'envenenado', 'exaustao',
  'impedido', 'incapacitado', 'inconsciente', 'invisivel', 'paralisado', 'petrificado', 'surdo', 'concentracao'];

function emptySlots() { return Array.from({ length: 9 }, () => ({ max: 0, used: 0 })); }

// Campos novos da ficha (v5), com valores padrão para fichas antigas
function characterDefaults() {
  return {
    conditions: [], slots: emptySlots(), hitDie: 'd8', hdUsed: 0,
    coins: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 }, xp: 0, inspiration: false, deathSaves: { s: 0, f: 0 },
    aspect: { month: '', name: '', base: '', upgraded: '' },
    ring: { name: '', base: '', upgraded: '' },
  };
}

module.exports = {
  defaultCalendar, normalizeCalendar, advance, describe,
  isCovered, opContains,
  XP_LEVELS, CONDITIONS, emptySlots, characterDefaults,
};
