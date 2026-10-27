// Regras do Livro do Mestre usadas pelo bestiário: ND, XP, dificuldade de encontro e ajuste de ND.

export const CRS = ['0', '1/8', '1/4', '1/2', ...Array.from({ length: 30 }, (_, i) => String(i + 1))];
export const crValue = (cr) => ({ '1/8': 0.125, '1/4': 0.25, '1/2': 0.5 }[cr] ?? (Number(cr) || 0));

// Livro do Mestre, "Pontos de Experiência por Nível de Desafio"
const XP = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900,
  9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000,
  19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000,
  28: 120000, 29: 135000, 30: 155000,
};
export const xpFor = (cr) => XP[crValue(cr)] ?? 0;

// Livro do Mestre, "Estatísticas de Monstro por Nível de Desafio" — [prof, CA, PV mín, PV máx, ataque, dano mín, dano máx, CD]
// (a tradução em português tem erros de digitação nos PV dos ND 21 e 26; aqui estão os valores corretos)
const TABLE = {
  0: [2, 13, 1, 6, 3, 0, 1, 13], 0.125: [2, 13, 7, 35, 3, 2, 3, 13], 0.25: [2, 13, 36, 49, 3, 4, 5, 13],
  0.5: [2, 13, 50, 70, 3, 6, 8, 13], 1: [2, 13, 71, 85, 3, 9, 14, 13], 2: [2, 13, 86, 100, 3, 15, 20, 13],
  3: [2, 13, 101, 115, 4, 21, 26, 13], 4: [2, 14, 116, 130, 5, 27, 32, 14], 5: [3, 15, 131, 145, 6, 33, 38, 15],
  6: [3, 15, 146, 160, 6, 39, 44, 15], 7: [3, 15, 161, 175, 6, 45, 50, 15], 8: [3, 16, 176, 190, 7, 51, 56, 16],
  9: [4, 16, 191, 205, 7, 57, 62, 16], 10: [4, 17, 206, 220, 7, 63, 68, 16], 11: [4, 17, 221, 235, 8, 69, 74, 17],
  12: [4, 17, 236, 250, 8, 75, 80, 17], 13: [5, 18, 251, 265, 8, 81, 86, 18], 14: [5, 18, 266, 280, 8, 87, 92, 18],
  15: [5, 18, 281, 295, 8, 93, 98, 18], 16: [5, 18, 296, 310, 9, 99, 104, 18], 17: [6, 19, 311, 325, 10, 105, 110, 19],
  18: [6, 19, 326, 340, 10, 111, 116, 19], 19: [6, 19, 341, 355, 10, 117, 122, 19], 20: [6, 19, 356, 400, 10, 123, 140, 19],
  21: [7, 19, 401, 445, 11, 141, 158, 20], 22: [7, 19, 446, 490, 11, 159, 176, 20], 23: [7, 19, 491, 535, 11, 177, 194, 20],
  24: [7, 19, 536, 580, 12, 195, 212, 21], 25: [8, 19, 581, 625, 12, 213, 230, 21], 26: [8, 19, 626, 670, 12, 231, 248, 21],
  27: [8, 19, 671, 715, 13, 249, 266, 22], 28: [8, 19, 716, 760, 13, 267, 284, 22], 29: [9, 19, 761, 805, 13, 285, 302, 22],
  30: [9, 19, 806, 850, 14, 303, 320, 23],
};
export const tableFor = (cr) => {
  const t = TABLE[crValue(cr)] || TABLE[0];
  return { prof: t[0], ac: t[1], hp: [t[2], t[3]], atk: t[4], dmg: [t[5], t[6]], dc: t[7] };
};

// PV e dano por rodada que os monstros oficiais costumam ter em cada ND (mediana dos 334 monstros do SRD,
// suavizada). A tabela do Livro do Mestre é usada para CA, ataque e CD; para PV e dano ela é bem mais alta
// que os monstros reais nos ND baixos (um goblin ND 1/4 teria ~42 PV), então o ajuste é proporcional a isto.
function typicalHp(v) {
  const low = { 0: 3, 0.125: 9, 0.25: 13, 0.5: 22 };
  if (v in low) return low[v];
  if (v <= 20) return 15 * v + 15;
  const t = TABLE[v];
  return ((t[2] + t[3]) / 2) * 0.85;
}
function typicalDpr(v) {
  const low = { 0: 1, 0.125: 4, 0.25: 5.5, 0.5: 7 };
  if (v in low) return low[v];
  return 4.5 * v + 5.5;
}

// Livro do Mestre, "Limites de XP por Nível de Personagem" — [fácil, média, difícil, mortal]
const THRESHOLDS = [
  null, [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100],
  [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100], [550, 1100, 1600, 2400], [600, 1200, 1900, 2800],
  [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700],
  [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500],
  [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700],
];
const MULT = [1, 1.5, 2, 2.5, 3, 4];
const multIndex = (n) => (n <= 1 ? 0 : n === 2 ? 1 : n <= 6 ? 2 : n <= 10 ? 3 : n <= 14 ? 4 : 5);

