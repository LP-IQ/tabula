// Dados dos itens: tipos, espaços do corpo, raridades, ícones alegóricos e modelos do Livro do Jogador.
// A tabela de tipos/espaços espelha server/items.js; mantenha as duas iguais.

export const SLOTS = [
  ['head', 'Cabeça'], ['neck', 'Pescoço'], ['cloak', 'Capa'], ['body', 'Armadura'],
  ['main', 'Mão direita'], ['off', 'Mão esquerda'], ['hands', 'Luvas'],
  ['ring1', 'Anel'], ['ring2', 'Anel'], ['belt', 'Cinto'], ['feet', 'Calçado'],
];
export const SLOT_LABEL = Object.fromEntries(SLOTS);
// ícone fantasma de cada espaço vazio
export const SLOT_ICON = {
  head: 'elmo', neck: 'amuleto', cloak: 'capa', body: 'armadura', main: 'espada', off: 'escudo',
  hands: 'luvas', ring1: 'anel', ring2: 'anel', belt: 'cinto', feet: 'botas',
};

const HANDS = ['main', 'off'];
export const KINDS = {
  espada: { label: 'Espada', slots: HANDS, weapon: true },
  adaga: { label: 'Adaga / faca', slots: HANDS, weapon: true },
  machado: { label: 'Machado', slots: HANDS, weapon: true },
  maca: { label: 'Maça / martelo', slots: HANDS, weapon: true },
  lanca: { label: 'Lança / haste', slots: HANDS, weapon: true },
  arco: { label: 'Arco', slots: HANDS, weapon: true },
  besta: { label: 'Besta', slots: HANDS, weapon: true },
  cajado: { label: 'Cajado / bordão', slots: HANDS, weapon: true },
  varinha: { label: 'Varinha / bastão', slots: HANDS, weapon: true },
  escudo: { label: 'Escudo', slots: ['off'] },
  armadura: { label: 'Armadura', slots: ['body'] },
  elmo: { label: 'Elmo / chapéu', slots: ['head'] },
  amuleto: { label: 'Amuleto / colar', slots: ['neck'] },
  capa: { label: 'Capa / manto', slots: ['cloak'] },
  luvas: { label: 'Luvas / braçadeiras', slots: ['hands'] },
  anel: { label: 'Anel', slots: ['ring1', 'ring2'] },
  cinto: { label: 'Cinto', slots: ['belt'] },
  botas: { label: 'Botas / calçado', slots: ['feet'] },
  pocao: { label: 'Poção', slots: [] },
  pergaminho: { label: 'Pergaminho', slots: [] },
  livro: { label: 'Livro / grimório', slots: [] },
  ferramenta: { label: 'Ferramenta / kit', slots: [] },
  municao: { label: 'Munição', slots: [] },
  tesouro: { label: 'Tesouro / gema', slots: [] },
  outro: { label: 'Outro', slots: [] },
};

export const RARITIES = [
  ['comum', 'Comum', '#b9b2a6'], ['incomum', 'Incomum', '#5fbf6a'], ['raro', 'Raro', '#4f9fe8'],
  ['muito-raro', 'Muito raro', '#a77be8'], ['lendario', 'Lendário', '#f0a23c'], ['artefato', 'Artefato', '#e35d4f'],
];
export const RARITY_LABEL = Object.fromEntries(RARITIES.map(([k, l]) => [k, l]));
export const RARITY_COLOR = Object.fromEntries(RARITIES.map(([k, , c]) => [k, c]));

export const DAMAGE_TYPES = ['cortante', 'perfurante', 'concussão', 'ácido', 'elétrico', 'fogo', 'frio', 'energia',
  'necrótico', 'psíquico', 'radiante', 'trovejante', 'veneno'];
export const ARMOR_TYPES = [['leve', 'Leve (+ DES)'], ['media', 'Média (+ DES, máx. 2)'], ['pesada', 'Pesada (sem DES)']];
export const MAX_ATTUNED = 3;

