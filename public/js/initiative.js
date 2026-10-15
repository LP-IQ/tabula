// Rastreador de iniciativa (Initiative Tracker).
import { app, emit } from './core.js';
import { $, h, avatar, isEditingIn, setKids } from './util.js';

const pane = $('#pane-init');
let lastKey = '';

export function renderInitiative(state) {
  const ini = state.initiative;
  const gm = app.isGM;
  const key = JSON.stringify([ini, gm, state.characters.map((c) => [c.id, c.name, c.img, c.ownerId]), state.me.id]);
  if (key === lastKey || isEditingIn(pane)) return;
  lastKey = key;

  const cur = ini.entries.find((e) => e.id === ini.currentId);
  const curChar = cur?.characterId ? app.char(cur.characterId) : null;
  const myTurn = ini.active && curChar && curChar.ownerId === state.me.id;
  const mine = app.myCharacters();

  const list = h('ol', { class: 'init-list' },
    ini.entries.length ? null : h('li', { class: 'muted empty' }, gm ? 'Ninguém na iniciativa ainda.' : 'Sem combate no momento.'),
    ini.entries.map((e) => {
      const c = e.characterId ? app.char(e.characterId) : null;
      const owner = c?.ownerId ? app.user(c.ownerId) : null;
      const name = c ? c.name : e.name;
      return h('li', { class: 'init-row' + (e.id === ini.currentId && ini.active ? ' current' : '') + (e.hidden ? ' is-hidden' : '') },
        avatar((c && c.img) || e.img, name, owner?.color || '#b0473e', 34),
        h('span', { class: 'init-name' }, name, e.hidden ? h('small', { class: 'muted' }, ' (oculto)') : null),
        gm
          ? h('input', {
            type: 'number', class: 'num', value: String(e.value), 'aria-label': `Iniciativa de ${name}`,
            onchange: (ev) => emit('init:update', { id: e.id, value: Number(ev.target.value) }),
          })
          : h('b', { class: 'init-val' }, String(e.value)),
        gm ? h('button', { class: 'btn ghost sm', title: e.hidden ? 'Mostrar aos jogadores' : 'Esconder dos jogadores', onclick: () => emit('init:update', { id: e.id, hidden: !e.hidden }) }, e.hidden ? '🙈' : '👁') : null,
        gm ? h('button', { class: 'btn ghost sm', title: 'Remover', onclick: () => emit('init:remove', { id: e.id }) }, '✕') : null);
    }));

  const playerBar = !gm ? h('div', { class: 'row gap wrap' },
    mine.length ? h('button', { class: 'btn primary', onclick: () => emit('init:rollMine') }, '🎲 Rolar minha iniciativa') : null,
    myTurn ? h('button', { class: 'btn', onclick: () => emit('init:next') }, 'Terminei meu turno ➜') : null) : null;

  let gmBar = null;
  if (gm) {
    const name = h('input', { placeholder: 'Nome', 'aria-label': 'Nome', required: true });
    const val = h('input', { type: 'number', class: 'num', placeholder: 'Init.', 'aria-label': 'Valor', required: true });
    const hid = h('input', { type: 'checkbox' });
    gmBar = h('div', { class: 'stack' },
      h('div', { class: 'row gap wrap' },
        ini.active
          ? [
            h('button', { class: 'btn', onclick: () => emit('init:next', { dir: -1 }) }, '◀ Anterior'),
            h('button', { class: 'btn primary', onclick: () => emit('init:next', { dir: 1 }) }, 'Próximo ▶'),
            h('button', { class: 'btn danger', onclick: () => confirm('Encerrar o combate e limpar a iniciativa?') && emit('init:end') }, 'Encerrar'),
          ]
          : [
            h('button', { class: 'btn primary', onclick: () => emit('init:start') }, '⚔ Começar combate'),
            ini.entries.length ? h('button', { class: 'btn ghost', onclick: () => emit('init:end') }, 'Limpar') : null,
          ]),
      h('button', { class: 'btn', onclick: () => emit('init:addScene') }, '+ Todos os tokens da cena (rola automático)'),
      h('form', {
        class: 'row gap',
        onsubmit: async (e) => {
          e.preventDefault();
          if (await emit('init:add', { name: name.value, value: Number(val.value), hidden: hid.checked })) {
            name.value = ''; val.value = ''; hid.checked = false;
          }
        },
      }, name, val, h('label', { class: 'mini', title: 'Oculto para os jogadores' }, hid, '🙈'), h('button', { class: 'btn sm', type: 'submit' }, 'Adicionar')));
  }

  setKids(pane, 
    h('div', { class: 'pane-title' },
      h('h2', {}, 'Iniciativa'),
      h('span', { class: 'chip' + (ini.active ? ' live' : '') }, ini.active ? `Rodada ${ini.round}` : 'Fora de combate')),
    myTurn ? h('div', { class: 'your-turn' }, 'É a sua vez!') : null,
    list,
    playerBar,
    gmBar,
  );
}
