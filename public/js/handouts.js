// Segredos (handouts): textos/imagens que o mestre libera para um jogador, alguns ou todos.
import { app, emit } from './core.js';
import { $, h, chooseAndUpload, isEditingIn, setKids, toast } from './util.js';

const pane = $('#pane-handouts');
let lastKey = '';
let editing = null; // id do segredo sendo editado (mestre)
let form = null;

const seenKey = () => `tabula.seen.${app.me?.id}`;
export function seenSet() {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey()) || '[]')); } catch { return new Set(); }
}
export function markAllSeen() {
  const ids = (app.state?.handouts || []).map((x) => x.id);
  localStorage.setItem(seenKey(), JSON.stringify(ids));
}
export function unseenCount() {
  if (!app.state || app.isGM) return 0;
  const s = seenSet();
  return app.state.handouts.filter((x) => !s.has(x.id)).length;
}

const dateLabel = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

function openImage(src) {
  const box = h('div', { class: 'lightbox', onclick: () => box.remove() }, h('img', { src, alt: '' }));
  document.body.append(box);
}

function playerView(state) {
  const seen = seenSet();
  return [
    h('div', { class: 'pane-title' }, h('h2', {}, 'Segredos'), h('span', { class: 'muted small' }, 'Só você vê o que é seu')),
    state.handouts.length ? null : h('p', { class: 'muted empty-state' }, 'Nada por aqui… ainda.'),
    state.handouts.map((x) => h('article', { class: 'handout' + (seen.has(x.id) ? '' : ' new') },
      h('header', {}, h('h3', {}, x.title), h('time', {}, dateLabel(x.createdAt))),
      x.img ? h('img', { src: x.img, alt: '', class: 'handout-img', onclick: () => openImage(x.img) }) : null,
      x.body ? h('div', { class: 'handout-body' }, x.body) : null)),
  ];
}

