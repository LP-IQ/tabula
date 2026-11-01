// Equipamento na ficha: boneco com os espaços do corpo, mochila, editor de item, sintonia, carga e CA automática.
import { app, emit } from './core.js';
import { h, setKids, toast, openModal, chooseAndUpload, pushPasteTarget, fmtMod } from './util.js';
import {
  SLOTS, SLOT_LABEL, SLOT_ICON, KINDS, RARITIES, RARITY_LABEL, RARITY_COLOR, DAMAGE_TYPES, ARMOR_TYPES, PRESETS,
  MAX_ATTUNED, itemIcon, silhouette, computeAc, usesTwoHands, carried, capacity, fmtKg,
} from './itemdata.js';

const DRAG_TYPE = 'text/x-tabula-item';
const HAND_LABEL = { one: 'Uma mão', two: 'Duas mãos', versatile: 'Versátil' };

// ------------------------------------------------------------------ peças
export function itemFace(it, cls = '') {
  const face = h('span', { class: `item-face ${cls}`, style: { '--r': RARITY_COLOR[it.rarity] || RARITY_COLOR.comum } });
  if (it.img) face.append(h('img', { src: it.img, alt: '', loading: 'lazy', draggable: 'false' }));
  else face.append(itemIcon(it.kind));
  if (it.attuned) face.append(h('span', { class: 'attuned-mark', title: 'Sintonizado' }, '✦'));
  return face;
}

function statsLine(it) {
  const k = KINDS[it.kind] || KINDS.outro;
  const parts = [];
  if (k.weapon && it.dmg) {
    parts.push(`${it.dmg}${it.dmgType ? ' ' + it.dmgType : ''}`);
    if (it.hands === 'versatile' && it.dmg2) parts.push(`versátil (${it.dmg2})`);
    if (it.hands === 'two') parts.push('duas mãos');
    if (it.finesse) parts.push('acuidade');
    if (it.light) parts.push('leve');
    if (it.ranged) parts.push('à distância');
  }
  if (it.kind === 'armadura') parts.push(`CA ${it.acBase}${it.armorType === 'pesada' ? '' : it.armorType === 'media' ? ' + DES (máx. 2)' : ' + DES'}`);
  if (it.kind === 'escudo') parts.push(`CA +${it.acBase}`);
  if (it.magic) parts.push(`${fmtMod(it.magic)} mágico`);
  if (it.acBonus) parts.push(`${fmtMod(it.acBonus)} na CA`);
  return parts.join(' · ');
}

// ------------------------------------------------------------------ ações
const act = (ev, p) => emit(ev, p);

function slotsFor(c, it) {
  const allowed = KINDS[it.kind]?.slots || [];
  if (it.kind === 'anel') {
    const free = allowed.filter((s) => !c.items.some((x) => x.slot === s));
    return free.length ? [free[0]] : allowed;
  }
  return allowed;
}

async function equipTo(c, it, slot, grip) {
  const r = await act('item:equip', { charId: c.id, itemId: it.id, slot, grip });
  return r;
}