export const LEVELS = ['Fácil', 'Médio', 'Difícil', 'Mortal'];

// Dificuldade de um encontro: levels = níveis dos personagens; crs = ND de cada monstro
export function encounter(levels, crs) {
  const party = [0, 0, 0, 0];
  for (const lv of levels) {
    const t = THRESHOLDS[Math.min(20, Math.max(1, Math.round(lv) || 1))];
    for (let i = 0; i < 4; i++) party[i] += t[i];
  }
  const base = crs.reduce((s, cr) => s + xpFor(cr), 0);
  let mi = multIndex(crs.length);
  if (levels.length && levels.length < 3) mi += 1;      // grupo pequeno: próximo multiplicador acima
  if (levels.length >= 6) mi -= 1;                      // grupo grande: próximo abaixo
  const mult = mi < 0 ? 0.5 : mi >= MULT.length ? 5 : MULT[mi];
  const adjusted = Math.round(base * (crs.length ? mult : 0));
  let level = -1;
  for (let i = 0; i < 4; i++) if (adjusted >= party[i]) level = i;
  return { party, base, mult, adjusted, level };
}

// ------------------------------------------------------------- ajuste de ND
const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

export function avgDice(formula) {
  let total = 0;
  const re = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g;
  const s = String(formula || '').replace(/\s+/g, '');
  let m;
  while ((m = re.exec(s))) {
    if (m[3]) total += (m[1] === '-' ? -1 : 1) * (Number(m[2]) || 1) * (Number(m[3]) + 1) / 2;
    else if (m[5]) total += (m[4] === '-' ? -1 : 1) * Number(m[5]);
  }
  return total;
}

// Muda o dano mantendo os tipos de dado: 1d6+2 → 2d6+3; 2d10+8+2d6 → 3d10+2d6+7
function scaleDamage(formula, ratio) {
  const terms = String(formula || '').replace(/\s+/g, '').match(/[+-]?[^+-]+/g) || [];
  const dice = [];
  let flat = 0;
  for (const t of terms) {
    const m = /^([+-]?)(\d*)d(\d+)$/.exec(t);
    if (m) dice.push({ n: Number(m[2]) || 1, d: Number(m[3]) });
    else if (/^[+-]?\d+$/.test(t)) flat += Number(t);
    else return formula;
  }
  if (!dice.length) return formula;
  const target = (dice.reduce((a, x) => a + x.n * (x.d + 1) / 2, 0) + flat) * ratio;
  for (const x of dice) x.n = Math.max(1, Math.round(x.n * ratio));
  const avgOf = () => dice.reduce((a, x) => a + x.n * (x.d + 1) / 2, 0);
  let k = Math.round(target - avgOf());
  // se a sobra ficou muito negativa, tira um dado do principal
  while (k < -(dice[0].d + 1) / 4 && dice[0].n > 1) { dice[0].n -= 1; k = Math.round(target - avgOf()); }
  return dice.map((x) => `${x.n}d${x.d}`).join('+') + (k > 0 ? `+${k}` : k < 0 ? `${k}` : '');
}

function scaleHp(m, ratio) {
  const target = Math.max(1, Math.round((Number(m.hp) || 1) * ratio));
  const dm = /(\d*)d(\d+)/.exec(String(m.hpFormula || ''));
  const die = dm ? Number(dm[2]) : ({ Miúdo: 4, Pequeno: 6, Médio: 8, Grande: 10, Enorme: 12, Imenso: 20 }[m.size] || 8);
  const con = mod(m.attrs?.con);
  const per = (die + 1) / 2 + con;
  if (per <= 0) return { hp: target, hpFormula: '' };
  const n = Math.max(1, Math.round(target / per));
  const bonus = n * con;
  return { hp: Math.max(1, Math.floor(n * (die + 1) / 2) + bonus), hpFormula: `${n}d${die}` + (bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : '') };
}

const isMulti = (a) => /^(multiattack|ataques? m[uú]ltiplos)/i.test(a.name || '');

