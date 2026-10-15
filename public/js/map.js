// Mapa: imagem de fundo, grade, tokens redondos, zoom/arrasto, sinalização (ping).
import { app, emit } from './core.js';
import { $, h, initials, isEditingIn, chooseAndUpload, setKids } from './util.js';

const vp = $('#map-viewport');
const layer = $('#map-layer');
const img = $('#map-img');
const grid = $('#map-grid');
const tokensEl = $('#map-tokens');
const fx = $('#map-fx');
const panel = $('#token-panel');
const strip = $('#init-strip');

const BLANK = { w: 2100, h: 1400 }; // tamanho da "mesa vazia" quando a cena não tem imagem
const view = { x: 0, y: 0, s: 1 };
let scene = null;
let imgSize = { w: 0, h: 0 };
let needsFit = true;
let selectedId = null;
let panelKey = '';
const els = new Map();
const pointers = new Map();
let drag = null;
let pan = null;
let pinch = null;
let lastTap = { t: 0, x: 0, y: 0 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function applyView() {
  layer.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  layer.style.setProperty('--inv', String(1 / view.s));
}
function toMap(cx, cy) {
  const r = vp.getBoundingClientRect();
  return { x: (cx - r.left - view.x) / view.s, y: (cy - r.top - view.y) / view.s };
}
export function fit() {
  const r = vp.getBoundingClientRect();
  if (!r.width || !r.height || !imgSize.w) { needsFit = true; return; }
  view.s = clamp(Math.min(r.width / imgSize.w, r.height / imgSize.h) * 0.96, 0.05, 6);
  view.x = (r.width - imgSize.w * view.s) / 2;
  view.y = (r.height - imgSize.h * view.s) / 2;
  applyView();
  needsFit = false;
}
function zoomAt(factor, cx, cy) {
  const r = vp.getBoundingClientRect();
  const px = cx - r.left, py = cy - r.top;
  const ns = clamp(view.s * factor, 0.05, 6);
  const k = ns / view.s;
  view.x = px - (px - view.x) * k;
  view.y = py - (py - view.y) * k;
  view.s = ns;
  applyView();
}
export function viewCenter() {
  const r = vp.getBoundingClientRect();
  return toMap(r.left + r.width / 2, r.top + r.height / 2);
}
export function currentSceneId() { return scene?.id || null; }

function sizeLayer() {
  layer.style.width = imgSize.w + 'px';
  layer.style.height = imgSize.h + 'px';
}

img.addEventListener('load', () => {
  imgSize = { w: img.naturalWidth, h: img.naturalHeight };
  sizeLayer();
  if (needsFit) fit();
});
img.addEventListener('error', () => {
  imgSize = { ...BLANK };
  sizeLayer();
  if (needsFit) fit();
});
new ResizeObserver(() => { if (needsFit) fit(); }).observe(vp);

// ------------------------------------------------------------------ render
export function renderMap(state) {
  const sc = state.scene;
  const empty = $('#map-empty');
  const label = $('#scene-name');
  label.textContent = sc ? sc.name : '';
  label.hidden = !sc;

  if (!sc) {
    scene = null;
    layer.hidden = true;
    empty.hidden = false;
    empty.textContent = app.isGM
      ? 'Nenhuma cena ainda. Abra a aba "Mestre" e crie uma cena com a imagem do mapa.'
      : 'Aguardando o mestre abrir uma cena…';
    clearTokens();
    renderPanel(state);
    renderInitStrip(state);
    return;
  }
  layer.hidden = false;
  empty.hidden = true;

  if (!scene || scene.id !== sc.id) {
    needsFit = true;
    selectedId = null;
    clearTokens();
  }
  scene = sc;

  if (sc.img) {
    if (img.getAttribute('src') !== sc.img) { img.hidden = false; img.src = sc.img; }
  } else {
    img.removeAttribute('src');
    img.hidden = true;
    imgSize = { ...BLANK };
    sizeLayer();
    if (needsFit) fit();
  }
  layer.classList.toggle('blank', !sc.img);

  const g = sc.gridSize;
  grid.hidden = !sc.showGrid;
  grid.style.backgroundSize = `${g}px ${g}px`;
  grid.style.backgroundPosition = `${sc.gridOffsetX}px ${sc.gridOffsetY}px`;

  renderTokens(state);
  renderPanel(state);
  renderInitStrip(state);
}

function clearTokens() {
  for (const el of els.values()) el.remove();
  els.clear();
}

function tokenInfo(t, state = app.state) {
  const c = t.characterId ? state.characters.find((x) => x.id === t.characterId) : null;
  const owner = c?.ownerId ? state.users.find((u) => u.id === c.ownerId) : null;
  return {
    c,
    name: c ? c.name : t.name,
    img: (c && c.img) || t.img,
    hp: c ? c.hp : t.hp,
    hpMax: c ? c.hpMax : t.hpMax,
    color: owner?.color || (t.hidden ? '#8a8796' : '#b0473e'),
    mine: !!c && c.ownerId === state.me.id,
  };
}
function canMove(t) {
  if (app.isGM) return true;
  const c = t.characterId && app.char(t.characterId);
  return !!c && c.ownerId === app.me.id;
}

function renderTokens(state) {
  const seen = new Set();
  const ini = state.initiative;
  const cur = ini.active ? ini.entries.find((e) => e.id === ini.currentId) : null;
  for (const t of scene.tokens) {
    seen.add(t.id);
    let el = els.get(t.id);
    if (!el) {
      el = h('div', { class: 'token', dataset: { id: t.id } },
        h('div', { class: 'token-face' }),
        h('div', { class: 'token-hp' }, h('i')),
        h('div', { class: 'token-name' }));
      els.set(t.id, el);
      tokensEl.append(el);
    }
    const info = tokenInfo(t, state);
    const px = t.size * scene.gridSize;
    if (!(drag && drag.id === t.id)) {
      el.style.left = t.x + 'px';
      el.style.top = t.y + 'px';
    }
    el.style.width = px + 'px';
    el.style.height = px + 'px';
    el.style.setProperty('--ring', info.color);
    el.style.setProperty('--label', Math.max(11, Math.min(28, px * 0.2)) + 'px');

    const face = el.querySelector('.token-face');
    if (face.dataset.img !== (info.img || '') || face.dataset.name !== info.name) {
      face.dataset.img = info.img || '';
      face.dataset.name = info.name;
      setKids(face, );
      if (info.img) {
        const im = h('img', { src: info.img, alt: '', draggable: 'false' });
        im.addEventListener('error', () => { im.remove(); face.textContent = initials(info.name); });
        face.append(im);
      } else {
        face.textContent = initials(info.name);
        face.style.fontSize = Math.max(10, px * 0.34) + 'px';
      }
    }
    el.querySelector('.token-name').textContent = info.name;

    // barra de vida: PJs para todos; NPCs só para o mestre
    const showHp = info.hpMax > 0 && (!!info.c || app.isGM);
    const bar = el.querySelector('.token-hp');
    bar.hidden = !showHp;
    if (showHp) {
      const ratio = clamp(info.hp / info.hpMax, 0, 1);
      bar.firstChild.style.width = ratio * 100 + '%';
      bar.dataset.level = ratio <= 0 ? 'down' : ratio <= 0.5 ? 'low' : 'ok';
    }
    const npcState = t.hpState || (!info.c && info.hpMax ? (info.hp <= 0 ? 'down' : info.hp <= info.hpMax / 2 ? 'bloodied' : 'ok') : 'ok');
    el.classList.toggle('bloodied', npcState === 'bloodied');
    el.classList.toggle('down', npcState === 'down' || (!!info.c && info.hpMax > 0 && info.hp <= 0));
    el.classList.toggle('movable', canMove(t));
    el.classList.toggle('mine', info.mine);
    el.classList.toggle('is-hidden', !!t.hidden);
    el.classList.toggle('selected', t.id === selectedId);
    el.classList.toggle('current', !!cur && (cur.tokenId === t.id || (!!t.characterId && cur.characterId === t.characterId)));
  }
  for (const [id, el] of els) {
    if (!seen.has(id)) {
      el.remove();
      els.delete(id);
      if (selectedId === id) selectedId = null;
    }
  }
}

function select(id) {
  selectedId = id;
  for (const [tid, el] of els) el.classList.toggle('selected', tid === id);
  renderPanel(app.state);
}

// ---------------------------------------------- painel do token (mestre)
function renderPanel(state) {
  const t = scene && selectedId ? scene.tokens.find((x) => x.id === selectedId) : null;
  if (!t || !app.isGM) {
    panel.hidden = true;
    panelKey = '';
    return;
  }
  const key = JSON.stringify([t, state.characters.find((c) => c.id === t.characterId)?.name]);
  if (key === panelKey && !panel.hidden) return;
  if (isEditingIn(panel) && panel.dataset.id === t.id) return;
  panelKey = key;
  panel.dataset.id = t.id;
  panel.hidden = false;

  const info = tokenInfo(t, state);
  const upd = (patch) => emit('token:update', { sceneId: scene.id, id: t.id, patch });
  const sizes = [[0.5, 'Minúsculo'], [1, 'Pequeno/Médio'], [2, 'Grande'], [3, 'Enorme'], [4, 'Imenso']];

  setKids(panel, 
    h('div', { class: 'tp-head' },
      t.characterId
        ? h('b', {}, info.name, h('span', { class: 'muted' }, ' · personagem'))
        : h('input', { value: t.name, 'aria-label': 'Nome do token', onchange: (e) => upd({ name: e.target.value }) }),
      h('button', { class: 'btn ghost sm', title: 'Fechar', onclick: () => select(null) }, '✕')),
    h('label', { class: 'row' }, 'Tamanho',
      h('select', { onchange: (e) => upd({ size: Number(e.target.value) }) },
        sizes.map(([v, l]) => h('option', { value: String(v), selected: t.size === v }, l)),
        sizes.some(([v]) => v === t.size) ? null : h('option', { value: String(t.size), selected: true }, `${t.size}×`))),
    t.characterId ? null : h('label', { class: 'row' }, 'PV',
      h('input', { type: 'number', class: 'num', value: String(t.hp), onchange: (e) => upd({ hp: Number(e.target.value) }) }),
      h('span', { class: 'muted' }, '/'),
      h('input', { type: 'number', class: 'num', value: String(t.hpMax), onchange: (e) => upd({ hpMax: Number(e.target.value) }) })),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn sm', onclick: () => upd({ hidden: !t.hidden }) }, t.hidden ? '👁 Revelar' : '🙈 Ocultar'),
      t.characterId ? null : h('button', {
        class: 'btn sm',
        onclick: async () => {
          const url = await chooseAndUpload();
          if (url) upd({ img: url });
        },
      }, 'Imagem'),
      h('button', {
        class: 'btn sm danger',
        onclick: () => { if (confirm(`Remover "${info.name}" do mapa?`)) emit('token:delete', { sceneId: scene.id, id: t.id }); },
      }, 'Remover')),
  );
}

