// Classes do personagem (inclusive multiclasse), dado de vida, PV por nível e dados de vida.
// Livro do Jogador: cap. 3 (classes) e cap. 6 (multiclasse). Espelho no navegador: public/js/rules.js.
const crypto = require('crypto');

// dado de vida e requisitos de multiclasse de cada classe (nome em português ou inglês, sem acento)
const INFO = {
  barbaro: { die: 12, req: [['str']] },
  bardo: { die: 8, req: [['cha']] },
  bruxo: { die: 8, req: [['cha']] },
  clerigo: { die: 8, req: [['wis']] },
  druida: { die: 8, req: [['wis']] },
  feiticeiro: { die: 6, req: [['cha']] },
  guerreiro: { die: 10, req: [['str', 'dex']] },        // Força 13 OU Destreza 13
  ladino: { die: 8, req: [['dex']] },
  mago: { die: 6, req: [['int']] },
  monge: { die: 8, req: [['dex'], ['wis']] },           // Destreza 13 E Sabedoria 13
  paladino: { die: 10, req: [['str'], ['cha']] },
  patrulheiro: { die: 10, req: [['dex'], ['wis']] },
  artifice: { die: 8, req: [['int']] },
};
const ALIAS = {
  barbarian: 'barbaro', bard: 'bardo', warlock: 'bruxo', cleric: 'clerigo', druid: 'druida', sorcerer: 'feiticeiro',
  fighter: 'guerreiro', rogue: 'ladino', wizard: 'mago', monk: 'monge', paladin: 'paladino', ranger: 'patrulheiro',
  artificer: 'artifice',
};
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function classKey(text) {
  for (const w of norm(text).split(/[^a-z]+/)) {
    if (INFO[w]) return w;
    if (ALIAS[w]) return ALIAS[w];
  }
  return null;
}
const classDie = (text) => INFO[classKey(text)]?.die ?? null;

const int = (v, lo, hi, def = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};
const DIES = [6, 8, 10, 12];
const uid = () => crypto.randomBytes(6).toString('hex');
const dieSides = (hitDie) => Number(String(hitDie || 'd8').slice(1)) || 8;
const dieAverage = (sides) => sides / 2 + 1;           // valor fixo do livro (média arredondada para cima)
const conMod = (c) => Math.floor(((Number(c.attrs?.con) || 10) - 10) / 2);

// ------------------------------------------------------------ lista de classes
// A primeira classe é a do 1º nível do personagem. Nível total = soma (no máximo 20).
function normalizeClasses(list, prev = []) {
  const out = [];
  let total = 0;
  for (const raw of (Array.isArray(list) ? list : []).slice(0, 6)) {
    const name = String(raw?.name ?? '').slice(0, 80);
    const level = int(raw?.level, 1, 20, 1);
    if (total + level > 20) break;
    total += level;
    const known = classDie(name);
    const die = DIES.includes(Number(raw?.die)) ? Number(raw.die) : known || 8;
    const id = typeof raw?.id === 'string' && /^[\w-]{1,24}$/.test(raw.id) && prev.some((x) => x.id === raw.id) ? raw.id : uid();
    out.push({ id, name, level, die });
  }
  return out;
}

const describe = (classes) => classes.map((k) => (classes.length > 1 ? `${k.name || '?'} ${k.level}` : k.name)).join(' / ');

// Mantém os campos antigos (class, level, hitDie) e a lista de classes sempre de acordo.
// Com uma classe só, a ficha edita class/level/hitDie como antes; com várias, eles saem da lista.
function syncClasses(c, patchKeys = new Set()) {
  if (!Array.isArray(c.classes) || !c.classes.length) {
    c.classes = [{ id: uid(), name: c.class || '', level: int(c.level, 1, 20, 1), die: dieSides(c.hitDie) }];
  }
  if (!patchKeys.has('classes') && c.classes.length === 1) {
    const k = c.classes[0];
    if (patchKeys.has('class')) {
      k.name = c.class;
      const die = classDie(c.class);
      if (die && !patchKeys.has('hitDie')) k.die = die;
    }
    if (patchKeys.has('level')) k.level = int(c.level, 1, 20, 1);
    if (patchKeys.has('hitDie')) k.die = dieSides(c.hitDie);
  }
  c.level = Math.max(1, c.classes.reduce((s, k) => s + k.level, 0));
  c.class = describe(c.classes);
  c.hitDie = 'd' + c.classes[0].die;
  // ficha antiga (ou de uma classe só) mandando o total de dados gastos
  if (patchKeys.has('hdUsed') && !patchKeys.has('hdUsedBy')) c.hdUsedBy = { [c.hitDie]: Number(c.hdUsed) || 0 };
  syncHitDice(c);
}