// ------------------------------------------------------------------ modelos
// Armas e armaduras da tabela do Livro do Jogador (cap. 5), para preencher o item com um clique.
const W = (name, kind, dmg, dmgType, weight, extra = {}) => ({ name, kind, dmg, dmgType, weight, hands: 'one', ...extra });
export const PRESETS = [
  ['Armas simples', [
    W('Adaga', 'adaga', '1d4', 'perfurante', 0.5, { finesse: true, light: true }),
    W('Azagaia', 'lanca', '1d6', 'perfurante', 1),
    W('Bordão', 'cajado', '1d6', 'concussão', 2, { hands: 'versatile', dmg2: '1d8' }),
    W('Clava grande', 'maca', '1d8', 'concussão', 5, { hands: 'two' }),
    W('Lança', 'lanca', '1d6', 'perfurante', 1.5, { hands: 'versatile', dmg2: '1d8' }),
    W('Maça', 'maca', '1d6', 'concussão', 2),
    W('Machadinha', 'machado', '1d6', 'cortante', 1, { light: true }),
    W('Martelo leve', 'maca', '1d4', 'concussão', 1, { light: true }),
    W('Porrete', 'maca', '1d4', 'concussão', 1, { light: true }),
    W('Arco curto', 'arco', '1d6', 'perfurante', 1, { hands: 'two', ranged: true }),
    W('Besta leve', 'besta', '1d8', 'perfurante', 2.5, { hands: 'two', ranged: true }),
  ]],
  ['Armas marciais', [
    W('Alabarda', 'lanca', '1d10', 'cortante', 3, { hands: 'two' }),
    W('Cimitarra', 'espada', '1d6', 'cortante', 1.5, { finesse: true, light: true }),
    W('Espada curta', 'espada', '1d6', 'perfurante', 1, { finesse: true, light: true }),
    W('Espada grande', 'espada', '2d6', 'cortante', 3, { hands: 'two' }),
    W('Espada longa', 'espada', '1d8', 'cortante', 1.5, { hands: 'versatile', dmg2: '1d10' }),
    W('Glaive', 'lanca', '1d10', 'cortante', 3, { hands: 'two' }),
    W('Lança longa', 'lanca', '1d10', 'perfurante', 4, { hands: 'two' }),
    W('Maça estrela', 'maca', '1d8', 'perfurante', 2),
    W('Machado de batalha', 'machado', '1d8', 'cortante', 2, { hands: 'versatile', dmg2: '1d10' }),
    W('Machado grande', 'machado', '1d12', 'cortante', 3.5, { hands: 'two' }),
    W('Malho', 'maca', '2d6', 'concussão', 5, { hands: 'two' }),
    W('Mangual', 'maca', '1d8', 'concussão', 1),
    W('Martelo de guerra', 'maca', '1d8', 'concussão', 1, { hands: 'versatile', dmg2: '1d10' }),
    W('Picareta de guerra', 'machado', '1d8', 'perfurante', 1),
    W('Rapieira', 'espada', '1d8', 'perfurante', 1, { finesse: true }),
    W('Tridente', 'lanca', '1d6', 'perfurante', 2, { hands: 'versatile', dmg2: '1d8' }),
    W('Arco longo', 'arco', '1d8', 'perfurante', 1, { hands: 'two', ranged: true }),
    W('Besta de mão', 'besta', '1d6', 'perfurante', 1.5, { ranged: true, light: true }),
    W('Besta pesada', 'besta', '1d10', 'perfurante', 4.5, { hands: 'two', ranged: true }),
  ]],
  ['Armaduras', [
    { name: 'Acolchoada', kind: 'armadura', armorType: 'leve', acBase: 11, weight: 4 },
    { name: 'Couro', kind: 'armadura', armorType: 'leve', acBase: 11, weight: 5 },
    { name: 'Couro batido', kind: 'armadura', armorType: 'leve', acBase: 12, weight: 6.5 },
    { name: 'Gibão de peles', kind: 'armadura', armorType: 'media', acBase: 12, weight: 6 },
    { name: 'Camisão de malha', kind: 'armadura', armorType: 'media', acBase: 13, weight: 10 },
    { name: 'Brunea', kind: 'armadura', armorType: 'media', acBase: 14, weight: 22.5 },
    { name: 'Peitoral', kind: 'armadura', armorType: 'media', acBase: 14, weight: 10 },
    { name: 'Meia-armadura', kind: 'armadura', armorType: 'media', acBase: 15, weight: 20 },
    { name: 'Cota de anéis', kind: 'armadura', armorType: 'pesada', acBase: 14, weight: 20 },
    { name: 'Cota de malha', kind: 'armadura', armorType: 'pesada', acBase: 16, weight: 27.5 },
    { name: 'Cota de talas', kind: 'armadura', armorType: 'pesada', acBase: 17, weight: 30 },
    { name: 'Placas', kind: 'armadura', armorType: 'pesada', acBase: 18, weight: 32.5 },
    { name: 'Escudo', kind: 'escudo', acBase: 2, weight: 3 },
  ]],
  ['Equipamento', [
    { name: 'Poção de cura', kind: 'pocao', weight: 0.5, rarity: 'comum', desc: 'Recupera 2d4 + 2 pontos de vida.' },
    { name: 'Flechas', kind: 'municao', qty: 20, weight: 0.05 },
    { name: 'Virotes de besta', kind: 'municao', qty: 20, weight: 0.075 },
    { name: 'Corda de cânhamo (15 metros)', kind: 'outro', weight: 5 },
    { name: 'Tocha', kind: 'outro', weight: 0.5 },
    { name: 'Ração de viagem (1 dia)', kind: 'outro', weight: 1 },
    { name: 'Ferramentas de ladrão', kind: 'ferramenta', weight: 0.5 },
    { name: 'Grimório', kind: 'livro', weight: 1.5 },
    { name: 'Símbolo sagrado', kind: 'amuleto', weight: 0.5 },
  ]],
];