// Janela de um item: detalhes e o que dá para fazer com ele
export function itemMenu(c, it, { editable = true } = {}) {
  const k = KINDS[it.kind] || KINDS.outro;
  const actions = [];
  const close = () => modal.close();
  const run = (fn) => async () => { if (await fn()) close(); };
  if (editable) {
    if (it.slot) {
      actions.push(h('button', { class: 'btn sm', onclick: run(() => equipTo(c, it, null)) }, '↩ Guardar na mochila'));
      if (it.hands === 'versatile' && it.slot === 'main') {
        const two = it.grip === 'two';
        actions.push(h('button', { class: 'btn sm', onclick: run(() => equipTo(c, it, 'main', two ? 'one' : 'two')) }, two ? '✋ Usar com uma mão' : '🙌 Usar com as duas mãos'));
      }
    } else {
      for (const s of slotsFor(c, it)) {
        if (it.hands === 'versatile' && s === 'main') {
          actions.push(h('button', { class: 'btn sm primary', onclick: run(() => equipTo(c, it, 'main', 'one')) }, 'Equipar: mão direita'));
          actions.push(h('button', { class: 'btn sm primary', onclick: run(() => equipTo(c, it, 'main', 'two')) }, 'Equipar com as duas mãos'));
        } else if (!(it.hands === 'two' && s === 'off')) {
          actions.push(h('button', { class: 'btn sm primary', onclick: run(() => equipTo(c, it, s)) }, `Equipar: ${SLOT_LABEL[s].toLowerCase()}`));
        }
      }
    }
    if (it.attune) {
      actions.push(h('button', {
        class: 'btn sm', onclick: run(() => act('item:attune', { charId: c.id, itemId: it.id, on: !it.attuned })),
      }, it.attuned ? '✧ Desfazer a sintonia' : '✦ Sintonizar'));
    }
    actions.push(h('button', { class: 'btn sm', onclick: () => { close(); itemEditor(c, it); } }, '✎ Editar'));
    if (it.qty > 1) actions.push(h('button', { class: 'btn sm', onclick: run(() => act('item:split', { charId: c.id, itemId: it.id })) }, 'Separar 1'));
    const others = app.state.characters.filter((x) => x.id !== c.id);
    if (others.length) actions.push(h('button', { class: 'btn sm', onclick: () => { close(); giveDialog(c, it); } }, '🎁 Passar para…'));
    actions.push(h('button', {
      class: 'btn sm danger',
      onclick: () => confirm(`Jogar fora "${it.name}"?`) && run(() => act('item:delete', { charId: c.id, itemId: it.id }))(),
    }, 'Apagar'));
  }
  const modal = openModal(it.name, [
    h('div', { class: 'item-detail' },
      itemFace(it, 'big'),
      h('div', { class: 'stack' },
        h('div', { class: 'muted small' }, [k.label, RARITY_LABEL[it.rarity] || 'Comum', it.attune ? (it.attuned ? 'sintonizado' : 'requer sintonização') : ''].filter(Boolean).join(' · ')),
        statsLine(it) ? h('div', {}, statsLine(it)) : null,
        h('div', { class: 'muted small' }, `${it.qty > 1 ? `${it.qty} unidades · ` : ''}${it.weight ? fmtKg(it.weight * it.qty) : 'sem peso'}${it.slot ? ` · equipado: ${SLOT_LABEL[it.slot].toLowerCase()}` : ''}`))),
    it.desc ? h('p', { class: 'item-desc' }, it.desc) : null,
    actions.length ? h('div', { class: 'row gap wrap' }, actions) : null,
  ]);
}

function giveDialog(c, it) {
  const others = app.state.characters.filter((x) => x.id !== c.id);
  const to = h('select', { 'aria-label': 'Para quem' }, others.map((x) => h('option', { value: x.id }, x.name)));
  const qty = h('input', { type: 'number', class: 'num', min: '1', max: String(it.qty), value: String(it.qty), 'aria-label': 'Quantos' });
  const modal = openModal(`Passar "${it.name}"`, [
    h('div', { class: 'row gap wrap' }, h('label', { class: 'mini' }, 'Para', to), it.qty > 1 ? h('label', { class: 'mini' }, 'Quantos', qty) : null),
    h('p', { class: 'muted small' }, 'O item sai desta mochila e vai para a do outro personagem (desequipado). O dono dele recebe um aviso.'),
    h('div', { class: 'row gap' }, h('span', { class: 'grow' }), h('button', {
      class: 'btn primary',
      onclick: async () => {
        const r = await act('item:give', { charId: c.id, itemId: it.id, toCharId: to.value, qty: Number(qty.value) || it.qty });
        if (r) { modal.close(); toast(`${r.name} foi para ${r.to}`, 'ok'); }
      },
    }, 'Passar')),
  ]);
}