// ------------------------------------------- faixa de iniciativa (no mapa)
function renderInitStrip(state) {
  const ini = state.initiative;
  if (!ini.active || !ini.entries.length) { strip.hidden = true; return; }
  strip.hidden = false;
  setKids(strip, 
    h('span', { class: 'round' }, `Rodada ${ini.round}`),
    ini.entries.map((e) => {
      const c = e.characterId ? app.char(e.characterId) : null;
      const im = (c && c.img) || e.img;
      const name = c ? c.name : e.name;
      return h('span', { class: 'ini-chip' + (e.id === ini.currentId ? ' current' : '') + (e.hidden ? ' is-hidden' : ''), title: `${name} (${e.value})` },
        im ? h('img', { src: im, alt: '' }) : h('span', { class: 'ini-init' }, initials(name)),
        h('span', { class: 'ini-name' }, name));
    }),
  );
  strip.querySelector('.current')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ---------------------------------------------------------- eventos remotos
export function onTokenMoved(m) {
  if (!scene || m.sceneId !== scene.id) return;
  const t = scene.tokens.find((x) => x.id === m.id);
  if (!t) return;
  t.x = m.x;
  t.y = m.y;
  if (drag && drag.id === m.id) return;
  const el = els.get(m.id);
  if (el) { el.style.left = m.x + 'px'; el.style.top = m.y + 'px'; }
}

export function showPing(p) {
  if (!scene) return;
  const el = h('div', { class: 'ping', style: { left: p.x + 'px', top: p.y + 'px', '--c': p.color } },
    h('i'), h('i'), h('span', { class: 'ping-label' }, p.name));
  fx.append(el);
  setTimeout(() => el.remove(), 2200);
}

// ------------------------------------------------------- interação local
function snap(x, y, size) {
  if (!scene.snap) return { x, y };
  const g = scene.gridSize;
  const unit = size < 1 ? g / 2 : g;
  return {
    x: Math.round((x - scene.gridOffsetX) / unit) * unit + scene.gridOffsetX,
    y: Math.round((y - scene.gridOffsetY) / unit) * unit + scene.gridOffsetY,
  };
}

async function commitMove(t, x, y, el) {
  const res = await emit('token:move', { sceneId: scene.id, id: t.id, x, y });
  if (!res) { el.style.left = t.x + 'px'; el.style.top = t.y + 'px'; return; }
  t.x = x;
  t.y = y;
}

function startPinch() {
  const [a, b] = [...pointers.values()];
  pinch = {
    d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
    s: view.s, vx: view.x, vy: view.y,
  };
}

vp.addEventListener('pointerdown', (e) => {
  if (!scene) return;
  vp.focus({ preventScroll: true });
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { vp.setPointerCapture(e.pointerId); } catch { /* ok */ }

  if (pointers.size === 2) {
    if (drag) { endDrag(); }
    pan = null;
    startPinch();
    return;
  }
  if (pointers.size > 2) return;

  const tokEl = e.target.closest('.token');
  const t = tokEl && scene.tokens.find((x) => x.id === tokEl.dataset.id);
  if (t && e.button === 0) {
    select(t.id);
    if (canMove(t)) {
      const p = toMap(e.clientX, e.clientY);
      drag = { id: t.id, t, el: tokEl, dx: p.x - t.x, dy: p.y - t.y, x: t.x, y: t.y, sx: e.clientX, sy: e.clientY, moved: false, last: 0 };
      tokEl.classList.add('dragging');
      return;
    }
  }
  pan = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
});

vp.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const ns = clamp(pinch.s * (d / pinch.d), 0.05, 6);
    const r = vp.getBoundingClientRect();
    const px = pinch.mx - r.left, py = pinch.my - r.top;
    const k = ns / pinch.s;
    view.x = px - (px - pinch.vx) * k + (mx - pinch.mx);
    view.y = py - (py - pinch.vy) * k + (my - pinch.my);
    view.s = ns;
    applyView();
    return;
  }
  if (drag) {
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
    drag.moved = true;
    const p = toMap(e.clientX, e.clientY);
    drag.x = p.x - drag.dx;
    drag.y = p.y - drag.dy;
    drag.el.style.left = drag.x + 'px';
    drag.el.style.top = drag.y + 'px';
    const now = performance.now();
    if (now - drag.last > 70) {
      drag.last = now;
      app.socket.emit('token:move', { sceneId: scene.id, id: drag.id, x: drag.x, y: drag.y }, () => {});
    }
    return;
  }
  if (pan) {
    const dx = e.clientX - pan.sx, dy = e.clientY - pan.sy;
    if (!pan.moved && Math.hypot(dx, dy) < 5) return;
    pan.moved = true;
    view.x = pan.vx + dx;
    view.y = pan.vy + dy;
    applyView();
  }
});