function buildForm() {
  const title = h('input', { placeholder: 'Título (ex.: Memória — a torre)', 'aria-label': 'Título' });
  const body = h('textarea', { rows: 5, placeholder: 'Texto que o jogador vai ler…', 'aria-label': 'Texto' });
  const imgPrev = h('div', { class: 'img-prev' });
  let img = '';
  const setImg = (u) => {
    img = u || '';
    setKids(imgPrev, img ? h('img', { src: img, alt: '' }) : h('span', { class: 'muted small' }, 'Sem imagem'),
      img ? h('button', { type: 'button', class: 'btn ghost sm', onclick: () => setImg('') }, 'Tirar') : null);
  };
  setImg('');
  const dest = h('select', { 'aria-label': 'Entregar' });
  const fillDest = () => {
    const players = (app.state?.users || []).filter((u) => u.role === 'player');
    const cur = dest.value;
    setKids(dest, h('option', { value: '' }, 'Escolher depois quem recebe'),
      players.map((u) => h('option', { value: u.id }, `Pôr na fila de memórias de ${u.name}`)));
    dest.value = [...dest.options].some((o) => o.value === cur) ? cur : '';
  };
  fillDest();
  const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Criar segredo');
  const cancel = h('button', { class: 'btn ghost', type: 'button', hidden: true, onclick: () => reset() }, 'Cancelar');
  const heading = h('h3', {}, 'Novo segredo');

  const reset = () => {
    editing = null; title.value = ''; body.value = ''; setImg('');
    submit.textContent = 'Criar segredo'; cancel.hidden = true; heading.textContent = 'Novo segredo';
  };
  const el = h('form', {
    class: 'card stack',
    onsubmit: async (e) => {
      e.preventDefault();
      const data = { title: title.value, body: body.value, img };
      if (editing) {
        if (await emit('handout:update', { id: editing, patch: data })) reset();
      } else if (await emit('handout:create', { ...data, queuedFor: dest.value || null })) {
        if (dest.value) toast('Guardado na fila. Libere na hora certa em "Fila de memórias".', 'ok');
        reset();
      }
    },
  },
  heading, title, body,
  h('div', { class: 'row gap' }, imgPrev, h('button', { type: 'button', class: 'btn sm', onclick: async () => { const u = await chooseAndUpload(); if (u) setImg(u); } }, 'Imagem…')),
  dest,
  h('div', { class: 'row gap' }, submit, cancel),
  h('p', { class: 'muted small' }, 'Depois de criar, escolha abaixo quem recebe — ou ponha na fila de memórias de um jogador e libere uma de cada vez. O jogador é avisado na hora.'));

  form = {
    el,
    fillDest,
    load(x) {
      editing = x.id; title.value = x.title; body.value = x.body; setImg(x.img);
      submit.textContent = 'Salvar alterações'; cancel.hidden = false; heading.textContent = 'Editando segredo';
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };
}

function queueView(state) {
  const players = state.users.filter((u) => u.role === 'player');
  const queued = state.handouts.filter((x) => x.queuedFor);
  if (!queued.length) return null;
  return h('section', { class: 'card stack queue' },
    h('div', { class: 'row gap wrap' },
      h('h3', { class: 'grow' }, '🧠 Fila de memórias'),
      h('button', {
        class: 'btn sm primary',
        onclick: async () => { const r = await emit('handout:releaseNext', { userId: 'all' }); if (r) toast(`${r.released} memória(s) liberada(s)`, 'ok'); },
      }, 'Liberar a próxima de cada um')),
    players.map((u) => {
      const list = queued.filter((x) => x.queuedFor === u.id).sort((a, b) => a.order - b.order);
      if (!list.length) return null;
      return h('div', { class: 'queue-col', style: { '--c': u.color } },
        h('div', { class: 'row gap' },
          h('b', { class: 'grow', style: { color: u.color } }, `${u.name} · ${list.length} na fila`),
          h('button', { class: 'btn sm', onclick: () => emit('handout:releaseNext', { userId: u.id }).then((r) => r && toast(`Memória liberada para ${u.name}`, 'ok')) }, 'Liberar próxima ➜')),
        h('ol', { class: 'queue-list' }, list.map((x, i) => h('li', { class: i === 0 ? 'next' : '' },
          h('span', { class: 'grow' }, x.title, i === 0 ? h('small', { class: 'muted' }, ' · próxima') : null),
          h('button', { class: 'btn ghost sm', title: 'Subir', disabled: i === 0, onclick: () => emit('handout:queueMove', { id: x.id, dir: -1 }) }, '↑'),
          h('button', { class: 'btn ghost sm', title: 'Descer', disabled: i === list.length - 1, onclick: () => emit('handout:queueMove', { id: x.id, dir: 1 }) }, '↓'),
          h('button', { class: 'btn ghost sm', title: 'Editar', onclick: () => form.load(x) }, '✎'),
          h('button', { class: 'btn ghost sm', title: 'Tirar da fila', onclick: () => emit('handout:queue', { id: x.id, userId: null }) }, '✕')))));
    }));
}

function gmList(state) {
  const players = state.users.filter((u) => u.role === 'player');
  const loose = state.handouts.filter((x) => !x.queuedFor);
  return h('div', { class: 'stack', id: 'handout-list' },
    queueView(state),
    loose.length ? null : h('p', { class: 'muted' }, 'Nenhum segredo fora da fila.'),
    loose.map((x) => {
      const toggle = (rid) => {
        let r = x.recipients.slice();
        if (rid === 'all') r = r.includes('all') ? [] : ['all'];
        else {
          r = r.filter((v) => v !== 'all');
          r = r.includes(rid) ? r.filter((v) => v !== rid) : [...r, rid];
        }
        emit('handout:update', { id: x.id, patch: { recipients: r } });
      };
      const all = x.recipients.includes('all');
      return h('article', { class: 'handout gm' },
        h('header', {}, h('h3', {}, x.title), h('time', {}, dateLabel(x.createdAt))),
        x.img ? h('img', { src: x.img, alt: '', class: 'handout-img', onclick: () => openImage(x.img) }) : null,
        x.body ? h('div', { class: 'handout-body clamp' }, x.body) : null,
        h('div', { class: 'recipients' },
          h('span', { class: 'muted small' }, 'Quem vê:'),
          h('button', { class: 'pill' + (all ? ' on' : ''), onclick: () => toggle('all') }, 'Todos'),
          players.map((u) => h('button', {
            class: 'pill' + (all || x.recipients.includes(u.id) ? ' on' : ''),
            style: { '--c': u.color },
            disabled: all,
            onclick: () => toggle(u.id),
          }, u.name))),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'btn sm', onclick: () => form.load(x) }, 'Editar'),
          x.recipients.length ? null : h('select', {
            class: 'sm-select', 'aria-label': 'Pôr na fila de',
            onchange: (e) => e.target.value && emit('handout:queue', { id: x.id, userId: e.target.value }),
          }, h('option', { value: '' }, 'Pôr na fila de…'), players.map((u) => h('option', { value: u.id }, u.name))),
          h('button', { class: 'btn sm danger', onclick: () => confirm(`Apagar "${x.title}"?`) && emit('handout:delete', { id: x.id }) }, 'Apagar')));
    }));
}

export function renderHandouts(state, isActive) {
  if (app.isGM) {
    if (!form) buildForm();
    const key = JSON.stringify([state.handouts, state.users]);
    if (key === lastKey && pane.contains(form.el)) return;
    lastKey = key;
    form.fillDest();
    const list = gmList(state);
    if (!pane.contains(form.el)) {
      setKids(pane, h('div', { class: 'pane-title' }, h('h2', {}, 'Segredos')), form.el, list);
    } else {
      $('#handout-list', pane).replaceWith(list);
    }
    return;
  }
  const key = JSON.stringify(state.handouts);
  if (key !== lastKey || isActive) {
    if (isEditingIn(pane)) return;
    lastKey = key;
    setKids(pane, ...playerView(state).flat().filter(Boolean));
  }
}
