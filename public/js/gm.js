// Painel do Mestre: cenas, tokens, jogadores e personagens, backup.
import { app, emit } from './core.js';
import { $, h, chooseAndUpload, pickFile, uploadImage, avatar, isEditingIn, toast, setKids } from './util.js';
import { viewCenter, fit } from './map.js';

const pane = $('#pane-gm');
let built = false;
const parts = {};
const keys = {};

function section(title, body, open = true) {
  return h('details', { class: 'block', open }, h('summary', {}, title), body);
}

function changed(name, value) {
  const k = JSON.stringify(value);
  if (keys[name] === k) return false;
  keys[name] = k;
  return true;
}

// ------------------------------------------------------------------ cenas
function newSceneForm() {
  const name = h('input', { placeholder: 'Nome da cena (ex.: Torre — 1º andar)', 'aria-label': 'Nome da cena' });
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Escolher imagem e criar');
  return h('form', {
    class: 'stack',
    onsubmit: async (e) => {
      e.preventDefault();
      const file = await pickFile();
      if (!file) return;
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      try {
        const url = await uploadImage(file);
        const res = await emit('scene:create', { name: name.value || file.name.replace(/\.[^.]+$/, ''), img: url });
        if (res) { name.value = ''; toast('Cena criada'); }
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Escolher imagem e criar';
      }
    },
  }, name, h('div', { class: 'row gap wrap' }, btn,
    h('button', {
      class: 'btn ghost', type: 'button',
      onclick: async () => { if (await emit('scene:create', { name: name.value || 'Mesa vazia', img: '' })) name.value = ''; },
    }, 'Criar sem imagem')));
}

function sceneList(state) {
  return h('ul', { class: 'scene-list' },
    state.scenes.length ? null : h('li', { class: 'muted' }, 'Nenhuma cena ainda.'),
    state.scenes.map((s) => {
      const active = s.id === state.activeSceneId;
      return h('li', { class: 'scene-item' + (active ? ' active' : '') },
        h('div', { class: 'thumb' }, s.img ? h('img', { src: s.img, alt: '' }) : null),
        h('div', { class: 'grow' }, h('b', {}, s.name), h('div', { class: 'muted small' }, `${s.tokens} token(s)`)),
        active
          ? h('span', { class: 'chip live' }, 'No ar')
          : h('button', { class: 'btn sm primary', onclick: () => emit('scene:activate', { id: s.id }) }, 'Mostrar'),
        h('button', {
          class: 'btn ghost sm', title: 'Apagar cena',
          onclick: () => confirm(`Apagar a cena "${s.name}" e os tokens dela?`) && emit('scene:delete', { id: s.id }),
        }, '✕'));
    }));
}

function sceneSettings(state) {
  const s = state.scene;
  if (!s) return h('p', { class: 'muted small' }, 'Nenhuma cena ativa.');
  const upd = (patch) => emit('scene:update', { id: s.id, patch });
  const numIn = (key, label, step = 1) => h('label', { class: 'mini' }, label,
    h('input', { type: 'number', class: 'num', step: String(step), value: String(s[key]), onchange: (e) => upd({ [key]: Number(e.target.value) }) }));
  return h('div', { class: 'stack' },
    h('label', {}, 'Nome', h('input', { value: s.name, onchange: (e) => upd({ name: e.target.value }) })),
    h('div', { class: 'row gap wrap' },
      numIn('gridSize', 'Quadrado (px)', 0.5),
      numIn('gridOffsetX', 'Desloc. X', 0.5),
      numIn('gridOffsetY', 'Desloc. Y', 0.5)),
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'mini toggle' }, h('input', { type: 'checkbox', checked: s.showGrid, onchange: (e) => upd({ showGrid: e.target.checked }) }), 'Mostrar grade'),
      h('label', { class: 'mini toggle' }, h('input', { type: 'checkbox', checked: s.snap, onchange: (e) => upd({ snap: e.target.checked }) }), 'Encaixar tokens na grade')),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn sm', onclick: async () => { const u = await chooseAndUpload(); if (u) upd({ img: u }); } }, 'Trocar imagem'),
      h('button', { class: 'btn sm ghost', onclick: fit }, 'Centralizar mapa')),
    h('p', { class: 'muted small' }, 'Dica: ajuste "Quadrado" até a grade coincidir com a do desenho do mapa; use o deslocamento para alinhar as linhas.'));
}

