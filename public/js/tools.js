// Ferramentas do mapa: régua, áreas de magia, desenhos, borracha e névoa de guerra.
import { app, emit } from './core.js';
import { $, h, setKids, toast } from './util.js';
import { getScene, mapSize, setToolHooks } from './map.js';

const NS = 'http://www.w3.org/2000/svg';
const drawSvg = $('#map-draw');
const liveSvg = $('#map-live');
const fogCanvas = $('#map-fog');
const bar = $('#map-tools');
const fogBar = $('#fog-tools');

let tool = 'move';
let fogMode = 'reveal-rect';     // reveal-rect | hide-rect | reveal-circle
let action = null;               // o que está sendo feito com o dedo/mouse agora
let lastSend = 0;
const others = new Map();        // réguas dos outros jogadores (userId -> elementos)

const TOOLS = [
  ['move', '✋', 'Mover / selecionar'],
  ['ruler', '📏', 'Régua (arraste para medir)'],
  ['circle', '◯', 'Esfera / círculo (raio)'],
  ['cone', '◣', 'Cone'],
  ['line', '━', 'Linha (1,5 m de largura)'],
  ['square', '▢', 'Cubo / quadrado'],
  ['free', '✏', 'Desenho livre'],
  ['arrow', '➜', 'Seta'],
  ['eraser', '🧽', 'Apagar: toque num desenho'],
  ['fog', '🌫', 'Névoa de guerra (mestre)'],
];

function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  for (const k of kids) if (k) el.append(k);
  return el;
}

// ------------------------------------------------------------ geometria
const g = () => getScene()?.gridSize || 70;
const meters = (px) => {
  const sq = Math.max(0, Math.round(px / g()));
  return `${(sq * 1.5).toLocaleString('pt-BR')} m`;
};
function snapPoint(p, toCenter) {
  const sc = getScene();
  if (!sc?.snap) return p;
  const s = sc.gridSize;
  const off = toCenter ? s / 2 : 0;
  return {
    x: Math.round((p.x - sc.gridOffsetX - off) / s) * s + sc.gridOffsetX + off,
    y: Math.round((p.y - sc.gridOffsetY - off) / s) * s + sc.gridOffsetY + off,
  };
}
// Distância em quadrados como no Livro do Jogador: cada passo, inclusive diagonal, conta 1 quadrado
function squaresBetween(a, b) {
  return Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / g());
}
// Tamanho do molde arredondado para quadrados inteiros (mínimo 1)
function templateLen(a, b) {
  return Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / g())) * g();
}