// ------------------------------------------------------------------ editor
export function itemEditor(c, it0, preset) {
  const it = { kind: 'outro', rarity: 'comum', qty: 1, weight: 0, hands: 'one', prof: true, magic: 0, acBase: 10, acBonus: 0, armorType: 'leve', ...preset, ...it0 };
  if (it.kind === 'escudo' && it.acBase > 5) it.acBase = 2;
  const isNew = !it0?.id;
  const f = {};
  const inp = (key, attrs = {}) => (f[key] = h('input', { value: it[key] ?? '', ...attrs }));
  const num = (key, attrs = {}) => inp(key, { type: 'number', class: 'num', ...attrs });
  const chk = (key) => (f[key] = h('input', { type: 'checkbox', checked: !!it[key] }));
  const sel = (key, opts) => (f[key] = h('select', {}, opts.map(([v, l]) => h('option', { value: v, selected: String(it[key]) === v }, l))));

  // imagem
  let img = it.img || '';
  const face = h('span', { class: 'editor-face' });
  const drawFace = () => setKids(face, itemFace({ ...it, kind: f.kind?.value || it.kind, rarity: f.rarity?.value || it.rarity, img, attuned: false }, 'big'));
  const setImg = (url) => { img = url; drawFace(); };

  const presetSel = isNew ? h('select', { 'aria-label': 'Modelo' },
    h('option', { value: '' }, 'Começar de um modelo do Livro do Jogador…'),
    PRESETS.map(([group, list], gi) => h('optgroup', { label: group }, list.map((p, pi) => h('option', { value: `${gi}:${pi}` }, p.name))))) : null;

  sel('kind', Object.entries(KINDS).map(([k, v]) => [k, v.label]));
  sel('rarity', RARITIES.map(([k, l]) => [k, l]));
  sel('hands', [['one', 'Uma mão'], ['versatile', 'Versátil (uma ou duas mãos)'], ['two', 'Duas mãos']]);
  sel('armorType', ARMOR_TYPES);
  const dmgTypes = h('datalist', { id: 'dmg-types' }, DAMAGE_TYPES.map((d) => h('option', { value: d })));

  const weaponBox = h('fieldset', { class: 'item-fs' }, h('legend', {}, 'Arma'),
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'mini' }, 'Dano', inp('dmg', { placeholder: '1d8', class: 'dice' })),
      h('label', { class: 'mini' }, 'Tipo de dano', inp('dmgType', { list: 'dmg-types', placeholder: 'cortante', class: 'dtype' })),
      h('label', { class: 'mini' }, 'Mãos', f.hands),
      h('label', { class: 'mini v2' }, 'Dano com duas mãos', inp('dmg2', { placeholder: '1d10', class: 'dice' }))),
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'mini toggle' }, chk('finesse'), 'Acuidade (FOR ou DES)'),
      h('label', { class: 'mini toggle' }, chk('light'), 'Leve'),
      h('label', { class: 'mini toggle' }, chk('ranged'), 'À distância (DES)'),
      h('label', { class: 'mini toggle' }, chk('prof'), 'Proficiente')),
    dmgTypes);
  const armorBox = h('fieldset', { class: 'item-fs' }, h('legend', {}, 'Proteção'),
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'mini only-armor' }, 'Tipo', f.armorType),
      h('label', { class: 'mini' }, h('span', { class: 'ac-label' }, 'CA base'), num('acBase', { min: '0', max: '30' }))));
  const magicRow = h('div', { class: 'row gap wrap' },
    h('label', { class: 'mini', title: 'Armas: soma no ataque e no dano. Armaduras e escudos: soma na CA.' }, 'Bônus mágico (+1, +2…)', num('magic', { min: '-5', max: '5' })),
    h('label', { class: 'mini only-extra', title: 'Para anéis, mantos e outros itens que dão CA (ex.: Anel de Proteção +1)' }, 'Bônus na CA', num('acBonus', { min: '-5', max: '10' })));

  const sync = () => {
    const kind = f.kind.value;
    const k = KINDS[kind];
    weaponBox.hidden = !k.weapon;
    armorBox.hidden = !['armadura', 'escudo'].includes(kind);
    armorBox.querySelector('.only-armor').hidden = kind !== 'armadura';
    armorBox.querySelector('.ac-label').textContent = kind === 'escudo' ? 'Bônus de CA' : 'CA base';
    magicRow.querySelector('.only-extra').hidden = !k.slots.length || ['armadura', 'escudo'].includes(kind) || !!k.weapon;
    magicRow.hidden = !k.slots.length && !k.weapon;
    weaponBox.querySelector('.v2').hidden = f.hands.value !== 'versatile';
    drawFace();
  };
  f.kind.addEventListener('change', () => {
    if (f.kind.value === 'escudo' && Number(f.acBase.value) > 5) f.acBase.value = '2';
    if (f.kind.value === 'armadura' && Number(f.acBase.value) < 10) f.acBase.value = '11';
    sync();
  });
  f.rarity.addEventListener('change', drawFace);
  f.hands.addEventListener('change', sync);

  presetSel?.addEventListener('change', () => {
    if (!presetSel.value) return;
    const [gi, pi] = presetSel.value.split(':').map(Number);
    const p = PRESETS[gi][1][pi];
    const base = { qty: 1, weight: 0, hands: 'one', dmg: '', dmg2: '', dmgType: '', finesse: false, light: false, ranged: false, acBase: 10, armorType: 'leve', desc: '', rarity: 'comum', attune: false };
    const v = { ...base, ...p };
    for (const [key, el] of Object.entries(f)) {
      if (!(key in v)) continue;
      if (el.type === 'checkbox') el.checked = !!v[key];
      else el.value = String(v[key]);
    }
    sync();
  });

  const save = async () => {
    const item = { id: it0?.id, img };
    for (const [key, el] of Object.entries(f)) {
      item[key] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
    }
    if (!item.name.trim()) { f.name.focus(); return toast('Dê um nome ao item', 'error'); }
    const r = await act('item:save', { charId: c.id, item });
    if (r) {
      modal.close();
      if (isNew && c.ownerId && c.ownerId !== app.me.id) toast(`"${item.name}" entregue a ${c.name}`, 'ok');
    }
  };

  const unpaste = pushPasteTarget((url) => { setImg(url); toast('Imagem colada no item', 'ok'); });
  const modal = openModal(isNew ? (c.ownerId && c.ownerId !== app.me.id ? `Dar item a ${c.name}` : 'Novo item') : `Editar: ${it.name}`, [
    presetSel,
    h('div', { class: 'item-editor-top' },
      h('div', { class: 'stack center' }, face,
        h('div', { class: 'row gap' },
          h('button', { type: 'button', class: 'btn sm', onclick: async () => { const u = await chooseAndUpload(); if (u) setImg(u); } }, 'Imagem…'),
          h('button', { type: 'button', class: 'btn ghost sm', title: 'Voltar ao desenho do tipo', onclick: () => setImg('') }, '✕')),
        h('span', { class: 'muted tiny' }, 'ou Ctrl+V para colar')),
      h('div', { class: 'stack grow' },
        h('label', {}, 'Nome', inp('name', { maxlength: '80', placeholder: 'Ex.: Espada longa +1' })),
        h('div', { class: 'row gap wrap' },
          h('label', { class: 'mini' }, 'Tipo', f.kind),
          h('label', { class: 'mini' }, 'Raridade', f.rarity)),
        h('div', { class: 'row gap wrap' },
          h('label', { class: 'mini' }, 'Quantidade', num('qty', { min: '1', max: '9999' })),
          h('label', { class: 'mini' }, 'Peso (kg, cada)', num('weight', { min: '0', step: '0.05' })),
          h('label', { class: 'mini toggle' }, chk('attune'), 'Requer sintonização')))),
    weaponBox,
    armorBox,
    magicRow,
    h('label', {}, 'Descrição', (f.desc = h('textarea', { rows: 4, value: it.desc || '', placeholder: 'O que o item faz, de onde veio, cargas…' }))),
    h('div', { class: 'row gap' }, h('span', { class: 'grow' }), h('button', { class: 'btn primary', onclick: save }, isNew ? 'Criar item' : 'Salvar item')),
  ], { wide: true, onClose: unpaste });
  sync();
  f.name.focus();
}