// ------------------------------------------------------------------ ícones
// Desenhos simples e originais (48 × 48), usados até o mestre pôr a arte final do item.
const ICONS = {
  espada: '<path class="f" d="M39 5l4 4-22 22-4-4z"/><path d="M39 5l4 4-22 22-4-4z"/><path d="M11 27l10 10M16 32l-8 8"/><circle cx="7" cy="41" r="2.5"/>',
  adaga: '<path class="f" d="M33 11l4 4-12 12-4-4z"/><path d="M33 11l4 4-12 12-4-4zM37 15l3-6-6 3"/><path d="M16 23l9 9M20 28l-8 8"/><circle cx="11" cy="37" r="2.2"/>',
  machado: '<path d="M11 43L33 9"/><path class="f" d="M28 12c4-7 13-8 17-3-4 3-6 9-5 16-5-1-10-6-12-13z"/><path d="M28 12c4-7 13-8 17-3-4 3-6 9-5 16-5-1-10-6-12-13z"/><path d="M33 9l-4-3"/>',
  maca: '<path d="M12 43l14-21"/><circle class="f" cx="31" cy="15" r="7"/><circle cx="31" cy="15" r="7"/><path d="M31 4v4M31 22v4M20 15h4M38 15h4M23 7l3 3M36 20l3 3M39 7l-3 3M23 23l3-3"/>',
  lanca: '<path d="M8 41l26-26"/><path class="f" d="M32 11l12-7-7 12z"/><path d="M32 11l12-7-7 12zM29 14l5 5"/><path d="M12 35l-2 6 6-2"/>',
  arco: '<path d="M15 5c22 9 22 29 0 38"/><path d="M15 5v38" stroke-width="1.5"/><path d="M8 24h31M35 20l4 4-4 4M11 21l-3 3 3 3"/>',
  besta: '<path d="M24 14v30"/><path d="M7 18c6-7 28-7 34 0"/><path d="M7 18l17 8 17-8" stroke-width="1.5"/><path class="f" d="M21 32h6v10h-6z"/><path d="M24 4l-3 5h6z"/><path d="M24 9v10"/>',
  cajado: '<path d="M12 45L33 13"/><circle class="f" cx="36" cy="9" r="5"/><circle cx="36" cy="9" r="5"/><path d="M30 6c-4-1-6 2-5 5M41 13c3 2 2 6-1 6"/>',
  varinha: '<path d="M10 40l22-22" stroke-width="3"/><path class="f" d="M37 5l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M37 5l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><circle cx="27" cy="9" r="1.2"/><circle cx="42" cy="26" r="1.2"/>',
  escudo: '<path class="f" d="M24 4l16 6v12c0 12-8 18-16 22-8-4-16-10-16-22V10z"/><path d="M24 4l16 6v12c0 12-8 18-16 22-8-4-16-10-16-22V10z"/><path d="M24 9v30M12 20h24"/>',
  armadura: '<path class="f" d="M15 7l5-2c2 4 6 4 8 0l5 2 7 7-4 6v19c-8 4-16 4-24 0V20l-4-6z"/><path d="M15 7l5-2c2 4 6 4 8 0l5 2 7 7-4 6v19c-8 4-16 4-24 0V20l-4-6z"/><path d="M14 26c7 3 13 3 20 0M14 33c7 3 13 3 20 0M24 9v29"/>',
  elmo: '<path class="f" d="M9 32c0-15 7-24 15-24s15 9 15 24v8H29V30h-10v10H9z"/><path d="M9 32c0-15 7-24 15-24s15 9 15 24v8H29V30h-10v10H9z"/><path d="M24 8v22M12 24h9M27 24h9"/>',
  amuleto: '<path d="M9 5c4 14 9 19 15 20 6-1 11-6 15-20" stroke-width="1.6" stroke-dasharray="2 2.5"/><circle class="f" cx="24" cy="33" r="9"/><circle cx="24" cy="33" r="9"/><path d="M24 28l4 5-4 5-4-5z"/>',
  capa: '<path class="f" d="M17 6h14l5 7 6 30c-6-3-12-3-18 0-6-3-12-3-18 0l6-30z"/><path d="M17 6h14l5 7 6 30c-6-3-12-3-18 0-6-3-12-3-18 0l6-30z"/><path d="M18 14l-3 26M30 14l3 26M24 14v26"/><circle cx="24" cy="10" r="2.2"/>',
  luvas: '<path class="f" d="M14 42V25l-2-10c0-3 4-4 5-1l1 6V9c0-3 5-3 5 0v10V7c0-3 5-3 5 0v12-9c0-3 5-3 5 0v13l2-4c2-3 6-1 5 2l-4 12-3 5v6z"/><path d="M14 42V25l-2-10c0-3 4-4 5-1l1 6V9c0-3 5-3 5 0v10V7c0-3 5-3 5 0v12-9c0-3 5-3 5 0v13l2-4c2-3 6-1 5 2l-4 12-3 5v6z"/><path d="M14 36h19"/>',
  anel: '<ellipse cx="24" cy="30" rx="13" ry="12"/><ellipse cx="24" cy="30" rx="9" ry="8" stroke-width="1.5"/><path class="f" d="M17 13l7-8 7 8-7 6z"/><path d="M17 13l7-8 7 8-7 6zM17 13h14"/>',
  cinto: '<path class="f" d="M3 19h42v11H3z"/><path d="M3 19h42v11H3z"/><rect x="18" y="15" width="12" height="19" rx="2"/><path d="M24 24h9"/><circle cx="38" cy="24.5" r="1"/><circle cx="42" cy="24.5" r="1"/>',
  botas: '<path class="f" d="M15 5h13v23l11 4c4 1 5 4 5 7v4H12l2-14z"/><path d="M15 5h13v23l11 4c4 1 5 4 5 7v4H12l2-14z"/><path d="M12 38h32M15 11h13"/>',
  pocao: '<path class="f" d="M12 31c0-6 4-11 8-13V10h8v8c4 2 8 7 8 13a12 12 0 0 1-24 0z"/><path d="M20 18V10h8v8c4 2 8 7 8 13a12 12 0 0 1-24 0c0-6 4-11 8-13z"/><path d="M18 6h12v4H18zM14 30h20"/>',
  pergaminho: '<path class="f" d="M13 8h22c3 0 4 2 4 4s-1 4-4 4h-1v24c0 3-2 4-4 4H10c-3 0-4-2-4-4s1-4 4-4h3z"/><path d="M13 8h22c3 0 4 2 4 4s-1 4-4 4h-1v24c0 3-2 4-4 4H10c-3 0-4-2-4-4s1-4 4-4h3V12c0-2 1-4 3-4"/><path d="M18 18h11M18 23h11M18 28h8"/>',
  livro: '<path class="f" d="M7 10c6-3 12-3 17 1 5-4 11-4 17-1v30c-6-3-12-3-17 1-5-4-11-4-17-1z"/><path d="M7 10c6-3 12-3 17 1 5-4 11-4 17-1v30c-6-3-12-3-17 1-5-4-11-4-17-1zM24 11v30"/><path d="M11 17c3-1 6-1 9 0M11 23c3-1 6-1 9 0M28 17c3-1 6-1 9 0" stroke-width="1.5"/>',
  ferramenta: '<path d="M11 43l20-20"/><path class="f" d="M25 9l8-5 11 11-5 8-4-4-6 2-2-6z"/><path d="M25 9l8-5 11 11-5 8-4-4-6 2-2-6z"/><path d="M8 40l3 3"/>',
  municao: '<path d="M8 40L34 14M14 44L40 18M4 34L30 8"/><path class="f" d="M34 14l6-6-2 8zM40 18l6-6-2 8zM30 8l6-6-2 8z"/><path d="M8 40l-3 1 1-3M14 44l-3 1 1-3M4 34l-2 1 1-3" stroke-width="1.5"/>',
  tesouro: '<path class="f" d="M14 12h20l9 10-19 21L5 22z"/><path d="M14 12h20l9 10-19 21L5 22zM5 22h38M14 12l5 10 5-10 5 10 5-10M19 22l5 21 5-21"/>',
  outro: '<path class="f" d="M17 15c4 3 10 3 14 0l4 6c7 9 6 22-11 22S6 30 13 21z"/><path d="M17 15c4 3 10 3 14 0l4 6c7 9 6 22-11 22S6 30 13 21zM17 15c2-5 12-5 14 0"/><path d="M20 10l4 5 4-5" stroke-width="1.6"/>',
};