function shapeFor(kind, pts, color, opts = {}) {
  const [x1, y1, x2, y2] = pts;
  const style = { stroke: color, fill: color, 'fill-opacity': kind === 'free' || kind === 'arrow' ? 0 : 0.22, 'stroke-width': 3, 'vector-effect': 'non-scaling-stroke' };
  const grp = svg('g', { class: 'shape', 'data-id': opts.id || '' });
  let label = null, lx = x1, ly = y1;
  if (kind === 'circle') {
    const r = templateLen({ x: x1, y: y1 }, { x: x2, y: y2 });
    grp.append(svg('circle', { cx: x1, cy: y1, r, ...style }));
    label = `raio ${meters(r)}`; ly = y1;
  } else if (kind === 'cone') {
    const L = templateLen({ x: x1, y: y1 }, { x: x2, y: y2 });
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const ex = x1 + Math.cos(ang) * L, ey = y1 + Math.sin(ang) * L;
    const px = -Math.sin(ang) * L / 2, py = Math.cos(ang) * L / 2;     // cone de 5e: largura no fim = comprimento
    grp.append(svg('polygon', { points: `${x1},${y1} ${ex + px},${ey + py} ${ex - px},${ey - py}`, ...style }));
    label = `cone ${meters(L)}`; lx = x1 + Math.cos(ang) * L * 0.6; ly = y1 + Math.sin(ang) * L * 0.6;
  } else if (kind === 'line') {
    const L = templateLen({ x: x1, y: y1 }, { x: x2, y: y2 });
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const w = g() / 2;
    const ex = x1 + Math.cos(ang) * L, ey = y1 + Math.sin(ang) * L;
    const px = -Math.sin(ang) * w, py = Math.cos(ang) * w;
    grp.append(svg('polygon', { points: `${x1 + px},${y1 + py} ${ex + px},${ey + py} ${ex - px},${ey - py} ${x1 - px},${y1 - py}`, ...style }));
    label = `linha ${meters(L)}`; lx = (x1 + ex) / 2; ly = (y1 + ey) / 2;
  } else if (kind === 'square') {
    const side = Math.max(1, Math.round(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / g())) * g();
    const sx = x2 >= x1 ? x1 : x1 - side, sy = y2 >= y1 ? y1 : y1 - side;
    grp.append(svg('rect', { x: sx, y: sy, width: side, height: side, ...style }));
    label = `cubo ${meters(side)}`; lx = sx + side / 2; ly = sy + side / 2;
  } else if (kind === 'free') {
    const p = [];
    for (let i = 0; i < pts.length; i += 2) p.push(`${pts[i]},${pts[i + 1]}`);
    grp.append(svg('polyline', { points: p.join(' '), ...style, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': 4 }));
  } else if (kind === 'arrow') {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const head = g() * 0.45;
    const hx = x2 - Math.cos(ang) * head, hy = y2 - Math.sin(ang) * head;
    grp.append(
      svg('line', { x1, y1, x2: hx, y2: hy, ...style, 'stroke-width': 5, 'stroke-linecap': 'round' }),
      svg('polygon', { points: `${x2},${y2} ${hx - Math.sin(ang) * head * 0.6},${hy + Math.cos(ang) * head * 0.6} ${hx + Math.sin(ang) * head * 0.6},${hy - Math.cos(ang) * head * 0.6}`, fill: color, stroke: color, 'fill-opacity': 1 }),
    );
  }
  if (label && opts.label !== false) grp.append(svg('text', { x: lx, y: ly, class: 'shape-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, document.createTextNode(label)));
  return grp;
}

function rulerShape(a, b, color, name) {
  const sq = squaresBetween(a, b);
  const grp = svg('g', { class: 'ruler' });
  grp.append(
    svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#000', 'stroke-width': 7, 'stroke-opacity': 0.5, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round' }),
    svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: color, 'stroke-width': 3, 'stroke-dasharray': '10 6', 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round' }),
    svg('circle', { cx: a.x, cy: a.y, r: 5, fill: color, class: 'dot' }),
    svg('circle', { cx: b.x, cy: b.y, r: 5, fill: color, class: 'dot' }),
    svg('text', { x: b.x, y: b.y, class: 'ruler-label', 'text-anchor': 'middle' },
      document.createTextNode(`${(sq * 1.5).toLocaleString('pt-BR')} m · ${sq} quadr.${name ? ` · ${name}` : ''}`)),
  );
  return grp;
}

// ------------------------------------------------------------ névoa
function renderFog(sc) {
  const fog = sc?.fog;
  if (!fog || !fog.enabled) { fogCanvas.hidden = true; return; }
  const { w, h: hh } = mapSize();
  const k = Math.min(1, 2048 / Math.max(w, hh));
  const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(hh * k));
  if (fogCanvas.width !== cw || fogCanvas.height !== ch) { fogCanvas.width = cw; fogCanvas.height = ch; }
  const ctx = fogCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#07060a';
  ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  for (const o of fog.ops) {
    ctx.globalCompositeOperation = o.op === 'reveal' ? 'destination-out' : 'source-over';
    ctx.beginPath();
    if (o.shape === 'all') ctx.rect(-10, -10, w + 20, hh + 20);
    else if (o.shape === 'rect') ctx.rect(o.x, o.y, o.w, o.h);
    else if (o.shape === 'circle') ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }
  fogCanvas.hidden = false;
  fogCanvas.classList.toggle('gm', app.isGM);
}

// ------------------------------------------------------------ desenhos salvos
let drawKey = '';
function renderDrawings(sc) {
  const list = sc?.drawings || [];
  const { w, h: hh } = mapSize();
  const key = JSON.stringify([sc?.id, list.map((d) => d.id), w, hh, sc?.gridSize]);
  if (key === drawKey) return;
  drawKey = key;
  drawSvg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
  drawSvg.setAttribute('width', w);
  drawSvg.setAttribute('height', hh);
  liveSvg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
  liveSvg.setAttribute('width', w);
  liveSvg.setAttribute('height', hh);
  setKids(drawSvg, list.map((d) => {
    const el = shapeFor(d.kind, d.pts, d.color, { id: d.id });
    const mine = d.userId === app.me?.id;
    if (mine || app.isGM) el.classList.add('erasable');
    return el;
  }));
}

// ------------------------------------------------------------ barra de ferramentas
function renderBar() {
  const viewer = app.state?.me.role === 'viewer';
  bar.hidden = viewer || !getScene();
  if (bar.hidden) { fogBar.hidden = true; return; }
  const list = TOOLS.filter(([id]) => id !== 'fog' || app.isGM);
  if (bar.dataset.k !== `${app.isGM}`) {
    bar.dataset.k = `${app.isGM}`;
    setKids(bar, list.map(([id, icon, title]) => h('button', {
      class: 'tool', dataset: { tool: id }, title, 'aria-label': title,
      onclick: () => setTool(tool === id && id !== 'move' ? 'move' : id),
    }, icon)),
    h('button', {
      class: 'tool', title: app.isGM ? 'Apagar todos os desenhos da cena' : 'Apagar os meus desenhos', 'aria-label': 'Limpar desenhos',
      onclick: () => {
        const sc = getScene();
        if (!sc) return;
        const all = app.isGM;
        if (confirm(all ? 'Apagar TODOS os desenhos e áreas desta cena?' : 'Apagar os seus desenhos desta cena?')) emit('draw:clear', { sceneId: sc.id, all });
      },
    }, '🗑'));
  }
  for (const b of bar.querySelectorAll('[data-tool]')) b.classList.toggle('on', b.dataset.tool === tool);
  renderFogBar();
}

function renderFogBar() {
  const sc = getScene();
  fogBar.hidden = !(tool === 'fog' && app.isGM && sc);
  if (fogBar.hidden) return;
  const on = !!sc.fog?.enabled;
  const mk = (mode, label) => h('button', { class: 'btn sm' + (fogMode === mode ? ' primary' : ''), onclick: () => { fogMode = mode; renderFogBar(); } }, label);
  setKids(fogBar,
    h('b', {}, '🌫 Névoa'),
    h('label', { class: 'mini toggle' }, h('input', { type: 'checkbox', checked: on, onchange: (e) => emit('fog:set', { sceneId: sc.id, enabled: e.target.checked }) }), 'Ligada'),
    mk('reveal-rect', '▭ Revelar'),
    mk('reveal-circle', '◯ Revelar'),
    mk('hide-rect', '▭ Esconder'),
    h('button', { class: 'btn sm ghost', title: 'Desfazer o último', onclick: () => emit('fog:undo', { sceneId: sc.id }) }, '↶'),
    h('button', { class: 'btn sm ghost', onclick: () => confirm('Cobrir o mapa inteiro de névoa?') && emit('fog:reset', { sceneId: sc.id, mode: 'cover' }) }, 'Cobrir tudo'),
    h('button', { class: 'btn sm ghost', onclick: () => emit('fog:reset', { sceneId: sc.id, mode: 'reveal' }) }, 'Revelar tudo'),
    h('span', { class: 'muted tiny' }, 'Arraste no mapa. Para você a névoa fica translúcida; para os jogadores, escura.'));
}

export function setTool(t) {
  tool = t;
  document.body.dataset.tool = t;
  action = null;
  setKids(liveSvg);
  renderBar();
}

// ------------------------------------------------------------ ponteiro
let trailing = null;
function sendMeasure(a, b, clear) {
  const now = performance.now();
  clearTimeout(trailing);
  if (!clear && now - lastSend < 80) {
    // manda a última posição logo depois, para os outros não verem a régua "atrasada"
    trailing = setTimeout(() => sendMeasure(a, b, false), 90 - (now - lastSend));
    return;
  }
  lastSend = now;
  app.socket?.emit('measure', clear ? { clear: true } : { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, () => {});
}

// Acha o desenho tocado pela borracha: primeiro o que está sob o dedo; senão o mais próximo
// (até meio quadrado), porque um traço fino é difícil de acertar no celular.
function distSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function eraserHit(e, p, sc) {
  const under = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.closest?.('.shape.erasable'));
  if (under) return under.closest('.shape.erasable').dataset.id;
  const mine = (sc.drawings || []).filter((d) => app.isGM || d.userId === app.me?.id);
  const tol = g() * 0.5;
  let best = null;
  for (const d of mine) {
    const flat = d.pts || [];
    const pts = [];
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
    if (!pts.length) continue;
    let dist = Infinity;
    if (d.kind === 'circle' && pts.length >= 2) dist = Math.max(0, Math.hypot(p.x - pts[0].x, p.y - pts[0].y) - Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
    else if (pts.length === 1) dist = Math.hypot(p.x - pts[0].x, p.y - pts[0].y);
    else for (let i = 1; i < pts.length; i++) dist = Math.min(dist, distSeg(p, pts[i - 1], pts[i]));
    if (dist <= tol && (!best || dist <= best.dist)) best = { id: d.id, dist };
  }
  return best?.id || null;
}

const hooks = {
  // devolve true se a ferramenta assumiu o gesto (aí o mapa não arrasta nem seleciona)
  down(e, p) {
    const sc = getScene();
    if (!sc || tool === 'move') return false;
    if (tool === 'eraser') {
      const id = eraserHit(e, p, sc);
      if (id) emit('draw:delete', { sceneId: sc.id, id });
      return true;
    }
    if (tool === 'fog') {
      if (!app.isGM) return false;
      action = { kind: 'fog', a: p, b: p };
      return true;
    }
    if (tool === 'ruler') {
      const a = snapPoint(p, true);
      action = { kind: 'ruler', a, b: a };
      return true;
    }
    if (tool === 'free') { action = { kind: 'free', pts: [Math.round(p.x), Math.round(p.y)] }; return true; }
    const a = tool === 'arrow' ? p : snapPoint(p, tool === 'line' ? false : false);
    action = { kind: tool, a, b: a };
    return true;
  },
  move(e, p) {
    if (!action) return;
    const color = app.me?.color || '#e0b44c';
    if (action.kind === 'ruler') {
      action.b = snapPoint(p, true);
      setKids(liveSvg, rulerShape(action.a, action.b, color));
      sendMeasure(action.a, action.b);
    } else if (action.kind === 'free') {
      const n = action.pts.length;
      const lx = action.pts[n - 2], ly = action.pts[n - 1];
      if (Math.hypot(p.x - lx, p.y - ly) * 1 >= g() / 10 && n < 1998) action.pts.push(Math.round(p.x), Math.round(p.y));
      setKids(liveSvg, shapeFor('free', action.pts, color));
    } else if (action.kind === 'fog') {
      action.b = p;
      const { a, b } = action;
      const style = { fill: fogMode.startsWith('hide') ? '#000' : '#fff', 'fill-opacity': 0.25, stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '8 6', 'vector-effect': 'non-scaling-stroke' };
      setKids(liveSvg, fogMode === 'reveal-circle'
        ? svg('circle', { cx: a.x, cy: a.y, r: Math.hypot(b.x - a.x, b.y - a.y), ...style })
        : svg('rect', { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), ...style }));
    } else {
      action.b = p;
      setKids(liveSvg, shapeFor(action.kind, [action.a.x, action.a.y, p.x, p.y], color));
    }
  },
  up() {
    const sc = getScene();
    const act = action;
    action = null;
    if (!act || !sc) { setKids(liveSvg); return; }
    if (act.kind === 'ruler') {
      sendMeasure(null, null, true);
      setTimeout(() => { if (!action) setKids(liveSvg); }, 1500);
      return;
    }
    setKids(liveSvg);
    if (act.kind === 'fog') {
      const { a, b } = act;
      if (fogMode === 'reveal-circle') {
        const r = Math.hypot(b.x - a.x, b.y - a.y);
        if (r > 5) emit('fog:op', { sceneId: sc.id, op: 'reveal', shape: 'circle', x: a.x, y: a.y, r });
      } else {
        const w = Math.abs(b.x - a.x), hh = Math.abs(b.y - a.y);
        if (w > 5 && hh > 5) emit('fog:op', { sceneId: sc.id, op: fogMode.startsWith('hide') ? 'hide' : 'reveal', shape: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w, h: hh });
      }
      return;
    }
    if (act.kind === 'free') {
      if (act.pts.length >= 4) emit('draw:add', { sceneId: sc.id, kind: 'free', pts: act.pts });
      return;
    }
    if (Math.hypot(act.b.x - act.a.x, act.b.y - act.a.y) < g() / 3) return toast('Arraste para definir o tamanho');
    emit('draw:add', { sceneId: sc.id, kind: act.kind, pts: [act.a.x, act.a.y, act.b.x, act.b.y].map(Math.round) });
  },
  cancel() { action = null; setKids(liveSvg); },
  render(state) {
    const sc = state.scene;
    renderFog(sc);
    renderDrawings(sc);
    renderBar();
  },
};
setToolHooks(hooks);

// régua dos outros: aparece para todos enquanto alguém mede
export function onMeasure(m) {
  if (m.userId === app.me?.id) return;
  let el = others.get(m.userId);
  if (m.clear) {
    if (el) setTimeout(() => { el.remove(); others.delete(m.userId); }, 1200);
    return;
  }
  const shape = rulerShape({ x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 }, m.color, m.name);
  if (el) el.replaceWith(shape); else liveSvg.append(shape);
  others.set(m.userId, shape);
}

// atalhos de teclado (fora de campos de texto)
document.addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { Escape: 'move', m: 'ruler', r: 'ruler', c: 'circle', d: 'free' };
  if (map[e.key] && getScene()) setTool(map[e.key]);
});
setTool('move');
