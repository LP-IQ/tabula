// Pequenas ferramentas usadas pela interface inteira.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// h('div', {class:'x', onclick: fn}, 'texto', outroElemento)
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (typeof v === 'boolean') el[k] = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function toast(msg, kind = 'info', ms = 3500) {
  const el = h('div', { class: `toast ${kind}` }, msg);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

export const abilityMod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
export const fmtMod = (n) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonus = (level) => 2 + Math.floor(((Number(level) || 1) - 1) / 4);

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function debounce(fn, ms) {
  let t;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  d.flush = (...args) => { clearTimeout(t); fn(...args); };
  return d;
}

export function pickFile(accept = 'image/png,image/jpeg,image/webp,image/gif') {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

export async function uploadImage(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'x-token': localStorage.getItem('tabula.token') || '' },
    body: fd,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Falha ao enviar a imagem');
  return j.url;
}

// Escolhe e envia uma imagem; devolve a URL ou null.
export async function chooseAndUpload() {
  const file = await pickFile();
  if (!file) return null;
  try {
    toast('Enviando imagem…');
    return await uploadImage(file);
  } catch (e) {
    toast(e.message, 'error');
    return null;
  }
}

// Avatar redondo: imagem ou iniciais
export function avatar(img, name, color, size = 32) {
  const el = h('span', { class: 'avatar', style: { width: size + 'px', height: size + 'px', '--ring': color || 'var(--line)' } });
  if (img) {
    const im = h('img', { src: img, alt: '', draggable: 'false' });
    im.addEventListener('error', () => { im.remove(); el.textContent = initials(name); });
    el.append(im);
  } else {
    el.textContent = initials(name);
  }
  return el;
}

export const timeLabel = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// true se o usuário está digitando dentro do elemento (para não apagar o que ele escreve)
export const isEditingIn = (root) => {
  const a = document.activeElement;
  return !!a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
};

// Troca o conteúdo de um elemento; aceita listas e ignora null/false.
export function setKids(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false)
    .map((c) => (c instanceof Node ? c : String(c))));
  return el;
}

// Mostra uma imagem em tela cheia (toque/clique fecha)
export function openImage(src) {
  const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-label': 'Imagem ampliada', onclick: () => box.remove() },
    h('img', { src, alt: '' }));
  const onKey = (e) => { if (e.key === 'Escape') { box.remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  document.body.append(box);
}