// ------------------------------------------------------------ PV por nível
// hpRolls: o que cada nível depois do 1º rendeu no dado, com a classe daquele nível ({ cid, v }).
function hpEntries(c) {
  const first = c.classes?.[0]?.id;
  return (c.hpRolls || []).map((r) => (typeof r === 'number' ? { cid: first, v: r } : r)).filter((r) => r && Number.isFinite(r.v));
}

// Quantos níveis de cada classe ainda não ganharam PV
function hpPendingList(c) {
  const entries = hpEntries(c);
  return (c.classes || []).map((k, i) => {
    const need = k.level - (i === 0 ? 1 : 0);
    const have = entries.filter((r) => r.cid === k.id).length;
    return { cid: k.id, name: k.name, die: k.die, n: Math.max(0, need - have) };
  }).filter((x) => x.n > 0);
}
const hpPending = (c) => hpPendingList(c).reduce((s, x) => s + x.n, 0);

// 1º nível = máximo do dado da primeira classe + CON. Cada nível seguinte = o que rendeu + CON (no mínimo 1).
// CON e o bônus por nível valem para todos os níveis, como no livro.
function autoHpMax(c) {
  const per = conMod(c) + (Number(c.hpBonus) || 0);
  const classes = c.classes || [];
  if (!classes.length) return Math.max(1, dieSides(c.hitDie) + per);
  let max = Math.max(1, classes[0].die + per);
  const entries = hpEntries(c);
  classes.forEach((k, i) => {
    const need = k.level - (i === 0 ? 1 : 0);
    for (const r of entries.filter((e) => e.cid === k.id).slice(0, need)) max += Math.max(1, r.v + per);
  });
  return max;
}

// Recalcula os PV máximos; os PV atuais acompanham o que ganhar e nunca passam do máximo.
function applyAutoHp(c, prevMax) {
  if (!c.hpAuto) return;
  const max = autoHpMax(c);
  const before = prevMax ?? c.hpMax;
  c.hpMax = max;
  if (max > before) c.hp = Math.min(max, c.hp + (max - before));
  if (c.hp > max) c.hp = max;
}

// ------------------------------------------------------------ dados de vida
// Um monte por tipo de dado: paladino 5 / clérigo 5 = cinco d10 e cinco d8.
function hitDicePools(c) {
  const pools = {};
  for (const k of c.classes || []) pools['d' + k.die] = (pools['d' + k.die] || 0) + k.level;
  return pools;
}
function syncHitDice(c) {
  const pools = hitDicePools(c);
  let used = c.hdUsedBy && typeof c.hdUsedBy === 'object' ? { ...c.hdUsedBy } : { [c.hitDie || 'd8']: Number(c.hdUsed) || 0 };
  const out = {};
  for (const [d, n] of Object.entries(pools)) out[d] = int(used[d], 0, n);
  c.hdUsedBy = out;
  c.hdUsed = Object.values(out).reduce((s, n) => s + n, 0);
}
// Descanso longo: recupera metade do total de dados (mínimo 1), começando pelos maiores.
function longRestHitDice(c) {
  syncHitDice(c);
  let back = Math.max(1, Math.floor(c.level / 2));
  for (const d of Object.keys(c.hdUsedBy).sort((a, b) => dieSides(b) - dieSides(a))) {
    const n = Math.min(back, c.hdUsedBy[d]);
    c.hdUsedBy[d] -= n;
    back -= n;
  }
  c.hdUsed = Object.values(c.hdUsedBy).reduce((s, n) => s + n, 0);
}

// ------------------------------------------------------------ requisitos de multiclasse
const ATTR_PT = { str: 'Força', dex: 'Destreza', con: 'Constituição', int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma' };
function prereqProblems(c) {
  if ((c.classes || []).length < 2) return [];
  const out = [];
  for (const k of c.classes) {
    const info = INFO[classKey(k.name)];
    if (!info) continue;
    for (const any of info.req) {
      if (!any.some((a) => (Number(c.attrs?.[a]) || 0) >= 13)) out.push(`${k.name}: ${any.map((a) => ATTR_PT[a]).join(' ou ')} 13`);
    }
  }
  return out;
}

module.exports = {
  INFO, classKey, classDie, dieSides, dieAverage, conMod,
  normalizeClasses, syncClasses, describe,
  hpEntries, hpPendingList, hpPending, autoHpMax, applyAutoHp,
  hitDicePools, syncHitDice, longRestHitDice, prereqProblems,
};