// ----------------------------------------------------------------- tokens
// Procura, a partir do centro da tela, o quadrado livre mais próximo (para não empilhar tokens)
function freeSpot(sc, size) {
  const g = sc.gridSize;
  const s = size * g;
  const c = viewCenter();
  const bx = Math.round((c.x - s / 2 - sc.gridOffsetX) / g) * g + sc.gridOffsetX;
  const by = Math.round((c.y - s / 2 - sc.gridOffsetY) / g) * g + sc.gridOffsetY;
  const taken = (x, y) => sc.tokens.some((t) => {
    const ts = t.size * g;
    return x < t.x + ts - 1 && x + s > t.x + 1 && y < t.y + ts - 1 && y + s > t.y + 1;
  });
  for (let r = 0; r < 15; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = bx + dx * g, y = by + dy * g;
        if (!taken(x, y)) return { x, y };
      }
    }
  }
  return { x: bx, y: by };
}

function npcForm() {
  const name = h('input', { placeholder: 'Nome (ex.: Goblin 1)', 'aria-label': 'Nome do NPC', required: true });
  const hp = h('input', { type: 'number', class: 'num', placeholder: 'PV', 'aria-label': 'PV' });
  const size = h('select', { 'aria-label': 'Tamanho' },
    [[0.5, 'Minúsculo'], [1, 'Pequeno/Médio'], [2, 'Grande'], [3, 'Enorme'], [4, 'Imenso']].map(([v, l]) => h('option', { value: String(v), selected: v === 1 }, l)));
  const hidden = h('input', { type: 'checkbox' });
  let img = '';
  const imgBtn = h('button', {
    type: 'button', class: 'btn sm',
    onclick: async () => { const u = await chooseAndUpload(); if (u) { img = u; imgBtn.textContent = 'Imagem ✓'; } },
  }, 'Imagem…');
  const form = h('form', {
    class: 'stack',
    onsubmit: async (e) => {
      e.preventDefault();
      const sc = app.state.scene;
      if (!sc) return toast('Crie/ative uma cena primeiro', 'error');
      const spot = freeSpot(app.state.scene, Number(size.value));
      const res = await emit('token:create', {
        sceneId: sc.id, name: name.value, img, size: Number(size.value), hidden: hidden.checked,
        hp: Number(hp.value) || 0, hpMax: Number(hp.value) || 0, x: spot.x, y: spot.y,
      });
      if (res) {
        // mantém o nome com número seguinte para criar vários iguais rápido (Goblin 1 → Goblin 2)
        name.value = name.value.replace(/(\d+)$/, (n) => String(Number(n) + 1));
      }
    },
  },
  h('div', { class: 'row gap' }, name, hp),
  h('div', { class: 'row gap wrap' }, size, imgBtn, h('label', { class: 'mini toggle' }, hidden, 'Oculto')),
  h('button', { class: 'btn primary', type: 'submit' }, 'Colocar no centro do mapa'));
  return form;
}

function charPlacement(state) {
  const sc = state.scene;
  if (!sc) return h('p', { class: 'muted small' }, 'Ative uma cena para colocar personagens.');
  if (!state.characters.length) return h('p', { class: 'muted small' }, 'Nenhum personagem criado.');
  return h('ul', { class: 'plain-list' }, state.characters.map((c) => {
    const tok = sc.tokens.find((t) => t.characterId === c.id);
    return h('li', { class: 'row gap' },
      avatar(c.img, c.name, app.user(c.ownerId)?.color, 28),
      h('span', { class: 'grow' }, c.name),
      tok
        ? h('button', { class: 'btn sm ghost', onclick: () => emit('token:delete', { sceneId: sc.id, id: tok.id }) }, 'Tirar do mapa')
        : h('button', {
          class: 'btn sm',
          onclick: () => {
            const p = freeSpot(app.state.scene, 1);
            emit('token:create', { sceneId: sc.id, characterId: c.id, name: c.name, size: 1, x: p.x, y: p.y });
          },
        }, 'Colocar no mapa'));
  }));
}

