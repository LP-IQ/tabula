// Itens dos personagens: tipos, espaços do corpo, validação, equipar, sintonia e CA automática.
// A mesma tabela de tipos existe no navegador (public/js/itemdata.js); mantenha as duas iguais.

const SLOTS = ['head', 'neck', 'cloak', 'body', 'main', 'off', 'hands', 'ring1', 'ring2', 'belt', 'feet'];

const WEAPON_SLOTS = ['main', 'off'];
const KINDS = {
  // armas (vão nas mãos)
  espada: WEAPON_SLOTS, adaga: WEAPON_SLOTS, machado: WEAPON_SLOTS, maca: WEAPON_SLOTS, lanca: WEAPON_SLOTS,
  arco: WEAPON_SLOTS, besta: WEAPON_SLOTS, cajado: WEAPON_SLOTS, varinha: WEAPON_SLOTS,
  // proteção e acessórios
  escudo: ['off'], armadura: ['body'], elmo: ['head'], amuleto: ['neck'], capa: ['cloak'],
  luvas: ['hands'], anel: ['ring1', 'ring2'], cinto: ['belt'], botas: ['feet'],
  // só na mochila
  pocao: [], pergaminho: [], livro: [], ferramenta: [], municao: [], tesouro: [], outro: [],
};
const WEAPONS = new Set(['espada', 'adaga', 'machado', 'maca', 'lanca', 'arco', 'besta', 'cajado', 'varinha']);
const RARITIES = ['comum', 'incomum', 'raro', 'muito-raro', 'lendario', 'artefato'];
const ARMOR_TYPES = ['leve', 'media', 'pesada'];
const MAX_ATTUNED = 3;
const MAX_ITEMS = 200;

const str = (v, max) => String(v ?? '').slice(0, max);
const int = (v, lo, hi, def = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};
const num = (v, lo, hi, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};
const dice = (v) => str(v, 30).replace(/[^0-9dD+\- ]/g, '').trim();
const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

// Valida um item vindo do navegador. `prev` é o item antigo (mantém onde ele está equipado).
function normalizeItem(raw, prev, imgUrl) {
  const r = raw || {};
  const kind = KINDS[r.kind] ? r.kind : 'outro';
  const hands = ['one', 'two', 'versatile'].includes(r.hands) ? r.hands : 'one';
  const item = {
    id: prev?.id || str(r.id, 40),
    name: str(r.name, 80).trim() || 'Item sem nome',
    kind,
    img: imgUrl(r.img),
    rarity: RARITIES.includes(r.rarity) ? r.rarity : 'comum',
    attune: !!r.attune,
    attuned: !!prev?.attuned && !!r.attune,
    qty: int(r.qty, 1, 9999, 1),
    weight: Math.round(num(r.weight, 0, 9999, 0) * 100) / 100,
    desc: str(r.desc, 8000),
    // de onde veio (índice do SRD, quando saiu da Biblioteca do compêndio)
    srd: str(r.srd, 60),
    // arma
    dmg: dice(r.dmg),
    dmg2: dice(r.dmg2),
    dmgType: str(r.dmgType, 20),
    hands,
    finesse: !!r.finesse,
    light: !!r.light,
    ranged: !!r.ranged,
    prof: r.prof === undefined ? true : !!r.prof,
    magic: int(r.magic, -5, 5),
    // armadura e escudo
    armorType: ARMOR_TYPES.includes(r.armorType) ? r.armorType : 'leve',
    acBase: int(r.acBase, 0, 30, kind === 'escudo' ? 2 : 10),
    // bônus na CA de outros itens (anel de proteção, manto…)
    acBonus: int(r.acBonus, -5, 10),
    // onde está
    slot: prev?.slot ?? null,
    grip: prev?.grip === 'two' ? 'two' : 'one',
  };
  // se o tipo mudou e o espaço não serve mais, volta para a mochila
  if (item.slot && !KINDS[kind].includes(item.slot)) item.slot = null;
  if (hands !== 'versatile') item.grip = hands === 'two' ? 'two' : 'one';
  return item;
}

const usesTwoHands = (it) => it && it.slot === 'main' && (it.hands === 'two' || (it.hands === 'versatile' && it.grip === 'two'));

// Equipa (ou guarda, com slot = null). Resolve conflitos: quem estava no espaço volta para a mochila;
// arma de duas mãos libera a mão esquerda; usar a mão esquerda tira a arma de duas mãos.
function equip(items, item, slot, grip) {
  if (slot === null) { item.slot = null; return; }
  if (!SLOTS.includes(slot)) throw new Error('Espaço inválido');
  if (!KINDS[item.kind].includes(slot)) throw new Error('Esse item não vai nesse espaço');
  if (item.hands === 'versatile') item.grip = grip === 'two' ? 'two' : 'one';
  if (item.hands === 'two' && slot === 'off') throw new Error('Arma de duas mãos vai na mão direita');
  for (const other of items) {
    if (other === item || other.slot !== slot) continue;
    other.slot = null;
  }
  item.slot = slot;
  const main = items.find((x) => x.slot === 'main');
  const off = items.find((x) => x.slot === 'off');
  if (usesTwoHands(item) && off && off !== item) off.slot = null;
  if (slot === 'off' && main && main !== item && usesTwoHands(main)) {
    if (main.hands === 'versatile') main.grip = 'one';
    else main.slot = null;
  }
}

// O bônus mágico de um item que exige sintonia só vale se estiver sintonizado.
const active = (it) => !it.attune || it.attuned;

// CA pelo equipamento. Devolve null quando nada equipado mexe na CA (aí vale a CA digitada).
function computeAc(c) {
  const eq = (c.items || []).filter((x) => x.slot);
  const body = eq.find((x) => x.slot === 'body' && x.kind === 'armadura');
  const shield = eq.find((x) => x.slot === 'off' && x.kind === 'escudo');
  const extras = eq.filter((x) => x.acBonus && active(x));
  if (!body && !shield && !extras.length) return null;
  const dex = mod(c.attrs?.dex);
  let ac;
  if (body) {
    const capped = body.armorType === 'pesada' ? 0 : body.armorType === 'media' ? Math.min(dex, 2) : dex;
    ac = body.acBase + capped + (active(body) ? body.magic : 0);
  } else {
    ac = 10 + dex;
  }
  if (shield) ac += shield.acBase + (active(shield) ? shield.magic : 0);
  for (const x of extras) ac += x.acBonus;
  return Math.max(0, ac);
}

// Atualiza a CA guardada quando a CA automática está ligada e o equipamento conta.
function applyAutoAc(c) {
  if (!c.autoAc) return;
  const ac = computeAc(c);
  if (ac !== null) c.ac = ac;
}

// O que os outros jogadores veem: só o que está equipado (sem a mochila nem detalhes).
function publicEquipment(c) {
  return (c.items || []).filter((x) => x.slot).map((x) => ({
    id: x.id, name: x.name, kind: x.kind, img: x.img, rarity: x.rarity, slot: x.slot, grip: x.grip, hands: x.hands,
  }));
}

module.exports = {
  SLOTS, KINDS, WEAPONS, RARITIES, MAX_ATTUNED, MAX_ITEMS,
  normalizeItem, equip, computeAc, applyAutoAc, publicEquipment, usesTwoHands, active,
};