function endDrag() {
  const d = drag;
  drag = null;
  d.el.classList.remove('dragging');
  if (!d.moved) return;
  const s = snap(d.x, d.y, d.t.size);
  d.el.style.left = s.x + 'px';
  d.el.style.top = s.y + 'px';
  commitMove(d.t, s.x, s.y, d.el);
}

function pointerEnd(e, cancelled) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pinch) {
    if (pointers.size < 2) pinch = null;
    pan = null;
    return;
  }
  if (drag) { endDrag(); return; }
  if (pan) {
    const wasTap = !pan.moved && !cancelled;
    pan = null;
    if (!wasTap) return;
    const now = performance.now();
    if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      lastTap.t = 0;
      const p = toMap(e.clientX, e.clientY);
      app.socket.emit('ping', p, () => {});
    } else {
      lastTap = { t: now, x: e.clientX, y: e.clientY };
      if (!e.target.closest('.token')) select(null);
    }
  }
}
vp.addEventListener('pointerup', (e) => pointerEnd(e, false));
vp.addEventListener('pointercancel', (e) => pointerEnd(e, true));
vp.addEventListener('contextmenu', (e) => e.preventDefault());

vp.addEventListener('wheel', (e) => {
  e.preventDefault();
  const k = e.ctrlKey ? 0.01 : 0.0015;
  zoomAt(Math.exp(-e.deltaY * k), e.clientX, e.clientY);
}, { passive: false });

