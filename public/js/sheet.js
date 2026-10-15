// Ficha de personagem (D&D 5e, simplificada). O jogador edita só a dele; o mestre, todas.
import { app, emit, rollD20, doRoll, bus, setAdv } from './core.js';
import { $, h, abilityMod, fmtMod, profBonus, debounce, chooseAndUpload, avatar, isEditingIn, toast, setKids } from './util.js';
import { focusToken } from './map.js';

const pane = $('#pane-sheet');

export const ATTRS = [
  ['str', 'FOR', 'Força'], ['dex', 'DES', 'Destreza'], ['con', 'CON', 'Constituição'],
  ['int', 'INT', 'Inteligência'], ['wis', 'SAB', 'Sabedoria'], ['cha', 'CAR', 'Carisma'],
];
const SKILLS = [
  ['acrobatics', 'Acrobacia', 'dex'], ['animal', 'Adestrar Animais', 'wis'], ['arcana', 'Arcanismo', 'int'],
  ['athletics', 'Atletismo', 'str'], ['performance', 'Atuação', 'cha'], ['deception', 'Enganação', 'cha'],
  ['stealth', 'Furtividade', 'dex'], ['history', 'História', 'int'], ['intimidation', 'Intimidação', 'cha'],
  ['insight', 'Intuição', 'wis'], ['investigation', 'Investigação', 'int'], ['medicine', 'Medicina', 'wis'],
  ['nature', 'Natureza', 'int'], ['perception', 'Percepção', 'wis'], ['persuasion', 'Persuasão', 'cha'],
  ['sleight', 'Prestidigitação', 'dex'], ['religion', 'Religião', 'int'], ['survival', 'Sobrevivência', 'wis'],
];
const ATTR_LABEL = Object.fromEntries(ATTRS.map(([k, s]) => [k, s]));
const PROF_ICON = ['○', '●', '◉'];
const PROF_TITLE = ['Sem proficiência', 'Proficiente', 'Especialista (dobro)'];

let currentId = localStorage.getItem('tabula.sheet') || null;
let builtFor = null;
let attacksKey = '';

function available() {
  const s = app.state;
  if (!s) return [];
  return app.isGM ? s.characters : s.characters.filter((c) => c.ownerId === s.me.id);
}

// ---------------------------------------------- salvamento (automático)
const STATUS = { editing: '✎ Editando…', saving: 'Salvando…', saved: '✓ Salvo', error: '⚠ Não salvou' };
let pendingSaves = 0;
function setStatus(kind) {
  const el = pane.querySelector('.save-status');
  if (!el) return;
  el.dataset.kind = kind;
  el.textContent = STATUS[kind];
}

function patch(c, p) {
  const id = typeof c === 'string' ? c : c.id;
  pendingSaves += 1;
  setStatus('saving');
  return emit('character:update', { id, patch: p }).then((r) => {
    pendingSaves -= 1;
    if (!pendingSaves) setStatus(r ? 'saved' : 'error');
    return r;
  });
}

const textSenders = new Map();
function textSender(field) {
  if (!textSenders.has(field)) {
    textSenders.set(field, debounce((id, value) => patch(id, { [field]: value }), 700));
  }
  return textSenders.get(field);
}

// Abre a ficha de um personagem (usado pela fileira de retratos e pelo painel do mestre)
export function openSheet(id) {
  currentId = id;
  localStorage.setItem('tabula.sheet', id);
  if (app.state) renderSheet(app.state);
}

let stripKey = '';
function renderStrip(c) {
  const slot = pane.querySelector('.char-strip');
  if (!slot) return;
  const chars = available();
  const key = JSON.stringify([c.id, chars.map((x) => [x.id, x.name, x.img, x.ownerId])]);
  if (key === stripKey) return;
  stripKey = key;
  slot.hidden = chars.length < 2;
  setKids(slot, chars.map((x) => {
    const owner = x.ownerId ? app.user(x.ownerId) : null;
    return h('button', {
      class: 'char-pick' + (x.id === c.id ? ' on' : ''),
      role: 'tab',
      'aria-selected': String(x.id === c.id),
      title: owner ? `${x.name} — ${owner.name}` : `${x.name} (sem dono)`,
      onclick: () => openSheet(x.id),
    }, avatar(x.img, x.name, owner?.color, 40), h('span', {}, x.name));
  }));
}

