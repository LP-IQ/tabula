// Ficha de personagem (D&D 5e, simplificada). O jogador edita só a dele; o mestre, todas.
import { app, emit, rollD20, doRoll, bus, setAdv } from './core.js';
import { $, h, abilityMod, fmtMod, profBonus, debounce, chooseAndUpload, avatar, isEditingIn, toast, setKids } from './util.js';
import { focusToken } from './map.js';
import { CONDITIONS, CONDITION_ICON, CONDITION_LABEL, XP_LEVELS } from './rules.js';

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

// Ctrl+V com a ficha aberta: troca a imagem do personagem (e do token)
export function pasteToSheet(url) {
  const c = app.state?.characters.find((x) => x.id === builtFor);
  if (!c || !available().some((x) => x.id === c.id)) return false;
  patch(c, { img: url }).then((r) => r && toast('Imagem colada na ficha', 'ok'));
  return true;
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
  for (const k of Object.keys(extraKeys)) delete extraKeys[k];
  stripKey = '';
  const picker = h('div', { class: 'char-strip', role: 'tablist', 'aria-label': 'Escolher ficha', hidden: true });

  const avatarBtn = h('button', {
    class: 'avatar-btn', title: 'Trocar imagem (também vira o token) — ou copie uma imagem e aperte Ctrl+V aqui na ficha',
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

    h('div', { class: 'sx', id: 'sx-status' }),
    h('div', { class: 'sx', id: 'sx-aspect' }),

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
    h('details', { class: 'block' }, h('summary', {}, 'Magias'),
      h('div', { class: 'sx', id: 'sx-slots' }),
      field(c, 'spells', { multiline: true, rows: 6, label: 'Magias', placeholder: 'Truques e magias conhecidas/preparadas…' })),
    h('details', { class: 'block', open: true }, h('summary', {}, 'Dados de vida e descanso'), h('div', { class: 'sx', id: 'sx-hd' })),
    h('details', { class: 'block' }, h('summary', {}, 'Experiência e moedas'), h('div', { class: 'sx', id: 'sx-xp' })),
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


// ---------------------------------------------------- partes novas da ficha (v5)
const extraKeys = {};
function slotOf(id) { return pane.querySelector('#' + id); }
function redraw(id, key, make) {
  const el = slotOf(id);
  if (!el || isEditingIn(el) || extraKeys[id] === key) return;
  extraKeys[id] = key;
  setKids(el, make());
}

function statusBox(c) {
  const conds = c.conditions || [];
  const ds = c.deathSaves || { s: 0, f: 0 };
  const dying = c.hp <= 0 && c.hpMax > 0;
  const pips = (kind, n, label) => h('span', { class: `ds ${kind}`, title: label },
    [0, 1, 2].map((i) => h('button', {
      class: 'pip' + (i < n ? ' on' : ''), 'aria-label': `${label} ${i + 1}`,
      onclick: () => patch(c, { deathSaves: { ...ds, [kind]: i < n ? i : i + 1 } }),
    })));
  const deathRoll = async () => {
    const r = await doRoll('1d20', `${c.name} — teste contra a morte`);
    if (!r) return;
    const v = r.total;
    if (v === 20) { patch(c, { hp: 1, deathSaves: { s: 0, f: 0 }, conditions: conds.filter((x) => x !== 'inconsciente') }); toast('20 natural! Recupera 1 PV', 'ok'); return; }
    let { s, f } = ds;
    if (v === 1) f += 2; else if (v >= 10) s += 1; else f += 1;
    s = Math.min(3, s); f = Math.min(3, f);
    patch(c, { deathSaves: { s, f } });
    if (s >= 3) toast(`${c.name} está estável`, 'ok');
    if (f >= 3) toast(`${c.name} morreu…`, 'error', 6000);
  };
  return h('div', { class: 'status-box' + (dying ? ' dying' : '') },
    h('div', { class: 'row gap wrap' },
      h('small', { class: 'muted' }, 'Condições'),
      h('span', { class: 'grow' }),
      h('label', { class: 'mini toggle', title: 'Inspiração heroica' },
        h('input', { type: 'checkbox', checked: !!c.inspiration, onchange: (e) => patch(c, { inspiration: e.target.checked }) }), '✨ Inspiração')),
    h('div', { class: 'cond-picker' }, CONDITIONS.map((k) => {
      const on = conds.includes(k);
      return h('button', {
        class: 'cond' + (on ? ' on' : ''), title: CONDITION_LABEL[k], 'aria-label': CONDITION_LABEL[k], 'aria-pressed': String(on),
        onclick: () => patch(c, { conditions: on ? conds.filter((x) => x !== k) : [...conds, k] }),
      }, CONDITION_ICON[k]);
    })),
    conds.length ? h('div', { class: 'small' }, conds.map((k) => CONDITION_LABEL[k]).join(' · ')) : null,
    dying || ds.s || ds.f ? h('div', { class: 'row gap wrap death' },
      h('b', {}, '☠ Testes contra a morte'),
      h('span', {}, 'Sucessos '), pips('s', ds.s, 'Sucesso'),
      h('span', {}, 'Falhas '), pips('f', ds.f, 'Falha'),
      h('button', { class: 'btn sm', onclick: deathRoll }, '🎲 Rolar'),
      ds.s || ds.f ? h('button', { class: 'btn ghost sm', onclick: () => patch(c, { deathSaves: { s: 0, f: 0 } }) }, 'Zerar') : null) : null);
}

function aspectBox(c) {
  const gm = app.isGM;
  const up = (Number(c.level) || 1) >= 5;
  const card = (key, title, icon, fields) => {
    const v = c[key] || {};
    if (!gm && !v.name && !v.base) return null;
    if (gm) {
      const set = (f) => (e) => patch(c, { [key]: { ...app.char(c.id)[key], [f]: e.target.value } });
      return h('div', { class: 'gift edit' },
        h('div', { class: 'gift-title' }, icon, ' ', title, h('small', { class: 'muted' }, ' · só o mestre edita')),
        h('div', { class: 'row gap wrap' },
          fields.includes('month') ? h('input', { value: v.month || '', placeholder: 'Mês de nascimento', 'aria-label': 'Mês de nascimento', onchange: set('month') }) : null,
          h('input', { value: v.name || '', placeholder: 'Nome', 'aria-label': 'Nome', onchange: set('name') })),
        h('textarea', { rows: 2, value: v.base || '', placeholder: 'Efeito do nível 1 ao 4 (fraco, meio nonsense)', 'aria-label': 'Efeito base', onchange: set('base') }),
        h('textarea', { rows: 2, value: v.upgraded || '', placeholder: 'Efeito a partir do nível 5', 'aria-label': 'Efeito melhorado', onchange: set('upgraded') }));
    }
    return h('div', { class: 'gift' },
      h('div', { class: 'gift-title' }, icon, ' ', h('b', {}, v.name || title), v.month ? h('small', { class: 'muted' }, ` · ${v.month}`) : null),
      h('p', { class: up ? 'old' : 'now' }, v.base || '—'),
      v.upgraded ? h('p', { class: up ? 'now' : 'next' }, up ? v.upgraded : `No nível 5: ${v.upgraded}`) : null);
  };
  const a = card('aspect', 'Aspecto mágico', '✦', ['month']);
  const r = card('ring', 'Anel', '💍', []);
  if (!a && !r) return h('span');
  return h('div', { class: 'gifts' }, a, r);
}

function slotsBox(c) {
  const slots = c.slots || [];
  const set = (i, patchSlot) => {
    const cur = app.char(c.id).slots.map((x) => ({ ...x }));
    Object.assign(cur[i], patchSlot);
    cur[i].used = Math.min(cur[i].used, cur[i].max);
    patch(c, { slots: cur });
  };
  const shown = slots.map((sl, i) => ({ ...sl, i })).filter((sl) => sl.max > 0);
  const nextLevel = Math.min(9, (shown.length ? shown[shown.length - 1].i + 1 : 0) + 1);
  return h('div', { class: 'slots' },
    h('div', { class: 'row gap wrap' }, h('small', { class: 'muted' }, 'Espaços de magia — clique para gastar/recuperar')),
    shown.map((sl) => h('div', { class: 'slot-row' },
      h('b', {}, `${sl.i + 1}º`),
      h('span', { class: 'slot-pips' }, Array.from({ length: sl.max }, (_, j) => h('button', {
        class: 'pip' + (j < sl.used ? ' used' : ''), title: j < sl.used ? 'Gasto (clique para recuperar)' : 'Disponível (clique para gastar)',
        onclick: () => set(sl.i, { used: j < sl.used ? j : j + 1 }),
      }))),
      h('span', { class: 'muted small' }, `${sl.max - sl.used}/${sl.max}`),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn ghost sm', title: 'Menos um espaço', onclick: () => set(sl.i, { max: Math.max(0, sl.max - 1) }) }, '−'),
      h('button', { class: 'btn ghost sm', title: 'Mais um espaço', onclick: () => set(sl.i, { max: Math.min(9, sl.max + 1) }) }, '+'))),
    h('button', { class: 'btn sm', onclick: () => set(nextLevel - 1, { max: Math.max(1, (slots[nextLevel - 1]?.max || 0) + 1) }) },
      shown.length ? `+ Espaço de ${nextLevel}º círculo` : '+ Espaços de magia (1º círculo)'));
}

function hdBox(c) {
  const total = Math.max(1, Number(c.level) || 1);
  const left = Math.max(0, total - (c.hdUsed || 0));
  const con = abilityMod(c.attrs?.con);
  const spend = async () => {
    const cur = app.char(c.id);
    if (total - (cur.hdUsed || 0) <= 0) return toast('Sem dados de vida. Eles voltam no descanso longo.', 'error');
    const formula = `1${cur.hitDie || 'd8'}${con ? fmtMod(con) : ''}`;
    const r = await doRoll(formula, `${cur.name} — dado de vida (descanso curto)`);
    if (!r) return;
    const heal = Math.max(0, r.total);
    const now = app.char(c.id);
    patch(c, { hp: Math.min(now.hpMax, Math.max(0, now.hp) + heal), hdUsed: (now.hdUsed || 0) + 1 });
    toast(`+${heal} PV`, 'ok');
  };
  return h('div', { class: 'stack' },
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'mini' }, 'Dado',
        h('select', { onchange: (e) => patch(c, { hitDie: e.target.value }) },
          ['d6', 'd8', 'd10', 'd12'].map((d) => h('option', { value: d, selected: d === (c.hitDie || 'd8') }, d)))),
      h('span', {}, h('b', { class: 'big-inline' }, String(left)), ` de ${total} disponíveis`),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn sm primary', disabled: left <= 0, onclick: spend }, `☕ Gastar 1 (1${c.hitDie || 'd8'}${con ? fmtMod(con) : ''})`)),
    h('p', { class: 'muted small' }, 'No descanso curto, gaste dados de vida para recuperar PV. No descanso longo (o mestre marca), PV e espaços de magia voltam e você recupera metade dos dados de vida.'));
}

function xpBox(c) {
  const lvl = Math.max(1, Math.min(20, Number(c.level) || 1));
  const xp = c.xp || 0;
  const next = XP_LEVELS[lvl] ?? null;
  const reach = XP_LEVELS.filter((v) => xp >= v).length;
  const coins = c.coins || {};
  const coin = (k, label, title) => h('label', { class: 'mini col coin', title }, label,
    h('input', { type: 'number', class: 'num', min: '0', value: String(coins[k] || 0), 'aria-label': title,
      onchange: (e) => patch(c, { coins: { ...app.char(c.id).coins, [k]: Number(e.target.value) } }) }));
  return h('div', { class: 'stack' },
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'mini' }, 'XP', h('input', { type: 'number', class: 'num xp', min: '0', value: String(xp), onchange: (e) => patch(c, { xp: Number(e.target.value) }) })),
      next != null ? h('span', { class: 'muted small' }, `próximo nível em ${next.toLocaleString('pt-BR')} XP`) : h('span', { class: 'muted small' }, 'nível máximo')),
    next != null ? h('div', { class: 'hp-bar' }, h('i', { style: { width: `${Math.min(100, ((xp - XP_LEVELS[lvl - 1]) / (next - XP_LEVELS[lvl - 1])) * 100)}%`, background: 'var(--gold)' } })) : null,
    reach > lvl ? h('p', { class: 'level-up' }, `⬆ Já dá para subir para o nível ${reach}! Fale com o mestre.`) : null,
    h('div', { class: 'row gap wrap coins' },
      coin('pc', 'PC', 'Peças de cobre'), coin('pp', 'PP', 'Peças de prata'), coin('pe', 'PE', 'Peças de electrum'),
      coin('po', 'PO', 'Peças de ouro'), coin('pl', 'PL', 'Peças de platina')));
}

function renderExtras(c) {
  redraw('sx-status', JSON.stringify([c.conditions, c.inspiration, c.deathSaves, c.hp <= 0, c.name]), () => statusBox(c));
  redraw('sx-aspect', JSON.stringify([c.aspect, c.ring, c.level, app.isGM]), () => aspectBox(c));
  redraw('sx-slots', JSON.stringify(c.slots), () => slotsBox(c));
  redraw('sx-hd', JSON.stringify([c.level, c.hdUsed, c.hitDie, c.attrs?.con]), () => hdBox(c));
  redraw('sx-xp', JSON.stringify([c.xp, c.level, c.coins]), () => xpBox(c));
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
  renderExtras(c);
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
