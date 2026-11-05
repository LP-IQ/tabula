// Compêndio: páginas de consulta (regras da casa, tabelas de XP, preços, locais, NPCs…).
// Só o mestre escreve. Cada página é "só mestre" (anotações da aventura) ou "todos".
import { app, emit } from './core.js';
import { $, h, chooseAndUpload, openImage, setKids, isEditingIn } from './util.js';
import { spellBrowser, itemBrowser, LIB_SOURCE } from './library.js';

const pane = $('#pane-compendium');
let built = false;
let builtAsGM = false;
let listEl, chipsEl, searchEl, form, catList;
let lastKey = '';
let filterCat = '';
const openIds = new Set();
// abas: páginas do mestre · magias do SRD · itens do SRD
let tab = (() => { try { return localStorage.getItem('tabula.comp.tab') || 'pages'; } catch { return 'pages'; } })();
let wraps = null;

function buildForm() {
  const title = h('input', { placeholder: 'Título — ex.: Tabela de XP, Preços em Neverwinter', 'aria-label': 'Título', maxlength: '120' });
  const category = h('input', { placeholder: 'Categoria — ex.: Regras, Locais, NPCs', 'aria-label': 'Categoria', list: 'comp-cats', maxlength: '40' });
  const visibility = h('select', { 'aria-label': 'Quem vê' },
    h('option', { value: 'gm' }, '🔒 Só eu (mestre)'),
    h('option', { value: 'all' }, '👁 Todos os jogadores'));
  const body = h('textarea', { rows: 6, placeholder: 'Texto da página…', 'aria-label': 'Texto' });
  const gallery = h('div', { class: 'thumbs' });
  let images = [];
  const setImages = (list) => {
    images = list;
    setKids(gallery, images.map((u, i) => h('div', { class: 'thumb-edit' },
      h('img', { src: u, alt: '' }),
      h('button', { type: 'button', title: 'Tirar imagem', onclick: () => setImages(images.filter((_, j) => j !== i)) }, '✕'))));
  };
  const heading = h('summary', {}, 'Nova página');
  const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Criar página');
  const cancel = h('button', { class: 'btn ghost', type: 'button', hidden: true, onclick: () => reset() }, 'Cancelar');
  let editing = null;

  const reset = () => {
    editing = null;
    title.value = ''; category.value = ''; body.value = ''; visibility.value = 'gm'; setImages([]);
    heading.textContent = 'Nova página'; submit.textContent = 'Criar página'; cancel.hidden = true;
  };

  const el = h('details', { class: 'block comp-form' }, heading,
    h('form', {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        const data = { title: title.value, category: category.value, visibility: visibility.value, body: body.value, images };
        const ok = editing
          ? await emit('compendium:update', { id: editing, patch: data })
          : await emit('compendium:create', data);
        if (ok) {
          if (ok.id) openIds.add(ok.id);
          reset();
          el.open = false;
        }
      },
    },
    title,
    h('div', { class: 'row gap' }, category, visibility),
    body,
    gallery,
    h('div', { class: 'row gap wrap' },
      h('button', {
        type: 'button', class: 'btn sm',
        onclick: async () => { const u = await chooseAndUpload(); if (u) setImages([...images, u]); },
      }, '🖼 Adicionar imagem'),
      h('span', { class: 'grow' }),
      cancel, submit),
    h('p', { class: 'muted small' }, 'Dica: para tabelas (XP, preços), tire um print ou foto e adicione como imagem; os jogadores podem tocar para ampliar.')));

  form = {
    el,
    load(x) {
      editing = x.id;
      title.value = x.title; category.value = x.category; body.value = x.body; visibility.value = x.visibility;
      setImages([...x.images]);
      heading.textContent = 'Editando página'; submit.textContent = 'Salvar'; cancel.hidden = false;
      el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };
}

function matches(x, q) {
  if (filterCat && x.category !== filterCat) return false;
  if (!q) return true;
  const hay = `${x.title}\n${x.category}\n${x.body}`.toLocaleLowerCase('pt-BR');
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function pageView(x) {
  const gm = app.isGM;
  const det = h('details', { class: 'comp-page' + (x.visibility === 'gm' ? ' private' : ''), open: openIds.has(x.id) },
    h('summary', {},
      h('span', { class: 'grow' }, x.title),
      h('span', { class: 'tag cat' }, x.category),
      gm ? h('span', { class: 'vis', title: x.visibility === 'gm' ? 'Só você vê' : 'Os jogadores veem' }, x.visibility === 'gm' ? '🔒' : '👁') : null),
    h('div', { class: 'comp-content' },
      x.body ? h('div', { class: 'journal-body' }, x.body) : null,
      x.images.map((u) => h('img', { class: 'comp-img', src: u, alt: '', loading: 'lazy', onclick: () => openImage(u) })),
      gm ? h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn sm', onclick: () => form.load(x) }, '✎ Editar'),
        h('button', {
          class: 'btn sm',
          onclick: () => emit('compendium:update', { id: x.id, patch: { visibility: x.visibility === 'gm' ? 'all' : 'gm' } }),
        }, x.visibility === 'gm' ? '👁 Mostrar aos jogadores' : '🔒 Esconder dos jogadores'),
        h('button', { class: 'btn sm danger', onclick: () => confirm(`Apagar a página "${x.title}"?`) && emit('compendium:delete', { id: x.id }) }, 'Apagar')) : null));
  det.addEventListener('toggle', () => { if (det.open) openIds.add(x.id); else openIds.delete(x.id); });
  return det;
}

