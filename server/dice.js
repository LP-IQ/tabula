// Rolador de dados. As rolagens acontecem no servidor (ninguém "rola no próprio PC").
// Aceita: 1d20+5, 2d6+1d4-1, d%, 2d20kh1 (vantagem), 2d20kl1 (desvantagem), 4d6kh3.
const crypto = require('crypto');

const TERM = /^(\d*)d(\d+|%)(?:(kh|kl)(\d+))?$/;

function roll(formula) {
  const clean = String(formula || '').toLowerCase().replace(/\s+/g, '');
  if (!clean || clean.length > 100) throw new Error('Fórmula de dados inválida');

  const re = /([+-]?)([^+-]+)/g;
  const parts = [];
  let total = 0, diceCount = 0, pos = 0, m;

  while ((m = re.exec(clean))) {
    if (m.index !== pos) throw new Error('Fórmula de dados inválida');
    pos = re.lastIndex;
    const sign = m[1] === '-' ? -1 : 1;
    const t = m[2];

    if (/^\d+$/.test(t)) {
      const v = parseInt(t, 10);
      if (v > 10000) throw new Error('Modificador grande demais');
      parts.push({ type: 'mod', value: sign * v });
      total += sign * v;
      continue;
    }

    const d = TERM.exec(t);
    if (!d) throw new Error(`Não entendi "${t}". Exemplos: 1d20+5, 2d6+3, 2d20kh1`);
    const count = d[1] ? parseInt(d[1], 10) : 1;
    const sides = d[2] === '%' ? 100 : parseInt(d[2], 10);
    if (count < 1 || count > 100) throw new Error('Use entre 1 e 100 dados por termo');
    if (sides < 2 || sides > 1000) throw new Error('Dado com número de faces inválido');
    diceCount += count;
    if (diceCount > 200) throw new Error('Dados demais numa rolagem só');

    const rolls = Array.from({ length: count }, () => crypto.randomInt(1, sides + 1));
    let keptIdx = rolls.map((_, i) => i);
    if (d[3]) {
      const k = Math.max(1, Math.min(parseInt(d[4], 10), count));
      const order = keptIdx.slice().sort((a, b) => (d[3] === 'kh' ? rolls[b] - rolls[a] : rolls[a] - rolls[b]));
      keptIdx = order.slice(0, k);
    }
    const kept = new Set(keptIdx);
    const sub = rolls.reduce((s, r, i) => (kept.has(i) ? s + r : s), 0);
    parts.push({
      type: 'dice', sign, count, sides,
      keep: d[3] ? d[3] + d[4] : null,
      rolls: rolls.map((v, i) => ({ v, kept: kept.has(i) })),
      subtotal: sign * sub,
    });
    total += sign * sub;
  }
  if (pos !== clean.length || parts.length === 0) throw new Error('Fórmula de dados inválida');

  // Crítico: a rolagem tem um d20 "valendo" (1d20, ou 2d20 com vantagem/desvantagem)
  let crit = null;
  const d20 = parts.find((p) => p.type === 'dice' && p.sides === 20 && p.rolls.filter((r) => r.kept).length === 1);
  if (d20) {
    const v = d20.rolls.find((r) => r.kept).v;
    if (v === 20) crit = 'success';
    else if (v === 1) crit = 'fail';
  }
  return { formula: clean, total, parts, crit };
}

module.exports = { roll };