// ------------------------------------------------------------------ boneco
const AREAS = { head: 'head', neck: 'neck', cloak: 'cloak', body: 'body', main: 'main', off: 'off', hands: 'hands', ring1: 'ring1', ring2: 'ring2', belt: 'belt', feet: 'feet' };

function slotEl(slot, it, { editable, ghostOf, onClick, onDrop }) {
  const label = SLOT_LABEL[slot];
  const el = h('button', {
    class: 'slot' + (it ? ' filled' : '') + (ghostOf ? ' blocked' : ''),
    style: { gridArea: AREAS[slot] },
    title: it ? `${it.name} — ${label}` : ghostOf ? `${label}: ocupada pela arma de duas mãos` : `${label} (vazio)`,
    'aria-label': it ? `${label}: ${it.name}` : `${label}: vazio`,
    dataset: { slot },
    onclick: onClick,
  },
  it ? itemFace(it) : ghostOf ? itemFace({ ...ghostOf, attuned: false }, 'ghost') : h('span', { class: 'slot-ghost' }, itemIcon(SLOT_ICON[slot])),
  h('span', { class: 'slot-name' }, it ? it.name : ghostOf ? 'duas mãos' : label));
  if (editable) {
    if (it) {
      el.draggable = true;
      el.addEventListener('dragstart', (e) => { e.dataTransfer.setData(DRAG_TYPE, it.id); e.dataTransfer.effectAllowed = 'move'; });
    }
    el.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); el.classList.add('over'); } });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); onDrop(e.dataTransfer.getData(DRAG_TYPE)); });
  }
  return el;
}