const NS = 'http://www.w3.org/2000/svg';
export function itemIcon(kind, cls = 'item-icon') {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 48 48');
  el.setAttribute('class', cls);
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = ICONS[kind] || ICONS.outro;
  return el;
}

// Silhueta de fundo do boneco de equipamento
export function silhouette() {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', '0 0 100 240');
  el.setAttribute('class', 'doll-figure');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<circle cx="50" cy="24" r="16"/><path d="M50 42c-14 0-26 4-30 14l-6 52c-1 6 7 8 9 2l7-40v54l-4 82c0 7 10 8 11 1l9-70h8l9 70c1 7 11 6 11-1l-4-82V70l7 40c2 6 10 4 9-2l-6-52c-4-10-16-14-30-14z"/>';
  return el;
}

// ------------------------------------------------------------------ regras
export const abilityMod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
const prof = (level) => 2 + Math.floor((Math.max(1, Number(level) || 1) - 1) / 4);
export const isActive = (it) => !it.attune || it.attuned;
export const usesTwoHands = (it) => it && it.slot === 'main' && (it.hands === 'two' || (it.hands === 'versatile' && it.grip === 'two'));

// CA pelo equipamento (igual ao servidor). null = nada equipado mexe na CA.
export function computeAc(c) {
  const eq = (c.items || []).filter((x) => x.slot);
  const body = eq.find((x) => x.slot === 'body' && x.kind === 'armadura');
  const shield = eq.find((x) => x.slot === 'off' && x.kind === 'escudo');
  const extras = eq.filter((x) => x.acBonus && isActive(x));
  if (!body && !shield && !extras.length) return null;
  const dex = abilityMod(c.attrs?.dex);
  let ac = body
    ? body.acBase + (body.armorType === 'pesada' ? 0 : body.armorType === 'media' ? Math.min(dex, 2) : dex) + (isActive(body) ? body.magic : 0)
    : 10 + dex;
  if (shield) ac += shield.acBase + (isActive(shield) ? shield.magic : 0);
  for (const x of extras) ac += x.acBonus;
  return Math.max(0, ac);
}