function renderList(state) {
  const pages = state.compendium;
  const cats = [...new Set(pages.map((x) => x.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (filterCat && !cats.includes(filterCat)) filterCat = '';
  if (catList) setKids(catList, cats.map((c) => h('option', { value: c })));

  setKids(chipsEl, cats.length > 1 ? [
    h('button', { class: 'pill' + (!filterCat ? ' on' : ''), onclick: () => { filterCat = ''; renderList(app.state); } }, 'Tudo'),
    cats.map((c) => h('button', { class: 'pill' + (filterCat === c ? ' on' : ''), onclick: () => { filterCat = c; renderList(app.state); } }, c)),
  ] : null);

  const q = searchEl.value.trim().toLocaleLowerCase('pt-BR');
  const shown = pages.filter((x) => matches(x, q));
  setKids(listEl,
    !pages.length ? h('p', { class: 'muted empty-state' }, app.isGM ? 'Nenhuma página ainda. Crie a primeira em "Nova página".' : 'O mestre ainda não publicou nada no compêndio.') : null,
    pages.length && !shown.length ? h('p', { class: 'muted' }, 'Nada encontrado.') : null,
    shown.map(pageView));
}

function showTab(k) {
  tab = ['pages', 'spells', 'items'].includes(k) ? k : 'pages';
  try { localStorage.setItem('tabula.comp.tab', tab); } catch { /* sem armazenamento */ }
  for (const [key, el] of Object.entries(wraps)) el.hidden = key !== tab;
  for (const b of pane.querySelectorAll('.comp-tabs .seg-btn')) {
    b.classList.toggle('on', b.dataset.tab === tab);
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  }
  for (const el of pane.querySelectorAll('[data-only]')) el.hidden = el.dataset.only === 'pages' ? tab !== 'pages' : tab === 'pages';
  // os navegadores da Biblioteca só carregam os dados quando a aba é aberta pela primeira vez
  if (tab === 'spells' && !wraps.spells.firstChild) wraps.spells.append(spellBrowser());
  if (tab === 'items' && !wraps.items.firstChild) wraps.items.append(itemBrowser());
}

export function renderCompendium(state) {
  if (!built || builtAsGM !== app.isGM) {
    built = true;
    builtAsGM = app.isGM;
    lastKey = '';
    searchEl = h('input', { type: 'search', placeholder: 'Buscar no compêndio…', 'aria-label': 'Buscar', oninput: () => renderList(app.state) });
    chipsEl = h('div', { class: 'recipients' });
    listEl = h('div', { class: 'stack' });
    catList = h('datalist', { id: 'comp-cats' });
    if (app.isGM) buildForm();
    wraps = {
      pages: h('div', { class: 'stack' }, app.isGM ? form.el : null, catList, searchEl, chipsEl, listEl),
      spells: h('div', { class: 'stack' }),
      items: h('div', { class: 'stack' }),
    };
    const seg = h('div', { class: 'seg wide comp-tabs', role: 'tablist' },
      [['pages', '📄 Páginas'], ['spells', '✨ Magias'], ['items', '🎒 Itens']].map(([k, label]) => h('button', {
        class: 'seg-btn', role: 'tab', dataset: { tab: k }, onclick: () => showTab(k),
      }, label)));
    setKids(pane,
      h('div', { class: 'pane-title' }, h('h2', {}, 'Compêndio'),
        app.isGM ? h('span', { class: 'muted small', dataset: { only: 'pages' } }, '🔒 só você · 👁 todos') : null),
      seg,
      wraps.pages, wraps.spells, wraps.items,
      h('p', { class: 'muted small lib-source', dataset: { only: 'lib' } }, LIB_SOURCE));
    showTab(tab);
  }
  const key = JSON.stringify(state.compendium);
  if (key === lastKey || isEditingIn(listEl)) return;
  lastKey = key;
  renderList(state);
}