vp.addEventListener('keydown', (e) => {
  if (!scene || !selectedId) return;
  const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const d = dirs[e.key];
  const t = scene.tokens.find((x) => x.id === selectedId);
  if (!d || !t || !canMove(t)) return;
  e.preventDefault();
  const g = scene.gridSize * (t.size < 1 ? 0.5 : 1);
  const el = els.get(t.id);
  const nx = t.x + d[0] * g, ny = t.y + d[1] * g;
  el.style.left = nx + 'px';
  el.style.top = ny + 'px';
  commitMove(t, nx, ny, el);
});

$('#zoom-in').addEventListener('click', () => { const r = vp.getBoundingClientRect(); zoomAt(1.25, r.left + r.width / 2, r.top + r.height / 2); });
$('#zoom-out').addEventListener('click', () => { const r = vp.getBoundingClientRect(); zoomAt(0.8, r.left + r.width / 2, r.top + r.height / 2); });
$('#zoom-fit').addEventListener('click', fit);

// Centraliza no token do jogador (usado pelo botão da ficha)
export function focusToken(characterId) {
  const t = scene?.tokens.find((x) => x.characterId === characterId);
  if (!t) return false;
  const r = vp.getBoundingClientRect();
  const half = (t.size * scene.gridSize) / 2;
  view.x = r.width / 2 - (t.x + half) * view.s;
  view.y = r.height / 2 - (t.y + half) * view.s;
  applyView();
  select(t.id);
  return true;
}
