// Biblioteca do compêndio: magias e itens do SRD 5.1 (CC-BY-4.0), em português.
// Magias: filtro pelas classes do personagem (multiclasse incluída) e pelo círculo que ele já conjura;
// "＋ Adicionar à ficha" põe a magia na lista de magias da ficha.
// Itens: equipamento do Livro do Jogador para pôr na mochila; itens mágicos só o mestre vê, para dar aos personagens.
import { app, emit } from './core.js';
import { h, setKids, toast, openModal } from './util.js';
import { spellLists, spellAccess, SPELL_LISTS, SPELL_LIST_LABEL } from './rules.js';
import { RARITIES, RARITY_LABEL, RARITY_COLOR, fmtKg } from './itemdata.js';
import { itemFace } from './equipment.js';

// ------------------------------------------------------------------ dados (carregados uma vez)
let spellsP = null;
let itemsP = null;
function fetchJson(url, what) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(r.status === 404 ? `o arquivo ${url.slice(1)} não está na pasta public da mesa` : `erro ${r.status}`);
    return r.json();
  }).catch((e) => { toast(`Não deu para carregar ${what}: ${e.message}`, 'error', 6000); throw e; });
}
export function loadSpells() {
  if (!spellsP) spellsP = fetchJson('/data/srd-magias.json', 'as magias').then((d) => d.magias).catch((e) => { spellsP = null; throw e; });
  return spellsP;
}
export function loadItems() {
  if (!itemsP) itemsP = fetchJson('/data/srd-itens.json', 'os itens').then((d) => d).catch((e) => { itemsP = null; throw e; });
  return itemsP;
}

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const LEVEL_LABEL = (l) => (l === 0 ? 'Truque' : `${l}º círculo`);
const SCHOOLS = ['abjuração', 'adivinhação', 'conjuração', 'encantamento', 'evocação', 'ilusão', 'necromancia', 'transmutação'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------------ texto com marcação simples
// ***Negrito.*** · *itálico* · linhas "- " viram lista · linhas "| a | b |" viram tabela
function inline(text) {
  const out = [];
  const re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[3] != null ? h('i', {}, m[3]) : h('b', {}, m[1] ?? m[2]));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
export function richText(paragraphs) {
  return (paragraphs || []).map((p) => {
    const lines = String(p).split('\n');
    if (lines.every((l) => l.startsWith('|'))) {
      const rows = lines.filter((l) => !/^\|[\s|:-]+\|$/.test(l)).map((l) => l.replace(/^\||\|$/g, '').split('|').map((x) => x.trim()));
      const [head, ...body] = rows;
      return h('div', { class: 'lib-table' }, h('table', {},
        h('thead', {}, h('tr', {}, head.map((x) => h('th', {}, inline(x))))),
        h('tbody', {}, body.map((r) => h('tr', {}, r.map((x) => h('td', {}, inline(x))))))));
    }
    if (lines.every((l) => l.startsWith('- '))) return h('ul', {}, lines.map((l) => h('li', {}, inline(l.slice(2)))));
    return h('p', {}, inline(p));
  });
}

// ------------------------------------------------------------------ personagem-alvo
// Jogador: os personagens dele. Mestre: todos.
function targets() {
  return app.isGM ? (app.state?.characters || []) : app.myCharacters();
}
let targetId = (() => { try { return localStorage.getItem('tabula.lib.char') || ''; } catch { return ''; } })();
function currentTarget() {
  const list = targets();
  let c = list.find((x) => x.id === targetId);
  if (!c && !app.isGM && list.length) c = list[0];
  return c || null;
}
function setTarget(id) {
  targetId = id;
  try { localStorage.setItem('tabula.lib.char', id); } catch { /* sem armazenamento */ }
}
function targetSelect(onChange, { allowNone = app.isGM, noneLabel = '— nenhum personagem —' } = {}) {
  const list = targets();
  const cur = currentTarget();
  if (!list.length) return null;
  if (list.length === 1 && !allowNone) return h('span', { class: 'lib-target' }, 'Para ', h('b', {}, list[0].name));
  return h('label', { class: 'mini lib-target' }, 'Para',
    h('select', {
      'aria-label': 'Personagem',
      onchange: (e) => { setTarget(e.target.value); onChange(); },
    },
    allowNone ? h('option', { value: '' }, noneLabel) : null,
    list.map((c) => h('option', { value: c.id, selected: cur?.id === c.id }, c.name))));
}

// Navegadores abertos se redesenham quando o que eles mostram muda (personagens, classes, magias da ficha)
const browsers = new Set();
function live(root, keyFn, redraw) {
  browsers.add({ root, keyFn, redraw, key: keyFn() });
}
const targetKey = () => targets().map((c) => [c.id, c.name, c.class, c.level, c.classes, (c.spellbook || []).map((x) => x.id)]);
export function refreshLibrary() {
  for (const b of browsers) {
    if (!b.root.isConnected && b.seen) { browsers.delete(b); continue; }
    if (b.root.isConnected) b.seen = true;
    const k = b.keyFn();
    if (k === b.key) continue;
    if (b.root.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) continue;
    b.key = k;
    b.redraw();
  }
}

// ------------------------------------------------------------------ magias
export function spellMeta(s) {
  const lvl = s.l === 0 ? `Truque de ${s.e}` : `${s.l}º círculo, ${s.e}`;
  return lvl + (s.ri ? ' (ritual)' : '');
}
// Cartão da magia no formato do Livro do Jogador
export function spellCard(s, extra) {
  return h('div', { class: 'spell-card' },
    h('div', { class: 'spell-head' },
      h('h3', {}, s.n), h('small', { class: 'muted', title: 'Nome em inglês (SRD)' }, s.en)),
    h('div', { class: 'spell-meta' }, cap(spellMeta(s))),
    h('dl', { class: 'spell-stats' },
      h('dt', {}, 'Tempo de conjuração'), h('dd', {}, s.t),
      h('dt', {}, 'Alcance'), h('dd', {}, s.a),
      h('dt', {}, 'Componentes'), h('dd', {}, s.c + (s.m ? ` (${s.m.replace(/\.$/, '')})` : '')),
      h('dt', {}, 'Duração'), h('dd', {}, s.du)),
    h('div', { class: 'spell-text' }, richText(s.d)),
    s.h ? h('div', { class: 'spell-text higher' }, h('b', {}, 'Em níveis superiores. '), richText(s.h)) : null,
    h('div', { class: 'spell-classes muted small' }, 'Listas: ', s.cl.map((k) => SPELL_LIST_LABEL[k] || k).join(', ')),
    extra || null);
}
export async function openSpellById(id, name) {
  let s = null;
  try { s = (await loadSpells()).find((x) => x.id === id); } catch { return; }
  if (!s) return toast(`"${name || id}" não está na Biblioteca (magia escrita à mão)`, 'info');
  openModal(s.n, spellCard(s), { wide: true });
}

async function addSpell(c, s) {
  const cur = app.char(c.id);
  const book = cur.spellbook || [];
  if (book.some((x) => x.id === s.id)) return toast(`${s.n} já está na ficha de ${c.name}`, 'info');
  const r = await emit('character:update', { id: c.id, patch: { spellbook: [...book, { id: s.id, name: s.n, level: s.l, prep: false }] } });
  if (r) toast(`${s.n} adicionada à ficha de ${c.name}`, 'ok');
  return r;
}

// Navegador de magias. `fixed` = personagem fixo (aberto pela ficha).
export function spellBrowser({ fixed = null } = {}) {
  const root = h('div', { class: 'lib stack' });
  const st = { q: '', level: '', cls: '', school: '', mine: true, ritual: false, conc: false, limit: 50, open: new Set() };
  let all = null;
  const search = h('input', { type: 'search', placeholder: 'Buscar magia (português ou inglês)…', 'aria-label': 'Buscar magia', oninput: () => { st.q = search.value; st.limit = 50; drawList(); } });
  const top = h('div', { class: 'row gap wrap' });
  const head = h('div', { class: 'stack' });
  const list = h('div', { class: 'lib-list' });
  const target = () => (fixed ? app.char(fixed) : currentTarget());

  function filters() {
    const c = target();
    const lists = c ? spellLists(c) : [];
    const levels = h('div', { class: 'recipients lib-levels' },
      ['', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => h('button', {
        class: 'pill' + (String(st.level) === String(l) ? ' on' : ''),
        onclick: () => { st.level = st.level === String(l) ? '' : String(l); st.limit = 50; draw(); },
      }, l === '' ? 'Todos' : l === 0 ? 'Truques' : `${l}º`)));
    const clsSel = h('select', { 'aria-label': 'Lista de classe', onchange: (e) => { st.cls = e.target.value; st.limit = 50; draw(); } },
      h('option', { value: '' }, 'Todas as classes'),
      SPELL_LISTS.map(([k, label]) => h('option', { value: k, selected: st.cls === k }, label)));
    const schoolSel = h('select', { 'aria-label': 'Escola', onchange: (e) => { st.school = e.target.value; draw(); } },
      h('option', { value: '' }, 'Todas as escolas'),
      SCHOOLS.map((k) => h('option', { value: k, selected: st.school === k }, cap(k))));
    const check = (key, label, title) => h('label', { class: 'row check', title },
      h('input', { type: 'checkbox', checked: st[key], onchange: (e) => { st[key] = e.target.checked; st.limit = 50; draw(); } }), label);
    let note = null;
    if (c && st.mine) {
      note = lists.length
        ? h('p', { class: 'muted small' }, 'Mostrando o que ', h('b', {}, c.name), ' conjura: ',
          lists.map((l) => `${l.label} até ${l.max ? `${l.max}º círculo` : 'só truques'}${l.from !== l.label ? ` (${l.from})` : ''}${l.arcanum ? ' — 6º+ pela Arcana Mística' : ''}`).join(' · '),
          '. Desmarque "Só as que pode conjurar" para ver as outras.')
        : h('p', { class: 'muted small' }, c.name, ' não tem classe conjuradora na ficha (ou ainda não chegou no nível de magias); mostrando todas.');
    }
    setKids(top,
      fixed ? h('span', { class: 'lib-target' }, 'Para ', h('b', {}, c?.name || '?')) : targetSelect(draw, { noneLabel: '— só consultar —' }),
      c ? check('mine', 'Só as que pode conjurar', 'Pelas classes e níveis da ficha (multiclasse incluída)') : null);
    setKids(head,
      levels,
      h('div', { class: 'row gap wrap' }, clsSel, schoolSel,
        check('ritual', 'Ritual', 'Só magias que podem ser conjuradas como ritual'),
        check('conc', 'Concentração', 'Só magias de concentração')),
      note);
  }

  function rows() {
    const c = target();
    const lists = c ? spellLists(c) : [];
    const useMine = c && st.mine && lists.length;
    const q = plain(st.q).trim();
    const book = new Set((c?.spellbook || []).map((x) => x.id));
    const shown = all.filter((s) => (st.level === '' || s.l === Number(st.level))
      && (!st.cls || s.cl.includes(st.cls))
      && (!st.school || s.e === st.school)
      && (!st.ritual || s.ri) && (!st.conc || s.co)
      && (!useMine || spellAccess(s, lists))
      && (!q || q.split(/\s+/).every((w) => plain(s.n).includes(w) || plain(s.en).includes(w))));
    const item = (s) => {
      const det = h('details', { class: 'lib-item', open: st.open.has(s.id) },
        h('summary', {},
          h('span', { class: 'grow' }, h('b', {}, s.n), h('small', { class: 'muted' }, ` ${s.en}`)),
          s.co ? h('span', { class: 'tag cat', title: 'Concentração' }, 'C') : null,
          s.ri ? h('span', { class: 'tag cat', title: 'Ritual' }, 'R') : null,
          book.has(s.id) ? h('span', { class: 'tag cat on', title: 'Já está na ficha' }, '✓') : null,
          h('span', { class: 'lib-sub muted small' }, s.l === 0 ? 'truque' : `${s.l}º`)),
        null);
      det.addEventListener('toggle', () => {
        if (det.open) {
          st.open.add(s.id);
          if (det.children.length < 2) det.append(body(s));
        } else st.open.delete(s.id);
      });
      if (det.open) det.append(body(s));
      return det;
    };
    const body = (s) => {
      const tc = target();
      const has = (tc?.spellbook || []).some((x) => x.id === s.id);
      const access = tc ? spellAccess(s, spellLists(tc)) : null;
      return spellCard(s, tc ? h('div', { class: 'row gap wrap' },
        has ? h('span', { class: 'muted small' }, `✓ Já está na ficha de ${tc.name}`)
            : h('button', { class: 'btn sm primary', onclick: () => addSpell(tc, s) }, `＋ Adicionar à ficha de ${tc.name}`),
        !access && !has ? h('span', { class: 'muted small' }, '(fora das listas/círculos da ficha — o mestre decide)') : null) : null);
    };
    return [
      h('p', { class: 'muted small' }, `${shown.length} magia${shown.length === 1 ? '' : 's'}`),
      shown.slice(0, st.limit).map(item),
      shown.length > st.limit ? h('button', { class: 'btn sm', onclick: () => { st.limit += 100; draw(); } }, `Mostrar mais (${shown.length - st.limit})`) : null,
    ];
  }

  function drawList() { if (all) setKids(list, rows()); }
  function draw() {
    if (!all) return;
    filters();
    drawList();
  }
  setKids(root, h('p', { class: 'muted' }, 'Carregando magias…'));
  loadSpells().then((s) => { all = s; setKids(root, top, search, head, list); draw(); }).catch(() => setKids(root, h('p', { class: 'muted' }, 'Não deu para carregar as magias.')));
  live(root, () => JSON.stringify([fixed, targetKey()]), draw);
  return root;
}

export function openSpellPicker(charId) {
  const b = spellBrowser({ fixed: charId });
  const m = openModal('Procurar magias', b, { wide: true });
  return m;
}

// ------------------------------------------------------------------ itens
const ITEM_CATS = [
  ['armas', 'Armas', (x) => x.cat.startsWith('Armas')],
  ['armaduras', 'Armaduras', (x) => x.cat === 'Armaduras'],
  ['aventura', 'Equipamento', (x) => ['Equipamento de aventura', 'Munição', 'Focos de conjuração'].includes(x.cat)],
  ['ferramentas', 'Ferramentas', (x) => x.cat.startsWith('Ferramentas') || x.cat === 'Instrumentos musicais' || x.cat === 'Kits de jogo'],
  ['pacotes', 'Pacotes', (x) => x.cat === 'Pacotes'],
  ['montarias', 'Montarias e veículos', (x) => x.mount],
];
const PICKS = {
  weapon: (x) => x.cat.startsWith('Armas') && x.id !== 'net',
  sword: (x) => ['longsword', 'shortsword', 'greatsword', 'scimitar', 'rapier'].includes(x.id),
  'sword-slash': (x) => ['longsword', 'greatsword', 'scimitar'].includes(x.id),
  axe: (x) => ['handaxe', 'battleaxe', 'greataxe'].includes(x.id),
  'axe-sword': (x) => ['handaxe', 'battleaxe', 'greataxe', 'longsword', 'shortsword', 'greatsword', 'scimitar', 'rapier'].includes(x.id),
  ammo: (x) => x.cat === 'Munição',
  armor: (x) => x.k === 'armadura',
  'armor-mh': (x) => x.k === 'armadura' && x.at !== 'leve',
  'armor-mh-nohide': (x) => x.k === 'armadura' && x.at !== 'leve' && x.id !== 'hide-armor',
};

function itemStats(x) {
  const parts = [];
  if (x.dmg) parts.push(`${x.dmg}${x.dmg2 ? ` (${x.dmg2} com as duas mãos)` : ''} ${x.dt}`);
  if (x.k === 'armadura') parts.push(`CA ${x.ac}${x.at === 'leve' ? ' + Des' : x.at === 'media' ? ' + Des (máx. 2)' : ''}`);
  if (x.k === 'escudo') parts.push(`CA +${x.ac}`);
  if (x.str) parts.push(`For ${x.str}`);
  if (x.stealth) parts.push('desvantagem em Furtividade');
  if (x.speed) parts.push(`deslocamento ${x.speed}`);
  if (x.cap) parts.push(`carga ${x.cap}`);
  return parts.join(' · ');
}

// Item do SRD → item da ficha
function toSheetItem(x, qty = 1) {
  const it = {
    srd: x.id, name: x.n, kind: x.k || 'outro', qty: (x.qty || 1) * qty,
    weight: x.mount ? 0 : x.qty ? Math.round((x.kg / x.qty) * 1000) / 1000 : x.kg,
    desc: [x.props ? cap(x.props) + '.' : '', x.d || '', x.mount ? 'Não conta no peso carregado.' : '', x.cost ? `Preço: ${x.cost}.` : ''].filter(Boolean).join('\n'),
  };
  if (x.dmg) Object.assign(it, { dmg: x.dmg, dmg2: x.dmg2 || '', dmgType: x.dt, hands: x.hands, finesse: !!x.fin, light: !!x.light, ranged: !!x.rng });
  if (x.k === 'armadura') Object.assign(it, { armorType: x.at, acBase: x.ac });
  if (x.k === 'escudo') it.acBase = x.ac;
  return it;
}
function magicToSheetItem(m, base) {
  const it = base ? toSheetItem(base) : { kind: m.k, weight: 0, qty: 1 };
  const descEn = (m.d || []).join('\n\n');
  Object.assign(it, {
    srd: m.id,
    name: base && (m.pick || m.n.includes('+')) && !m.n.includes(base.n) ? `${m.n} (${base.n.toLowerCase()})` : m.n,
    rarity: RARITIES.some(([k]) => k === m.r) ? m.r : 'comum',
    attune: !!m.sint, magic: m.magic || 0, acBonus: m.acb || 0,
    desc: `${m.tipo}\n\n${descEn}\n\n(Texto do SRD em inglês: ${m.en}.)`.slice(0, 8000),
  });
  if (base && m.k === 'municao') it.kind = 'municao';
  return it;
}

async function addItems(c, items, label) {
  const r = await emit('item:addMany', { charId: c.id, items, label });
  if (r) toast(`${label} → mochila de ${c.name}`, 'ok');
  return r;
}

export function itemBrowser() {
  const root = h('div', { class: 'lib stack' });
  const st = { q: '', cat: '', rarity: '', magic: false, limit: 60, open: new Set() };
  let data = null;
  const search = h('input', { type: 'search', placeholder: 'Buscar item (português ou inglês)…', 'aria-label': 'Buscar item', oninput: () => { st.q = search.value; st.limit = 60; drawList(); } });
  const top = h('div', { class: 'row gap wrap' });
  const head = h('div', { class: 'stack' });
  const list = h('div', { class: 'lib-list' });

  function filters() {
    const gm = app.isGM;
    if (!gm) st.magic = false;
    setKids(top, targetSelect(draw, { noneLabel: '— só consultar —' }));
    setKids(head,
      h('div', { class: 'recipients' },
        h('button', { class: 'pill' + (!st.magic && !st.cat ? ' on' : ''), onclick: () => { st.magic = false; st.cat = ''; draw(); } }, 'Tudo'),
        ITEM_CATS.map(([k, label]) => h('button', {
          class: 'pill' + (!st.magic && st.cat === k ? ' on' : ''), onclick: () => { st.magic = false; st.cat = st.cat === k ? '' : k; st.limit = 60; draw(); },
        }, label)),
        gm ? h('button', { class: 'pill magic' + (st.magic ? ' on' : ''), title: 'Só você vê', onclick: () => { st.magic = !st.magic; st.limit = 60; draw(); } }, '✨ Itens mágicos 🔒') : null),
      st.magic ? h('div', { class: 'recipients' },
        h('button', { class: 'pill' + (!st.rarity ? ' on' : ''), onclick: () => { st.rarity = ''; draw(); } }, 'Todas as raridades'),
        RARITIES.map(([k, label, color]) => h('button', {
          class: 'pill' + (st.rarity === k ? ' on' : ''), style: { '--c': color }, onclick: () => { st.rarity = st.rarity === k ? '' : k; draw(); },
        }, label))) : null,
      st.magic ? h('p', { class: 'muted small' }, 'Os jogadores não veem esta lista. O nome está em português; a descrição ainda está no original em inglês do SRD.') : null);
  }

  function mundaneBody(x) {
    const c = currentTarget();
    const pack = x.pack ? x.pack.map(([id, q]) => [data.itens.find((y) => y.id === id), q]).filter(([y]) => y) : null;
    const add = async (qty) => {
      if (pack) await addItems(c, pack.map(([y, q]) => toSheetItem(y, q)), x.n);
      else await addItems(c, [toSheetItem(x, qty)], qty > 1 ? `${x.n} ×${qty}` : x.n);
    };
    const qtyIn = h('input', { type: 'number', class: 'num', min: '1', max: '99', value: '1', 'aria-label': 'Quantidade' });
    return h('div', { class: 'lib-body' },
      h('div', { class: 'row gap wrap lib-stats' },
        itemFace(toSheetItem(x)),
        h('div', { class: 'stack' },
          h('span', {}, h('b', {}, x.cost || '—'), ' · ', x.mount ? 'não vai na mochila' : fmtKg(x.kg)),
          itemStats(x) ? h('span', { class: 'small' }, itemStats(x)) : null,
          x.props ? h('span', { class: 'small muted' }, cap(x.props)) : null)),
      x.d ? h('p', { class: 'small' }, x.d) : null,
      c ? h('div', { class: 'row gap wrap' },
        pack ? null : h('label', { class: 'mini' }, 'Qtd.', qtyIn),
        h('button', { class: 'btn sm primary', onclick: () => add(pack ? 1 : Math.max(1, Math.min(99, Number(qtyIn.value) || 1))) },
          pack ? `＋ Pôr o conteúdo na mochila de ${c.name}` : x.mount ? `＋ Adicionar às posses de ${c.name}` : `＋ Pôr na mochila de ${c.name}`))
        : h('p', { class: 'muted small' }, app.isGM ? 'Escolha um personagem em "Para" para entregar o item.' : 'Você ainda não tem personagem.'));
  }

  function magicBody(m) {
    const c = currentTarget();
    const bases = m.pick ? data.itens.filter(PICKS[m.pick] || (() => false)) : [];
    const fixedBase = m.base ? data.itens.find((y) => y.id === m.base) : null;
    const baseSel = bases.length ? h('select', { 'aria-label': 'Item base' }, bases.map((y) => h('option', { value: y.id }, y.n))) : null;
    const give = () => {
      const base = fixedBase || (baseSel ? data.itens.find((y) => y.id === baseSel.value) : null);
      const it = magicToSheetItem(m, base);
      addItems(c, [it], it.name);
    };
    return h('div', { class: 'lib-body' },
      h('div', { class: 'row gap wrap lib-stats' },
        itemFace({ kind: m.k, rarity: RARITIES.some(([k]) => k === m.r) ? m.r : 'comum', name: m.n }),
        h('div', { class: 'stack' },
          h('i', {}, m.tipo),
          fixedBase ? h('span', { class: 'small muted' }, `Base: ${fixedBase.n} (${itemStats(fixedBase)})`) : null)),
      h('div', { class: 'lib-en' }, (m.d || []).map((p) => h('p', { class: 'small' }, p))),
      c ? h('div', { class: 'row gap wrap' },
        baseSel ? h('label', { class: 'mini' }, 'Base', baseSel) : null,
        h('button', { class: 'btn sm primary', onclick: give }, `🎁 Dar a ${c.name}`))
        : h('p', { class: 'muted small' }, 'Escolha um personagem em "Para" para dar o item.'));
  }

  function rows() {
    const q = plain(st.q).trim();
    const words = q ? q.split(/\s+/) : [];
    const hit = (x) => !words.length || words.every((w) => plain(x.n).includes(w) || plain(x.en).includes(w));
    let shown;
    if (st.magic) {
      shown = data.magicos.filter((m) => (!st.rarity || m.r === st.rarity) && hit(m));
    } else {
      const f = ITEM_CATS.find(([k]) => k === st.cat)?.[2];
      shown = data.itens.filter((x) => (!f || f(x)) && hit(x));
    }
    const item = (x) => {
      const det = h('details', { class: 'lib-item', open: st.open.has(x.id) },
        h('summary', {},
          h('span', { class: 'grow' }, h('b', {}, x.n), h('small', { class: 'muted' }, ` ${x.en}`)),
          st.magic
            ? h('span', { class: 'tag cat', style: { color: RARITY_COLOR[x.r] || 'var(--muted)' } }, RARITY_LABEL[x.r] || 'varia')
            : h('span', { class: 'lib-sub muted small' }, [x.cost, x.mount ? '' : fmtKg(x.kg)].filter(Boolean).join(' · '))));
      const make = () => (st.magic ? magicBody(x) : mundaneBody(x));
      det.addEventListener('toggle', () => {
        if (det.open) { st.open.add(x.id); if (det.children.length < 2) det.append(make()); } else st.open.delete(x.id);
      });
      if (det.open) det.append(make());
      return det;
    };
    // agrupa por categoria quando não há busca nem filtro (fica mais fácil de achar)
    return [
      h('p', { class: 'muted small' }, `${shown.length} ${st.magic ? (shown.length === 1 ? 'item mágico' : 'itens mágicos') : (shown.length === 1 ? 'item' : 'itens')}`),
      shown.slice(0, st.limit).map(item),
      shown.length > st.limit ? h('button', { class: 'btn sm', onclick: () => { st.limit += 120; draw(); } }, `Mostrar mais (${shown.length - st.limit})`) : null,
    ];
  }

  function drawList() { if (data) setKids(list, rows()); }
  function draw() {
    if (!data) return;
    filters();
    drawList();
  }
  setKids(root, h('p', { class: 'muted' }, 'Carregando itens…'));
  loadItems().then((d) => { data = d; setKids(root, top, search, head, list); draw(); }).catch(() => setKids(root, h('p', { class: 'muted' }, 'Não deu para carregar os itens.')));
  live(root, () => JSON.stringify([app.isGM, targets().map((c) => [c.id, c.name])]), draw);
  return root;
}

export const LIB_SOURCE = 'Magias e itens: System Reference Document 5.1 (Wizards of the Coast), licença CC-BY-4.0 — tradução da Tábula.';