function tokenList(state) {
  const sc = state.scene;
  const npcs = sc ? sc.tokens.filter((t) => !t.characterId) : [];
  if (!npcs.length) return h('p', { class: 'muted small' }, 'Nenhum NPC nesta cena.');
  return h('ul', { class: 'plain-list' }, npcs.map((t) => h('li', { class: 'row gap' },
    avatar(t.img, t.name, t.hidden ? '#8a8796' : '#b0473e', 28),
    h('span', { class: 'grow' }, t.name, h('small', { class: 'muted' }, t.hpMax ? ` ${t.hp}/${t.hpMax}` : '')),
    h('button', { class: 'btn ghost sm', title: t.hidden ? 'Revelar' : 'Ocultar', onclick: () => emit('token:update', { sceneId: sc.id, id: t.id, patch: { hidden: !t.hidden } }) }, t.hidden ? '🙈' : '👁'),
    h('button', { class: 'btn ghost sm', title: 'Remover', onclick: () => emit('token:delete', { sceneId: sc.id, id: t.id }) }, '✕'))));
}

// --------------------------------------------------- jogadores/personagens
const ROLE = { gm: 'Mestre', player: 'Jogador', viewer: 'Telão (só assiste)' };

function userForm() {
  const name = h('input', { placeholder: 'Nome do jogador', 'aria-label': 'Nome', required: true });
  const pass = h('input', { placeholder: 'Senha', 'aria-label': 'Senha', required: true, minlength: '4' });
  const role = h('select', { 'aria-label': 'Papel' }, Object.entries(ROLE).filter(([k]) => k !== 'gm').map(([k, l]) => h('option', { value: k }, l)));
  const mkChar = h('input', { type: 'checkbox', checked: true });
  const charName = h('input', { placeholder: 'Nome do personagem', 'aria-label': 'Nome do personagem' });
  return h('form', {
    class: 'stack',
    onsubmit: async (e) => {
      e.preventDefault();
      const res = await emit('user:create', { name: name.value, password: pass.value, role: role.value });
      if (!res) return;
      if (mkChar.checked && role.value === 'player') {
        await emit('character:create', { name: charName.value || `Personagem de ${name.value}`, ownerId: res.id });
      }
      toast(`${name.value} pode entrar com a senha "${pass.value}"`, 'ok', 6000);
      name.value = ''; pass.value = ''; charName.value = '';
    },
  },
  h('div', { class: 'row gap' }, name, pass),
  h('div', { class: 'row gap wrap' }, role, h('label', { class: 'mini toggle' }, mkChar, 'Já criar personagem')),
  charName,
  h('button', { class: 'btn primary', type: 'submit' }, 'Criar usuário'));
}

function userList(state) {
  return h('ul', { class: 'plain-list' }, state.users.map((u) => h('li', { class: 'row gap' },
    h('span', { class: 'dot' + (u.online ? ' on' : ''), title: u.online ? 'Online' : 'Offline' }),
    h('span', { class: 'grow' }, h('b', { style: { color: u.color } }, u.name), h('small', { class: 'muted' }, ` · ${ROLE[u.role]}`)),
    h('button', {
      class: 'btn ghost sm', title: 'Trocar senha',
      onclick: () => { const p = prompt(`Nova senha para ${u.name}:`); if (p) emit('user:update', { id: u.id, password: p }).then((r) => r && toast('Senha alterada', 'ok')); },
    }, '🔑'),
    u.id === state.me.id ? null : h('button', {
      class: 'btn ghost sm', title: 'Excluir usuário',
      onclick: () => confirm(`Excluir ${u.name}? O personagem dele continua existindo, sem dono.`) && emit('user:delete', { id: u.id }),
    }, '✕'))));
}