// ------------------------------------------------------------------ helpers
function field(c, key, opts = {}) {
  const el = h(opts.multiline ? 'textarea' : 'input', {
    'data-f': key,
    type: opts.type || (opts.multiline ? null : 'text'),
    class: opts.class || null,
    placeholder: opts.placeholder || null,
    'aria-label': opts.label || key,
    rows: opts.rows || null,
    inputmode: opts.type === 'number' ? 'numeric' : null,
  });
  if (opts.multiline) {
    el.addEventListener('input', () => { setStatus('editing'); textSender(key)(c.id, el.value); });
    el.addEventListener('blur', () => textSender(key).flush(c.id, el.value));
  } else {
    el.addEventListener('change', () => {
      const v = opts.type === 'number' ? Number(el.value) : el.value;
      patch(c, { [key]: v });
    });
  }
  return el;
}

function skillTotal(c, key, attr) {
  const p = c.skills?.[key] || 0;
  return abilityMod(c.attrs[attr]) + p * profBonus(c.level);
}
function saveTotal(c, attr) {
  return abilityMod(c.attrs[attr]) + (c.saves?.[attr] ? profBonus(c.level) : 0);
}
function initTotal(c) { return abilityMod(c.attrs.dex) + (c.initBonus || 0); }

// --------------------------------------------------------------- construção
function build(c) {
  builtFor = c.id;
  attacksKey = '';
  stripKey = '';
  const picker = h('div', { class: 'char-strip', role: 'tablist', 'aria-label': 'Escolher ficha', hidden: true });

  const avatarBtn = h('button', {
    class: 'avatar-btn', title: 'Trocar imagem (também vira o token)',
    onclick: async () => { const url = await chooseAndUpload(); if (url) patch(c, { img: url }); },
  });

  const advSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Próxima rolagem de d20' },
    [['dis', 'Desvantagem'], ['normal', 'Normal'], ['adv', 'Vantagem']].map(([m, l]) =>
      h('button', { class: 'seg-btn', dataset: { adv: m }, onclick: () => setAdv(m) }, l)));

  const hpAmount = h('input', { type: 'number', class: 'num', min: '0', placeholder: '0', 'aria-label': 'Quantidade' });
  const applyHp = (kind) => {
    const n = Math.abs(Number(hpAmount.value) || 0);
    if (!n) return hpAmount.focus();
    const cur = app.char(c.id);
    if (kind === 'dmg') {
      const fromTemp = Math.min(cur.hpTemp || 0, n);
      patch(c, { hpTemp: (cur.hpTemp || 0) - fromTemp, hp: cur.hp - (n - fromTemp) });
    } else {
      patch(c, { hp: Math.min(cur.hpMax, Math.max(0, cur.hp) + n) });
    }
    hpAmount.value = '';
  };

  setKids(pane, 
    picker,
    h('div', { class: 'sheet-head' },
      avatarBtn,
      h('div', { class: 'sheet-id' },
        field(c, 'name', { class: 'title-input', label: 'Nome' }),
        h('div', { class: 'row gap wrap' },
          field(c, 'race', { placeholder: 'Raça', label: 'Raça' }),
          field(c, 'class', { placeholder: 'Classe', label: 'Classe' }),
          h('label', { class: 'mini' }, 'Nível', field(c, 'level', { type: 'number', class: 'num', label: 'Nível' }))),
        h('div', { class: 'row gap wrap sheet-meta' },
          h('button', {
            class: 'link',
            onclick: () => {
              if (focusToken(c.id)) document.body.dispatchEvent(new CustomEvent('show-map'));
              else toast('Esse personagem não está na cena atual');
            },
          }, '◎ Achar no mapa'),
          h('span', { class: 'save-status', dataset: { kind: 'saved' }, title: 'A ficha salva sozinha a cada alteração' }, '✓ Salvo')))),

    h('div', { class: 'stat-row' },
      h('div', { class: 'stat' }, h('small', {}, 'CA'), field(c, 'ac', { type: 'number', class: 'big num', label: 'Classe de Armadura' })),
      h('div', { class: 'stat' }, h('small', {}, 'Iniciativa'),
        h('button', { class: 'big roll', 'data-d': 'init', onclick: () => rollD20(initTotal(app.char(c.id)), `Iniciativa — ${app.char(c.id).name}`) })),
      h('div', { class: 'stat' }, h('small', {}, 'Desloc.'), field(c, 'speed', { class: 'big', label: 'Deslocamento' })),
      h('div', { class: 'stat' }, h('small', { title: 'Bônus de Proficiência (Proficiency Bonus)' }, 'Prof.'), h('span', { class: 'big', 'data-d': 'prof' }))),

    h('div', { class: 'hp-box' },
      h('div', { class: 'hp-main' },
        h('small', {}, 'Pontos de Vida'),
        h('div', { class: 'hp-nums' },
          field(c, 'hp', { type: 'number', class: 'num hp-cur', label: 'PV atuais' }),
          h('span', {}, '/'),
          field(c, 'hpMax', { type: 'number', class: 'num', label: 'PV máximos' }),
          h('label', { class: 'mini' }, 'Temp.', field(c, 'hpTemp', { type: 'number', class: 'num', label: 'PV temporários' }))),
        h('div', { class: 'hp-bar' }, h('i', { 'data-d': 'hpbar' }))),
      h('div', { class: 'hp-apply' }, hpAmount,
        h('button', { class: 'btn sm danger', onclick: () => applyHp('dmg') }, 'Dano'),
        h('button', { class: 'btn sm ok', onclick: () => applyHp('heal') }, 'Cura'))),

    h('div', { class: 'section-title' }, h('span', {}, 'Próximo d20'), advSeg),

    h('div', { class: 'attrs' }, ATTRS.map(([k, short, long]) =>
      h('div', { class: 'attr' },
        h('small', { title: long }, short),
        h('button', { class: 'attr-mod roll', 'data-d': `mod.${k}`, title: `Teste de ${long}`, onclick: () => rollD20(abilityMod(app.char(c.id).attrs[k]), `Teste de ${long}`) }),
        h('input', {
          type: 'number', class: 'num attr-score', 'data-f': `attrs.${k}`, 'aria-label': long, inputmode: 'numeric',
          onchange: (e) => patch(c, { attrs: { ...app.char(c.id).attrs, [k]: Number(e.target.value) } }),
        }),
        h('label', { class: 'save', title: `Resistência de ${long} (Saving Throw)` },
          h('input', {
            type: 'checkbox', 'data-f': `saves.${k}`,
            onchange: (e) => patch(c, { saves: { ...app.char(c.id).saves, [k]: e.target.checked } }),
          }),
          h('button', { class: 'roll tiny', 'data-d': `save.${k}`, onclick: (e) => { e.preventDefault(); rollD20(saveTotal(app.char(c.id), k), `Resistência de ${long}`); } }))))),

    h('details', { class: 'block', open: true },
      h('summary', {}, 'Perícias'),
      h('div', { class: 'skills' }, SKILLS.map(([k, name, attr]) =>
        h('div', { class: 'skill' },
          h('button', {
            class: 'prof', 'data-d': `prof.${k}`,
            onclick: () => {
              const cur = app.char(c.id);
              const next = ((cur.skills?.[k] || 0) + 1) % 3;
              patch(c, { skills: { ...cur.skills, [k]: next } });
            },
          }),
          h('span', { class: 'skill-name' }, name, h('small', {}, ` ${ATTR_LABEL[attr]}`)),
          h('button', { class: 'roll', 'data-d': `skill.${k}`, onclick: () => rollD20(skillTotal(app.char(c.id), k, attr), name) }))))),

    h('details', { class: 'block', open: true },
      h('summary', {}, 'Ataques'),
      h('div', { class: 'attacks', id: 'attacks' }),
      h('button', {
        class: 'btn sm', onclick: () => {
          const cur = app.char(c.id);
          patch(c, { attacks: [...(cur.attacks || []), { name: 'Novo ataque', bonus: 0, damage: '1d6' }] });
        },
      }, '+ Ataque')),

    h('details', { class: 'block' }, h('summary', {}, 'Características e talentos'), field(c, 'features', { multiline: true, rows: 6, label: 'Características' })),
    h('details', { class: 'block' }, h('summary', {}, 'Magias'), field(c, 'spells', { multiline: true, rows: 6, label: 'Magias' })),
    h('details', { class: 'block' }, h('summary', {}, 'Inventário'), field(c, 'inventory', { multiline: true, rows: 5, label: 'Inventário' })),
    h('details', { class: 'block' }, h('summary', {}, 'Anotações'), field(c, 'notes', { multiline: true, rows: 6, label: 'Anotações' })),
    h('label', { class: 'mini muted' }, 'Bônus extra de iniciativa', field(c, 'initBonus', { type: 'number', class: 'num', label: 'Bônus extra de iniciativa' })),
  );
  syncAdv();
}