export function doll(items, { editable = false, onSlot, onItem, onDrop } = {}) {
  const bySlot = Object.fromEntries(items.filter((x) => x.slot).map((x) => [x.slot, x]));
  const main = bySlot.main;
  const twoHanded = main && (main.hands === 'two' || (main.hands === 'versatile' && main.grip === 'two'));
  return h('div', { class: 'doll' },
    silhouette(),
    SLOTS.map(([slot]) => {
      const it = bySlot[slot];
      const ghostOf = slot === 'off' && !it && twoHanded ? main : null;
      return slotEl(slot, it, {
        editable,
        ghostOf,
        onClick: () => (it ? onItem?.(it) : ghostOf ? onItem?.(ghostOf) : onSlot?.(slot)),
        onDrop: (id) => onDrop?.(id, slot),
      });
    }));
}

// escolher um item da mochila para um espaço vazio
function pickForSlot(c, slot) {
  const fits = c.items.filter((x) => !x.slot && (KINDS[x.kind]?.slots || []).includes(slot) && !(slot === 'off' && x.hands === 'two'));
  const modal = openModal(`${SLOT_LABEL[slot]}: equipar`, [
    fits.length
      ? h('ul', { class: 'plain-list pick-list' }, fits.map((it) => h('li', {},
        h('button', {
          class: 'pick-row',
          onclick: async () => { if (await equipTo(c, it, slot, it.hands === 'versatile' && slot === 'main' ? 'one' : undefined)) modal.close(); },
        }, itemFace(it), h('span', { class: 'grow' }, h('b', {}, it.name), h('small', { class: 'muted' }, ` ${statsLine(it)}`))))))
      : h('p', { class: 'muted' }, 'Nenhum item da mochila serve neste espaço.'),
    h('div', { class: 'row gap' }, h('span', { class: 'grow' }),
      h('button', { class: 'btn sm', onclick: () => { modal.close(); itemEditor(c, null, { kind: SLOT_ICON[slot] === 'escudo' ? 'escudo' : SLOT_ICON[slot] }); } }, '+ Novo item')),
  ]);
}

