// Janelas flutuantes (por cima do mapa): arrastar pelo título, redimensionar pelo canto, fechar no ✕.
// Posição e tamanho de cada janela ficam lembrados neste navegador.
import { h } from './util.js';

const open = new Map();         // key → janela
let z = 40;              // janelas ficam entre 40 e 99 (abaixo das janelas de diálogo e dos avisos)
let cascade = 0;
let lastActive = null;          // última janela clicada (para o Ctrl+V)

export const isMobile = () => window.matchMedia('(max-width: 820px)').matches;

function loadBox(key) {
  try { return JSON.parse(localStorage.getItem('tabula.win.' + key) || 'null'); } catch { return null; }
}
function saveBox(key, box) {
  try { localStorage.setItem('tabula.win.' + key, JSON.stringify(box)); } catch { /* ok */ }
}

function clampToViewport(el) {
  const r = el.getBoundingClientRect();
  const maxX = window.innerWidth - Math.min(r.width, 160);
  const maxY = window.innerHeight - 48;
  el.style.left = Math.max(0, Math.min(maxX, r.left)) + 'px';
  el.style.top = Math.max(0, Math.min(maxY, r.top)) + 'px';
}

export function openWindow({ key, title, content, width = 440, height = 620, onClose, className = '' }) {
  if (open.has(key)) { const w = open.get(key); w.focus(); return w; }

  const titleEl = h('span', { class: 'win-title' }, title);
  const extra = h('span', { class: 'win-extra' });
  const closeBtn = h('button', { class: 'btn ghost sm win-close', title: 'Fechar', 'aria-label': 'Fechar janela' }, '✕');
  const head = h('div', { class: 'win-head' }, titleEl, extra, closeBtn);
  const body = h('div', { class: 'win-body' }, content);
  const el = h('section', { class: `float-win ${className}`, role: 'dialog', 'aria-label': title, tabindex: '-1' }, head, body);

  const saved = loadBox(key);
  const w = Math.min(saved?.w || width, window.innerWidth - 16);
  const hgt = Math.min(saved?.h || height, window.innerHeight - 16);
  el.style.width = w + 'px';
  el.style.height = hgt + 'px';
  if (saved) {
    el.style.left = saved.x + 'px';
    el.style.top = saved.y + 'px';
  } else {
    el.style.left = Math.max(8, 90 + cascade * 32) + 'px';
    el.style.top = Math.max(8, 70 + cascade * 32) + 'px';
    cascade = (cascade + 1) % 6;
  }
  document.body.append(el);
  clampToViewport(el);

  const remember = () => {
    const r = el.getBoundingClientRect();
    saveBox(key, { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  };
  const focus = () => {
    if (z >= 95) {
      const list = [...open.values()].sort((a, b) => Number(a.el.style.zIndex) - Number(b.el.style.zIndex));
      z = 40;
      for (const x of list) x.el.style.zIndex = String(++z);
    }
    el.style.zIndex = String(++z);
    lastActive = win;
    for (const x of open.values()) x.el.classList.toggle('front', x === win);
  };

  // arrastar pelo título
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, select, a')) return;
    drag = { dx: e.clientX - el.offsetLeft, dy: e.clientY - el.offsetTop };
    head.setPointerCapture(e.pointerId);
    el.classList.add('moving');
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag) return;
    el.style.left = e.clientX - drag.dx + 'px';
    el.style.top = e.clientY - drag.dy + 'px';
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    el.classList.remove('moving');
    clampToViewport(el);
    remember();
  };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);
  head.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) el.classList.toggle('shrunk'); });

  // redimensionar (o canto usa o "resize" do próprio navegador)
  let t = 0;
  const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(remember, 300); });
  ro.observe(el);

  el.addEventListener('pointerdown', focus, true);

  const close = () => {
    ro.disconnect();
    el.remove();
    open.delete(key);
    if (lastActive === win) lastActive = null;
    onClose?.();
  };
  closeBtn.addEventListener('click', close);

  const win = {
    key, el, body, extra,
    setTitle(txt) { if (titleEl.textContent !== txt) titleEl.textContent = txt; el.setAttribute('aria-label', txt); },
    focus,
    close,
  };
  open.set(key, win);
  focus();
  return win;
}

export const getWindow = (key) => open.get(key) || null;
export const activeWindow = () => (lastActive && open.has(lastActive.key) ? lastActive : null);

// quando a tela muda de tamanho, nenhuma janela fica perdida fora dela
window.addEventListener('resize', () => { for (const w of open.values()) clampToViewport(w.el); });
// clicar fora das janelas (no mapa, no painel) deixa nenhuma "ativa" para o Ctrl+V
document.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('.float-win')) lastActive = null; }, true);