function charList(state) {
  const players = state.users.filter((u) => u.role === 'player');
  const name = h('input', { placeholder: 'Nome do personagem / NPC importante', 'aria-label': 'Nome', required: true });
  const owner = h('select', { 'aria-label': 'Dono' }, h('option', { value: '' }, '— sem dono (NPC) —'), players.map((u) => h('option', { value: u.id }, u.name)));
  return h('div', { class: 'stack' },
    h('ul', { class: 'plain-list' }, state.characters.map((c) => h('li', { class: 'row gap' },
      avatar(c.img, c.name, app.user(c.ownerId)?.color, 28),
      h('span', { class: 'grow' }, c.name),
      h('select', {
        'aria-label': `Dono de ${c.name}`,
        onchange: (e) => emit('character:update', { id: c.id, patch: { ownerId: e.target.value || null } }),
      }, h('option', { value: '' }, '— sem dono —'), players.map((u) => h('option', { value: u.id, selected: u.id === c.ownerId }, u.name))),
      h('button', { class: 'btn ghost sm', title: 'Apagar personagem', onclick: () => confirm(`Apagar ${c.name}? (a ficha some)`) && emit('character:delete', { id: c.id }) }, '✕')))),
    h('form', {
      class: 'row gap',
      onsubmit: async (e) => {
        e.preventDefault();
        if (await emit('character:create', { name: name.value, ownerId: owner.value || null })) name.value = '';
      },
    }, name, owner, h('button', { class: 'btn sm', type: 'submit' }, 'Criar')));
}

async function downloadBackup() {
  const r = await fetch('/api/backup', { headers: { 'x-token': localStorage.getItem('tabula.token') || '' } });
  if (!r.ok) return toast('Não consegui gerar o backup', 'error');
  const blob = await r.blob();
  const a = h('a', { href: URL.createObjectURL(blob), download: `tabula-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ------------------------------------------------------------------ render
function slot(name) {
  parts[name] = h('div', { class: 'slot' });
  return parts[name];
}
function put(name, value, make) {
  if (isEditingIn(parts[name]) || !changed(name, value)) return;
  setKids(parts[name], make());
}

export function renderGM(state) {
  if (!app.isGM) { setKids(pane, ); built = false; return; }
  if (!built) {
    built = true;
    for (const k of Object.keys(keys)) delete keys[k];
    setKids(pane, 
      h('div', { class: 'pane-title' }, h('h2', {}, 'Mestre')),
      section('Cenas (mapas)', h('div', { class: 'stack' }, newSceneForm(), slot('scenes'))),
      section('Cena ativa', slot('settings'), false),
      section('Tokens', h('div', { class: 'stack' },
        h('h4', {}, 'Personagens'), slot('chars-on-map'),
        h('h4', {}, 'NPCs e monstros'), npcForm(), slot('npcs'))),
      section('Jogadores e personagens', h('div', { class: 'stack' },
        h('h4', {}, 'Usuários'), slot('users'), userForm(),
        h('h4', {}, 'Personagens'), slot('chars'))),
      section('Mesa', h('div', { class: 'stack' },
        h('button', { class: 'btn', onclick: downloadBackup }, '⬇ Baixar backup da campanha'),
        h('button', { class: 'btn ghost danger', onclick: () => confirm('Apagar todo o histórico de dados e mensagens?') && emit('chat:clear') }, 'Limpar histórico do chat')), false),
    );
  }
  put('scenes', [state.scenes, state.activeSceneId], () => sceneList(state));
  const sc = state.scene;
  put('settings', sc && [sc.id, sc.name, sc.gridSize, sc.gridOffsetX, sc.gridOffsetY, sc.showGrid, sc.snap], () => sceneSettings(state));
  put('chars-on-map', [sc?.id, sc?.tokens.filter((t) => t.characterId).map((t) => t.characterId), state.characters.map((c) => [c.id, c.name, c.img, c.ownerId]), state.users.map((u) => u.color)], () => charPlacement(state));
  put('npcs', sc?.tokens.filter((t) => !t.characterId).map((t) => [t.id, t.name, t.img, t.hidden, t.hp, t.hpMax]), () => tokenList(state));
  put('users', state.users, () => userList(state));
  put('chars', [state.characters.map((c) => [c.id, c.name, c.img, c.ownerId]), state.users.map((u) => [u.id, u.name, u.role, u.color])], () => charList(state));
}