// ------------------------------------------------------------------ caixa da ficha
export function equipmentBox(c, { patch }) {
  const items = c.items || [];
  const auto = computeAc(c);
  const attuned = items.filter((x) => x.attuned).length;
  const load = carried(c);
  const cap = capacity(c);
  const owner = c.ownerId ? app.user(c.ownerId) : null;
  const givingToOther = app.isGM && owner && owner.id !== app.me.id;

  const onDrop = async (id, slot) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    if (!(KINDS[it.kind]?.slots || []).includes(slot)) return toast(`${it.name} não vai em ${SLOT_LABEL[slot].toLowerCase()}`, 'error');
    await equipTo(c, it, slot, it.hands === 'versatile' && slot === 'main' ? it.grip || 'one' : undefined);
  };

  const bag = items.filter((x) => !x.slot);
  const bagEl = h('div', { class: 'bag' },
    bag.length ? bag.map((it) => {
      const tile = h('button', {
        class: 'bag-item', title: `${it.name}${statsLine(it) ? ' — ' + statsLine(it) : ''}`, draggable: 'true',
        onclick: () => itemMenu(c, it),
      }, itemFace(it), h('span', { class: 'bag-name' }, it.name), it.qty > 1 ? h('span', { class: 'qty' }, `×${it.qty}`) : null);
      tile.addEventListener('dragstart', (e) => { e.dataTransfer.setData(DRAG_TYPE, it.id); e.dataTransfer.effectAllowed = 'move'; });
      return tile;
    }) : h('p', { class: 'muted small bag-empty' }, items.length ? 'Tudo o que você tem está equipado.' : 'A mochila está vazia.'));
  bagEl.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); bagEl.classList.add('over'); } });
  bagEl.addEventListener('dragleave', () => bagEl.classList.remove('over'));
  bagEl.addEventListener('drop', (e) => {
    e.preventDefault();
    bagEl.classList.remove('over');
    const it = items.find((x) => x.id === e.dataTransfer.getData(DRAG_TYPE));
    if (it?.slot) equipTo(c, it, null);
  });

  return h('div', { class: 'equip' },
    h('div', { class: 'equip-summary' },
      h('div', { class: 'eq-stat', title: auto !== null && c.autoAc ? 'Calculada pela armadura, escudo e itens equipados' : 'CA digitada na ficha' },
        h('small', {}, 'CA'), h('b', {}, String(c.ac)),
        h('label', { class: 'mini toggle' }, h('input', { type: 'checkbox', checked: c.autoAc !== false, onchange: (e) => patch(c, { autoAc: e.target.checked }) }), 'automática')),
      h('div', { class: 'eq-stat', title: `No máximo ${MAX_ATTUNED} itens sintonizados ao mesmo tempo` },
        h('small', {}, 'Sintonia'),
        h('span', { class: 'attune-pips' }, Array.from({ length: MAX_ATTUNED }, (_, i) => h('i', { class: i < attuned ? 'on' : '' }))),
        h('span', { class: 'muted small' }, `${attuned}/${MAX_ATTUNED}`)),
      h('div', { class: 'eq-stat grow', title: 'Capacidade de carga: 7,5 × Força (Livro do Jogador, cap. 7)' },
        h('small', {}, 'Carga'),
        h('span', { class: 'small' + (load > cap ? ' over' : '') }, `${fmtKg(load)} de ${fmtKg(cap)}`),
        h('span', { class: 'load-bar' }, h('i', { style: { width: Math.min(100, (load / cap) * 100) + '%' }, class: load > cap ? 'over' : '' })))),
    doll(items, { editable: true, onItem: (it) => itemMenu(c, it), onSlot: (slot) => pickForSlot(c, slot), onDrop }),
    h('div', { class: 'row gap bag-head' },
      h('b', {}, `Mochila`), h('span', { class: 'muted small' }, bag.length ? `${bag.length} ${bag.length === 1 ? 'item' : 'itens'}` : ''),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn sm primary', onclick: () => itemEditor(c, null) }, givingToOther ? '🎁 Dar item' : '+ Item')),
    bagEl,
    h('p', { class: 'muted tiny' }, 'Toque num item para equipar, sintonizar ou passar para alguém. No computador, dá para arrastar entre a mochila e os espaços.'));
}

// ------------------------------------------------------------------ só olhar (ficha dos outros)
function peek(it) {
  openModal(it.name, [h('div', { class: 'item-detail' }, itemFace(it, 'big'),
    h('div', { class: 'muted small' }, `${KINDS[it.kind]?.label || 'Item'} · ${RARITY_LABEL[it.rarity] || 'Comum'} · ${SLOT_LABEL[it.slot]?.toLowerCase() || ''}`))]);
}
export function dollView(equip) {
  return doll(equip || [], { editable: false, onItem: peek });
}
export { usesTwoHands, HAND_LABEL };