// Devolve uma cópia do monstro ajustada para o novo ND, mais um resumo das mudanças
export function rescale(m, newCr) {
  const from = crValue(m.cr), to = crValue(newCr);
  const A = tableFor(m.cr), B = tableFor(newCr);
  const dProf = B.prof - A.prof, dAc = B.ac - A.ac, dAtk = B.atk - A.atk, dDc = B.dc - A.dc;
  const hpRatio = typicalHp(to) / typicalHp(from);
  let dmgRatio = typicalDpr(to) / typicalDpr(from);

  const out = structuredClone(m);
  out.cr = String(newCr);
  out.ac = Math.max(5, (Number(m.ac) || 10) + dAc);
  Object.assign(out, scaleHp(m, hpRatio));
  out.saves = Object.fromEntries(Object.entries(m.saves || {}).map(([k, v]) => [k, v + dProf]));
  out.skills = (m.skills || []).map((s) => ({ ...s, bonus: s.bonus + dProf }));

  // Monstro com um ataque só que fica muito mais forte: em vez de um golpe enorme, ganha ataques múltiplos
  const attacks = (m.actions || []).filter((a) => a.toHit != null && a.damage);
  let addMulti = 0;
  if (!(m.actions || []).some(isMulti) && attacks.length && dmgRatio >= 2.5) {
    addMulti = dmgRatio >= 6 ? 3 : 2;
    dmgRatio /= addMulti;
  }
  const fix = (list) => (list || []).map((a) => {
    const b = { ...a };
    if (b.toHit != null) b.toHit = Number(b.toHit) + dAtk;
    if (b.dc != null) b.dc = Number(b.dc) + dDc;
    if (b.damage) b.damage = scaleDamage(b.damage, dmgRatio);
    return b;
  });
  out.actions = fix(m.actions);
  out.reactions = fix(m.reactions);
  out.legendary = fix(m.legendary);
  out.traits = (m.traits || []).map((t) => ({ ...t, ...(t.dc != null ? { dc: Number(t.dc) + dDc } : {}) }));
  if (addMulti) {
    const names = attacks.filter((a) => !/distância|ranged|arco|bow/i.test(a.text || a.name)).map((a) => a.name);
    const which = names[0] || attacks[0].name;
    out.actions.unshift({ name: 'Ataques Múltiplos', text: `Faz ${addMulti === 2 ? 'dois' : 'três'} ataques com ${which} (ou com qualquer combinação dos seus ataques).` });
  }
  out.name = `${String(m.name).replace(/\s*\(ND [^)]*\)$/, '')} (ND ${newCr})`;
  out.variantOf = m.variantOf || m.id || null;
  delete out.id;

  const firstAtk = attacks[0];
  const newAtk = out.actions.find((a) => a.name === firstAtk?.name);
  return {
    monster: out,
    summary: [
      ['ND', m.cr, out.cr],
      ['XP', xpFor(m.cr), xpFor(out.cr)],
      ['CA', m.ac, out.ac],
      ['PV', `${m.hp}${m.hpFormula ? ` (${m.hpFormula})` : ''}`, `${out.hp}${out.hpFormula ? ` (${out.hpFormula})` : ''}`],
      firstAtk ? ['Ataque', `${firstAtk.name}: +${firstAtk.toHit}, ${firstAtk.damage}`, `+${newAtk.toHit}, ${newAtk.damage}${addMulti ? ` ×${addMulti}` : ''}`] : null,
      dDc && [...(m.actions || []), ...(m.traits || []), ...(m.reactions || [])].some((a) => a.dc != null)
        ? ['CD de resistência', `${dDc > 0 ? '+' : ''}${dDc}`, ''] : null,
      dProf ? ['Proficiência', `+${A.prof}`, `+${B.prof}`] : null,
    ].filter(Boolean),
  };
}

// Tamanho do token em quadrados a partir do tamanho da criatura
export const SIZE_SQUARES = { Miúdo: 0.5, Pequeno: 1, Médio: 1, Grande: 2, Enorme: 3, Imenso: 4 };

// Condições (Livro do Jogador, apêndice A) + concentração
export const CONDITIONS = ['agarrado', 'amedrontado', 'atordoado', 'caido', 'cego', 'enfeiticado', 'envenenado', 'exaustao',
  'impedido', 'incapacitado', 'inconsciente', 'invisivel', 'paralisado', 'petrificado', 'surdo', 'concentracao'];
export const CONDITION_LABEL = {
  agarrado: 'Agarrado', amedrontado: 'Amedrontado', atordoado: 'Atordoado', caido: 'Caído', cego: 'Cego',
  enfeiticado: 'Enfeitiçado', envenenado: 'Envenenado', exaustao: 'Exaustão', impedido: 'Impedido',
  incapacitado: 'Incapacitado', inconsciente: 'Inconsciente', invisivel: 'Invisível', paralisado: 'Paralisado',
  petrificado: 'Petrificado', surdo: 'Surdo', concentracao: 'Concentração',
};
export const CONDITION_ICON = {
  agarrado: '✊', amedrontado: '😱', atordoado: '💫', caido: '⤵', cego: '🕶', enfeiticado: '💘', envenenado: '🤢',
  exaustao: '😩', impedido: '⛓', incapacitado: '🚫', inconsciente: '💤', invisivel: '👻', paralisado: '🧊',
  petrificado: '🗿', surdo: '🔇', concentracao: '🔮',
};

// Pontos de experiência por nível (Livro do Jogador)
export const XP_LEVELS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000,
  165000, 195000, 225000, 265000, 305000, 355000];
