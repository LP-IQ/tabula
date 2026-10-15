// Diário do grupo: todos leem e escrevem; cada um edita/apaga o que escreveu (o mestre pode tudo).
import { app, emit } from './core.js';
import { $, h, avatar, chooseAndUpload, openImage, setKids, isEditingIn } from './util.js';

const pane = $('#pane-journal');
let form = null;
let listEl = null;
let lastKey = '';
let editing = null;

const when = (ts) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function buildForm() {
  const title = h('input', { placeholder: 'Título (opcional) — ex.: Sessão 1, a torre', 'aria-label': 'Título', maxlength: '120' });
  const body = h('textarea', { rows: 4, placeholder: 'O que aconteceu? Pistas, nomes, dívidas, piadas internas…', 'aria-label': 'Texto do diário' });
  const prev = h('div', { class: 'img-prev' });
  let img = '';
  const setImg = (u) => {
    img = u || '';
    setKids(prev, img ? [h('img', { src: img, alt: '' }), h('button', { type: 'button', class: 'btn ghost sm', onclick: () => setImg('') }, 'Tirar')] : null);
  };
  const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Publicar');
  const cancel = h('button', { class: 'btn ghost', type: 'button', hidden: true, onclick: () => reset() }, 'Cancelar');

  const reset = () => {
    editing = null;
    title.value = ''; body.value = ''; setImg('');
    submit.textContent = 'Publicar'; cancel.hidden = true;
  };
  const el = h('form', {
    class: 'card stack journal-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const data = { title: title.value, body: body.value, img };
      const ok = editing
        ? await emit('journal:update', { id: editing, patch: data })
        : await emit('journal:create', data);
      if (ok) reset();
    },
  },
  title, body,
  h('div', { class: 'row gap wrap' },
    h('button', { type: 'button', class: 'btn sm', onclick: async () => { const u = await chooseAndUpload(); if (u) setImg(u); } }, '🖼 Imagem'),
    prev,
    h('span', { class: 'grow' }),
    cancel, submit));

  form = {
    el,
    load(x) {
      editing = x.id;
      title.value = x.title || ''; body.value = x.body || ''; setImg(x.img);
      submit.textContent = 'Salvar'; cancel.hidden = false;
      body.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };
}

function entryView(x, state) {
  const author = state.users.find((u) => u.id === x.userId);
  const mine = x.userId === state.me.id;
  const canEdit = mine || app.isGM;
  return h('article', { class: 'journal-entry' + (mine ? ' mine' : ''), style: { '--c': author?.color || 'var(--line)' } },
    h('header', {},
      avatar(null, author?.name || '?', author?.color, 30),
      h('div', { class: 'grow' },
        h('b', { style: { color: author?.color } }, author?.name || 'ex-jogador'),
        h('div', { class: 'muted small' }, when(x.createdAt), x.updatedAt ? ' · editado' : '')),
      canEdit ? h('div', { class: 'row' },
        mine ? h('button', { class: 'btn ghost sm', title: 'Editar', onclick: () => form.load(x) }, '✎') : null,
        h('button', { class: 'btn ghost sm', title: 'Apagar', onclick: () => confirm('Apagar esta entrada do diário?') && emit('journal:delete', { id: x.id }) }, '✕')) : null),
    x.title ? h('h3', {}, x.title) : null,
    x.body ? h('div', { class: 'journal-body' }, x.body) : null,
    x.img ? h('img', { class: 'handout-img', src: x.img, alt: '', onclick: () => openImage(x.img) }) : null);
}

export function renderJournal(state) {
  const canWrite = state.me.role !== 'viewer';
  if (!listEl) {
    if (canWrite && !form) buildForm();
    listEl = h('div', { class: 'stack' });
    setKids(pane,
      h('div', { class: 'pane-title' }, h('h2', {}, 'Diário do grupo'), h('span', { class: 'muted small' }, 'Todos leem e escrevem')),
      canWrite ? form.el : null,
      listEl);
  }
  const key = JSON.stringify([state.journal, state.users.map((u) => [u.id, u.name, u.color]), state.me.id]);
  if (key === lastKey || isEditingIn(listEl)) return;
  lastKey = key;
  setKids(listEl,
    state.journal.length ? null : h('p', { class: 'muted empty-state' }, 'O diário está em branco. Que tal registrar a primeira sessão?'),
    state.journal.map((x) => entryView(x, state)));
}

// Quando trocam de usuário (sair/entrar), refaz tudo do zero
export function resetJournal() {
  form = null; listEl = null; lastKey = ''; editing = null;
}