function renderAttacks(c) {
  const box = $('#attacks', pane);
  if (!box) return;
  const key = JSON.stringify(c.attacks || []);
  if (key === attacksKey || isEditingIn(box)) return;
  attacksKey = key;
  const list = c.attacks || [];
  const set = (i, f, v) => {
    const cur = app.char(c.id).attacks.map((a) => ({ ...a }));
    cur[i][f] = v;
    patch(c, { attacks: cur });
  };
  setKids(box, 
    list.length ? null : h('p', { class: 'muted small' }, 'Nenhum ataque ainda.'),
    list.map((a, i) => h('div', { class: 'attack' },
      h('input', { value: a.name, 'aria-label': 'Nome do ataque', onchange: (e) => set(i, 'name', e.target.value) }),
      h('input', { type: 'number', class: 'num', value: String(a.bonus), title: 'Bônus de ataque', 'aria-label': 'Bônus de ataque', onchange: (e) => set(i, 'bonus', Number(e.target.value)) }),
      h('input', { class: 'dmg', value: a.damage, title: 'Dano (ex.: 1d8+3)', 'aria-label': 'Dano', onchange: (e) => set(i, 'damage', e.target.value) }),
      h('button', { class: 'btn sm', title: 'Rolar ataque', onclick: () => rollD20(a.bonus, `${a.name} — ataque`) }, '⚔'),
      h('button', { class: 'btn sm', title: 'Rolar dano', onclick: () => a.damage && doRoll(a.damage, `${a.name} — dano`) }, '🎲'),
      h('button', {
        class: 'btn ghost sm', title: 'Apagar',
        onclick: () => patch(c, { attacks: app.char(c.id).attacks.filter((_, j) => j !== i) }),
      }, '✕'))),
  );
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function fill(c) {
  for (const el of pane.querySelectorAll('[data-f]')) {
    if (el === document.activeElement) continue;
    const v = getPath(c, el.dataset.f);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.value !== String(v ?? '')) el.value = v ?? '';
  }
  const set = (sel, txt) => { const el = pane.querySelector(`[data-d="${sel}"]`); if (el) el.textContent = txt; };
  set('init', fmtMod(initTotal(c)));
  set('prof', fmtMod(profBonus(c.level)));
  for (const [k] of ATTRS) {
    set(`mod.${k}`, fmtMod(abilityMod(c.attrs[k])));
    set(`save.${k}`, fmtMod(saveTotal(c, k)));
  }
  for (const [k, , attr] of SKILLS) {
    const p = c.skills?.[k] || 0;
    const btn = pane.querySelector(`[data-d="prof.${k}"]`);
    if (btn) { btn.textContent = PROF_ICON[p]; btn.title = PROF_TITLE[p]; btn.dataset.level = p; }
    set(`skill.${k}`, fmtMod(skillTotal(c, k, attr)));
  }
  const bar = pane.querySelector('[data-d="hpbar"]');
  if (bar) {
    const r = c.hpMax ? Math.max(0, Math.min(1, c.hp / c.hpMax)) : 0;
    bar.style.width = r * 100 + '%';
    bar.dataset.level = r <= 0 ? 'down' : r <= 0.5 ? 'low' : 'ok';
  }
  const ab = pane.querySelector('.avatar-btn');
  if (ab && ab.dataset.img !== (c.img || '') + c.name) {
    ab.dataset.img = (c.img || '') + c.name;
    setKids(ab, avatar(c.img, c.name, app.user(c.ownerId)?.color, 72), h('span', { class: 'avatar-edit' }, '✎'));
  }
  renderAttacks(c);
}

function syncAdv() {
  for (const b of pane.querySelectorAll('[data-adv]')) b.classList.toggle('on', b.dataset.adv === app.advMode);
}
bus.addEventListener('adv', syncAdv);

export function renderSheet(state) {
  const chars = available();
  if (!chars.length) {
    builtFor = null;
    setKids(pane, h('div', { class: 'empty-state' },
      h('p', {}, app.isGM ? 'Nenhum personagem criado ainda.' : 'O mestre ainda não vinculou um personagem a você.'),
      app.isGM ? h('p', { class: 'muted' }, 'Crie personagens na aba "Mestre" → Jogadores e personagens.') : null));
    return;
  }
  let c = chars.find((x) => x.id === currentId) || chars[0];
  currentId = c.id;
  if (builtFor !== c.id || !pane.querySelector('.sheet-head')) build(c);
  renderStrip(c);
  fill(c);
}