// Ataques das armas equipadas: bônus e dano calculados pela ficha.
export function weaponAttacks(c) {
  const items = c.items || [];
  const main = items.find((x) => x.slot === 'main');
  const off = items.find((x) => x.slot === 'off');
  const str = abilityMod(c.attrs?.str);
  const dex = abilityMod(c.attrs?.dex);
  const out = [];
  for (const it of [main, off]) {
    if (!it || !KINDS[it.kind]?.weapon || !it.dmg) continue;
    const m = it.ranged ? dex : it.finesse ? Math.max(str, dex) : str;
    const magic = isActive(it) ? it.magic || 0 : 0;
    const toHit = m + (it.prof ? prof(c.level) : 0) + magic;
    const two = usesTwoHands(it);
    const dice = two && it.hands === 'versatile' && it.dmg2 ? it.dmg2 : it.dmg;
    // segunda arma (ação bônus): não soma o modificador ao dano, a não ser que seja negativo
    const bonusAction = it === off && main && KINDS[main.kind]?.weapon && main.dmg;
    const dmgMod = (bonusAction ? Math.min(0, m) : m) + magic;
    const damage = dmgMod ? `${dice}${dmgMod > 0 ? '+' : ''}${dmgMod}` : dice;
    out.push({
      item: it, name: it.name, toHit, damage, type: it.dmgType,
      note: [two && it.hands === 'versatile' ? 'duas mãos' : '', bonusAction ? 'ação bônus' : '', it.ranged ? 'distância' : ''].filter(Boolean).join(', '),
    });
  }
  return out;
}

export function carried(c) {
  return (c.items || []).reduce((s, x) => s + (Number(x.weight) || 0) * (Number(x.qty) || 1), 0);
}
export const capacity = (c) => (Number(c.attrs?.str) || 10) * 7.5;
export const fmtKg = (n) => `${(Math.round(n * 10) / 10).toLocaleString('pt-BR')} kg`;
