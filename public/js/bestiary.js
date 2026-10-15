// Bestiário do mestre: fichas de NPCs e monstros, biblioteca do SRD, ajuste de ND e colocação no mapa.
import { app, emit, doRoll, rollD20, bus, setPrivate } from './core.js';
import { $, h, setKids, avatar, abilityMod, fmtMod, chooseAndUpload, openModal, toast, localRoll, isEditingIn } from './util.js';
import { CRS, crValue, xpFor, rescale, encounter, LEVELS, SIZE_SQUARES, avgDice } from './rules.js';
import { freeSpots, flashWhenReady } from './map.js';

const pane = $('#pane-bestiary');
const ATTR = [['str', 'FOR'], ['dex', 'DES'], ['con', 'CON'], ['int', 'INT'], ['wis', 'SAB'], ['cha', 'CAR']];
const ATTR_LONG = { str: 'Força', dex: 'Destreza', con: 'Constituição', int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma' };
const SIZES = ['Miúdo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Imenso'];
const fmtXp = (n) => n.toLocaleString('pt-BR');

let mode = 'mine';          // 'mine' | 'srd'
let viewing = null;         // { kind: 'mine'|'srd', id }
let query = '';
let crFilter = '';
let lastKey = '';
let srd = null;             // biblioteca carregada sob demanda
let srdLoading = null;
let srdError = '';

// Carrega a biblioteca uma vez. Se falhar, NÃO tenta de novo sozinho: mostra o erro e um botão.
function loadSrd() {
  if (srd) return Promise.resolve(srd);
  if (!srdLoading) {
    srdError = '';
    srdLoading = fetch('/data/srd-monstros.json')
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'o arquivo public/data/srd-monstros.json não está na pasta da mesa' : `erro ${r.status}`);
        return r.json();
      })
      .then((d) => {
        srd = d;
        srd.monsters.forEach((m, i) => { m.id = 'srd:' + m.srd; m._i = i; });
        return srd;
      })
      .catch((e) => { srdError = e.message || 'erro desconhecido'; return null; })
      .finally(() => { srdLoading = null; });
  }
  return srdLoading;
}

const mine = () => app.state?.monsters || [];
const findMine = (id) => mine().find((m) => m.id === id);
const findSrd = (id) => srd?.monsters.find((m) => m.id === id);

// ------------------------------------------------------- bloco de estatísticas
// Ficha no formato do Manual dos Monstros, com tudo clicável para rolar.
// who = nome usado nas rolagens (o nome do token, quando aberta pelo mapa)
export function statBlock(m, who = m.name) {
  const line = (label, value) => (value ? h('div', { class: 'sb-line' }, h('b', {}, label + ' '), value) : null);
  const rollBtn = (text, onclick, title) => h('button', { class: 'sb-roll', title, onclick }, text);
  const saves = Object.entries(m.saves || {});
  const block = (title, list, intro) => (list && list.length ? [
    title ? h('h4', { class: 'sb-section' }, title) : null,
    intro ? h('p', { class: 'sb-text muted' }, intro) : null,
    list.map((a) => h('div', { class: 'sb-ability' },
      h('div', { class: 'sb-ability-head' },
        h('b', { class: 'sb-ability-name' }, a.name + '.'),
        a.toHit != null ? rollBtn(`⚔ ${fmtMod(a.toHit)}`, () => rollD20(a.toHit, `${who} — ${a.name}`), 'Rolar o ataque') : null,
        a.damage ? rollBtn(`🎲 ${a.damage}`, () => doRoll(a.damage, `${who} — ${a.name} (dano${a.damageType ? ' ' + a.damageType : ''})`), 'Rolar o dano') : null,
        a.dc != null ? h('span', { class: 'sb-dc' }, `CD ${a.dc}`) : null),
      a.text ? h('div', { class: 'sb-text' }, a.text) : null)),
  ] : null);

  return h('div', { class: 'statblock' },
    h('div', { class: 'sb-top' },
      m.img ? avatar(m.img, m.name, '#b0473e', 64) : null,
      h('div', { class: 'grow' },
        h('h3', { class: 'sb-name' }, m.name, m.nameEn && m.nameEn !== m.name ? h('small', { class: 'muted' }, ` (${m.nameEn})`) : null),
        h('div', { class: 'sb-sub' }, [m.size, m.type].filter(Boolean).join(' ') + (m.alignment ? `, ${m.alignment}` : '')))),
    h('hr'),
    line('Classe de Armadura', `${m.ac}${m.acNote ? ` (${m.acNote})` : ''}`),
    h('div', { class: 'sb-line' }, h('b', {}, 'Pontos de Vida '), `${m.hp}`,
      m.hpFormula ? [' (', rollBtn(m.hpFormula, () => doRoll(m.hpFormula, `${who} — PV`), 'Rolar PV'), ')'] : null),
    line('Deslocamento', m.speed),
    h('hr'),
    h('div', { class: 'sb-attrs' }, ATTR.map(([k, l]) => h('button', {
      class: 'sb-attr', title: `Teste de ${ATTR_LONG[k]}`,
      onclick: () => rollD20(abilityMod(m.attrs[k]), `${who} — teste de ${ATTR_LONG[k]}`),
    }, h('small', {}, l), h('b', {}, String(m.attrs[k])), h('span', {}, fmtMod(abilityMod(m.attrs[k])))))),
    h('hr'),
    saves.length ? h('div', { class: 'sb-line' }, h('b', {}, 'Testes de Resistência '),
      saves.map(([k, v], i) => [i ? ', ' : '', rollBtn(`${ATTR.find((a) => a[0] === k)[1]} ${fmtMod(v)}`, () => rollD20(v, `${who} — resistência de ${ATTR_LONG[k]}`), 'Rolar')])) : null,
    (m.skills || []).length ? h('div', { class: 'sb-line' }, h('b', {}, 'Perícias '),
      m.skills.map((s, i) => [i ? ', ' : '', rollBtn(`${s.name} ${fmtMod(s.bonus)}`, () => rollD20(s.bonus, `${who} — ${s.name}`), 'Rolar')])) : null,
    line('Vulnerabilidades a Dano', m.vulnerabilities),
    line('Resistências a Dano', m.resistances),
    line('Imunidades a Dano', m.immunities),
    line('Imunidades a Condição', m.conditionImmunities),
    line('Sentidos', m.senses),
    line('Idiomas', m.languages),
    h('div', { class: 'sb-line' }, h('b', {}, 'Nível de Desafio '), `${m.cr} (${fmtXp(xpFor(m.cr))} XP)`),
    (m.traits || []).length ? h('hr') : null,
    block(null, m.traits),
    block('Ações', m.actions),
    block('Reações', m.reactions),
    block('Ações Lendárias', m.legendary, (m.legendary || []).length ? 'Pode realizar 3 ações lendárias, escolhendo entre as opções abaixo, ao final do turno de outra criatura.' : ''),
    m.notes ? [h('h4', { class: 'sb-section' }, 'Anotações do mestre'), h('div', { class: 'sb-text pre' }, m.notes)] : null,
    m.srd ? h('p', { class: 'muted tiny' }, 'Conteúdo do SRD 5.1 (CC-BY-4.0). Textos de habilidades especiais em inglês.') : null,
  );
}

function privateToggle() {
  const cb = h('input', { type: 'checkbox', checked: app.privateRolls, onchange: (e) => setPrivate(e.target.checked) });
  const sync = (e) => { cb.checked = e.detail; };
  bus.addEventListener('private', sync);
  return h('label', { class: 'mini toggle', title: 'As rolagens do monstro aparecem só para você' }, cb, 'Rolar oculto');
}

// Abre a ficha numa janela (usado pelo painel do token no mapa)
export function openStatBlock(monsterId, who) {
  const m = findMine(monsterId);
  if (!m) return toast('Esse token não tem ficha', 'error');
  openModal(m.name, [h('div', { class: 'row gap sb-toolbar' }, privateToggle()), statBlock(m, who)], { wide: true });
}

// ----------------------------------------------------------- editor
function editor(m0, onSaved) {
  const m = structuredClone(m0 || {
    name: '', size: 'Médio', type: '', alignment: '', ac: 12, acNote: '', hp: 10, hpFormula: '3d8',
    speed: '9 m', attrs: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, saves: {}, skills: [],
    vulnerabilities: '', resistances: '', immunities: '', conditionImmunities: '', senses: 'Percepção passiva 10',
    languages: 'Comum', cr: '1', traits: [], actions: [{ name: 'Ataque', text: '', toHit: 3, damage: '1d6+1' }], reactions: [], legendary: [], notes: '', img: '',
  });
  const inp = (key, attrs = {}) => h('input', {
    value: m[key] ?? '', ...attrs,
    oninput: (e) => { m[key] = attrs.type === 'number' ? Number(e.target.value) : e.target.value; },
  });
  const imgPrev = h('div', { class: 'img-prev' });
  const showImg = () => setKids(imgPrev, m.img ? [avatar(m.img, m.name, '#b0473e', 44), h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { m.img = ''; showImg(); } }, 'Tirar')] : h('span', { class: 'muted small' }, 'Sem imagem'));
  showImg();

  const listEditor = (key, label, withRolls) => {
    const box = h('div', { class: 'stack' });
    const draw = () => setKids(box, m[key].map((a, i) => h('div', { class: 'ab-edit' },
      h('div', { class: 'row gap' },
        h('input', { value: a.name, placeholder: 'Nome', 'aria-label': 'Nome', oninput: (e) => { a.name = e.target.value; } }),
        withRolls ? h('input', { type: 'number', class: 'num', value: a.toHit ?? '', placeholder: 'Atq', title: 'Bônus de ataque (vazio = não é ataque)', oninput: (e) => { a.toHit = e.target.value === '' ? null : Number(e.target.value); } }) : null,
        withRolls ? h('input', { class: 'dmg', value: a.damage ?? '', placeholder: 'Dano', title: 'Dano, ex.: 1d8+3', oninput: (e) => { a.damage = e.target.value; } }) : null,
        withRolls ? h('input', { type: 'number', class: 'num', value: a.dc ?? '', placeholder: 'CD', title: 'CD de resistência (opcional)', oninput: (e) => { a.dc = e.target.value === '' ? null : Number(e.target.value); } }) : null,
        h('button', { type: 'button', class: 'btn ghost sm', title: 'Remover', onclick: () => { m[key].splice(i, 1); draw(); } }, '✕')),
      h('textarea', { rows: 2, placeholder: 'Descrição', value: a.text || '', oninput: (e) => { a.text = e.target.value; } }))),
    h('button', { type: 'button', class: 'btn sm', onclick: () => { m[key].push({ name: '', text: '', ...(withRolls ? { toHit: null, damage: '' } : {}) }); draw(); } }, `+ ${label}`));
    draw();
    return box;
  };

  const saves = h('div', { class: 'row gap wrap' }, ATTR.map(([k, l]) => h('label', { class: 'mini' }, l,
    h('input', { type: 'number', class: 'num', value: m.saves?.[k] ?? '', placeholder: '—', oninput: (e) => { if (e.target.value === '') delete m.saves[k]; else m.saves[k] = Number(e.target.value); } }))));
  const skills = h('input', {
    value: (m.skills || []).map((s) => `${s.name} ${fmtMod(s.bonus)}`).join(', '),
    placeholder: 'Ex.: Furtividade +6, Percepção +3',
    oninput: (e) => {
      m.skills = e.target.value.split(',').map((x) => /^(.*?)\s*([+-]\d+)\s*$/.exec(x.trim())).filter(Boolean).map((r) => ({ name: r[1], bonus: Number(r[2]) }));
    },
  });

  const form = h('form', {
    class: 'stack monster-editor',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!m.name.trim()) return toast('Dê um nome à ficha', 'error');
      if (m.hpFormula && !m0?.hp) m.hp = Math.max(1, Math.floor(avgDice(m.hpFormula)) || m.hp);
      const res = m0?.id ? await emit('monster:update', { id: m0.id, patch: m }) : await emit('monster:create', m);
      if (res) { toast('Ficha salva', 'ok'); onSaved?.(m0?.id || res.id); }
    },
  },
  h('div', { class: 'row gap' }, h('label', { class: 'grow' }, 'Nome', inp('name', { required: true, maxlength: '80' })),
    h('label', {}, 'ND', h('select', { onchange: (e) => { m.cr = e.target.value; } }, CRS.map((c) => h('option', { value: c, selected: c === m.cr }, c))))),
  h('div', { class: 'row gap wrap' },
    h('label', {}, 'Tamanho', h('select', { onchange: (e) => { m.size = e.target.value; } }, SIZES.map((s) => h('option', { value: s, selected: s === m.size }, s)))),
    h('label', { class: 'grow' }, 'Tipo', inp('type', { placeholder: 'humanoide (goblinoide)' })),
    h('label', { class: 'grow' }, 'Tendência', inp('alignment', { placeholder: 'neutro e mau' }))),
  h('div', { class: 'row gap wrap' },
    h('label', {}, 'CA', inp('ac', { type: 'number', class: 'num' })),
    h('label', { class: 'grow' }, 'Nota da CA', inp('acNote', { placeholder: 'armadura de couro, escudo' })),
    h('label', {}, 'PV', inp('hp', { type: 'number', class: 'num' })),
    h('label', {}, 'Dados de vida', inp('hpFormula', { placeholder: '2d6', style: { width: '90px' } }))),
  h('label', {}, 'Deslocamento', inp('speed', { placeholder: '9 m, voo 18 m' })),
  h('div', { class: 'row gap wrap' }, ATTR.map(([k, l]) => h('label', { class: 'mini col' }, l,
    h('input', { type: 'number', class: 'num', value: m.attrs[k], oninput: (e) => { m.attrs[k] = Number(e.target.value); } })))),
  h('details', { class: 'block' }, h('summary', {}, 'Resistências, perícias, sentidos, idiomas'),
    h('div', { class: 'stack' },
      h('div', { class: 'small muted' }, 'Testes de resistência (deixe vazio os que não tem)'), saves,
      h('label', {}, 'Perícias', skills),
      h('label', {}, 'Vulnerabilidades a dano', inp('vulnerabilities')),
      h('label', {}, 'Resistências a dano', inp('resistances')),
      h('label', {}, 'Imunidades a dano', inp('immunities')),
      h('label', {}, 'Imunidades a condição', inp('conditionImmunities')),
      h('label', {}, 'Sentidos', inp('senses')),
      h('label', {}, 'Idiomas', inp('languages')))),
  h('h4', {}, 'Habilidades especiais'), listEditor('traits', 'Habilidade', false),
  h('h4', {}, 'Ações'), h('p', { class: 'muted small' }, 'Preencha "Atq" e "Dano" para o ataque ganhar botões de rolar.'), listEditor('actions', 'Ação', true),
  h('details', { class: 'block' }, h('summary', {}, 'Reações e ações lendárias'),
    h('div', { class: 'stack' }, h('h4', {}, 'Reações'), listEditor('reactions', 'Reação', true), h('h4', {}, 'Ações lendárias'), listEditor('legendary', 'Ação lendária', true))),
  h('label', {}, 'Anotações do mestre', h('textarea', { rows: 3, value: m.notes || '', oninput: (e) => { m.notes = e.target.value; } })),
  h('div', { class: 'row gap' }, h('span', {}, 'Imagem (vira o token)'), imgPrev,
    h('button', { type: 'button', class: 'btn sm', onclick: async () => { const u = await chooseAndUpload(); if (u) { m.img = u; showImg(); } } }, 'Escolher…')),
  h('div', { class: 'row gap' }, h('span', { class: 'grow' }), h('button', { class: 'btn primary', type: 'submit' }, m0?.id ? 'Salvar ficha' : 'Criar ficha')));
  return form;
}

function openEditor(m0) {
  const modal = openModal(m0?.id ? `Editar: ${m0.name}` : 'Nova ficha', editor(m0, (id) => { modal.close(); viewing = { kind: 'mine', id, pending: !findMine(id) }; mode = 'mine'; render(true); }), { wide: true });
}

// ----------------------------------------------------------- ajuste de ND
function openScale(m, kind) {
  const select = h('select', { 'aria-label': 'Novo ND' }, CRS.map((c) => h('option', { value: c, selected: c === m.cr }, c)));
  const preview = h('div', {});
  const party = partyLevels();
  let result = null;
  const draw = () => {
    if (select.value === m.cr) { result = null; setKids(preview, h('p', { class: 'muted' }, 'Escolha um ND diferente do atual.')); return; }
    result = rescale(m, select.value);
    const solo = party.length ? encounter(party, [select.value]) : null;
    setKids(preview,
      h('table', { class: 'scale-table' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Agora'), h('th', {}, 'Depois'))),
        h('tbody', {}, result.summary.map(([k, a, b]) => h('tr', {}, h('th', {}, k), h('td', {}, String(a)), h('td', {}, String(b)))))),
      solo ? h('p', { class: 'small' }, `Sozinho contra o grupo (${party.length} PJ, nível ${party.join('/')}): `,
        h('b', { class: `diff d${solo.level}` }, solo.level < 0 ? 'trivial' : LEVELS[solo.level])) : null,
      h('p', { class: 'muted small' }, 'CA, ataque e CD seguem a tabela do Livro do Mestre; PV e dano crescem na proporção do que os monstros oficiais desse ND costumam ter. Habilidades especiais não mudam. Confira e edite depois, se quiser.'));
  };
  select.addEventListener('change', draw);
  draw();
  const modal = openModal(`Ajustar ND: ${m.name}`, [
    h('div', { class: 'row gap' }, h('span', {}, `ND atual: ${m.cr}`), h('label', { class: 'mini' }, 'Novo ND', select)),
    preview,
    h('div', { class: 'row gap' }, h('span', { class: 'grow' }),
      h('button', {
        class: 'btn primary',
        onclick: async () => {
          if (!result) return;
          const copy = { ...result.monster };
          if (kind === 'srd') { copy.variantOf = null; }
          const res = await emit('monster:create', copy);
          if (res) {
            toast(`"${copy.name}" salvo no seu bestiário`, 'ok');
            modal.close();
            mode = 'mine'; viewing = { kind: 'mine', id: res.id, pending: true }; render(true);
          }
        },
      }, 'Salvar como nova ficha')),
  ], { wide: true });
}

// ----------------------------------------------------------- colocar no mapa
export function partyLevels() {
  const st = app.state;
  if (!st) return [];
  const players = new Set(st.users.filter((u) => u.role === 'player').map((u) => u.id));
  return st.characters.filter((c) => c.ownerId && players.has(c.ownerId)).map((c) => Number(c.level) || 1);
}

export function sceneEncounter(extraCrs = []) {
  const st = app.state;
  const crs = [];
  let unknown = 0;
  for (const t of st?.scene?.tokens || []) {
    if (t.characterId) continue;
    const m = t.monsterId && findMine(t.monsterId);
    if (!m) { unknown += 1; continue; }
    if (t.hp > 0) crs.push(m.cr);
  }
  const all = [...crs, ...extraCrs];
  return { levels: partyLevels(), crs: all, unknown, result: encounter(partyLevels(), all) };
}

function baseName(name) { return String(name).replace(/\s*\(ND [^)]*\)$/, ''); }

async function placeOnMap(m, kind) {
  const st = app.state;
  if (!st.scene) return toast('Crie ou ative uma cena primeiro (aba Mestre)', 'error');
  let monsterId = m.id;
  if (kind === 'srd') {
    // reaproveita a cópia que já existe no bestiário, se houver
    const existing = mine().find((x) => x.srd === m.srd && x.name === m.name);
    if (existing) monsterId = existing.id;
    else {
      const { id, _i, ...data } = m;
      const res = await emit('monster:create', data);
      if (!res) return;
      monsterId = res.id;
      toast(`"${m.name}" copiado para o seu bestiário`, 'ok');
    }
  }
  const qty = h('input', { type: 'number', class: 'num', min: '1', max: '30', value: '1' });
  const hidden = h('input', { type: 'checkbox' });
  const hpMode = h('select', {}, h('option', { value: 'avg' }, `Média (${m.hp})`), m.hpFormula ? h('option', { value: 'roll' }, `Rolar cada um (${m.hpFormula})`) : null);
  const diff = h('p', { class: 'small' });
  const drawDiff = () => {
    const n = Math.max(1, Math.min(30, Number(qty.value) || 1));
    const e = sceneEncounter(Array(n).fill(m.cr));
    if (!e.levels.length) return setKids(diff, h('span', { class: 'muted' }, 'Crie os personagens dos jogadores para ver a dificuldade.'));
    setKids(diff, 'Encontro na cena com eles: ', h('b', { class: `diff d${e.result.level}` }, e.result.level < 0 ? 'trivial' : LEVELS[e.result.level]),
      h('span', { class: 'muted' }, ` · ${fmtXp(e.result.adjusted)} XP ajustado`));
  };
  qty.addEventListener('input', drawDiff);
  drawDiff();
  const modal = openModal(`Colocar no mapa: ${m.name}`, [
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'mini' }, 'Quantos', qty),
      h('label', { class: 'mini' }, 'PV', hpMode),
      h('label', { class: 'mini toggle' }, hidden, 'Ocultos dos jogadores')),
    diff,
    h('div', { class: 'row gap' }, h('span', { class: 'grow' }),
      h('button', {
        class: 'btn primary',
        onclick: async () => {
          const n = Math.max(1, Math.min(30, Number(qty.value) || 1));
          const size = SIZE_SQUARES[m.size] ?? 1;
          const spots = freeSpots(n, size);
          const base = baseName(m.name);
          const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
          let next = Math.max(0, ...app.state.scene.tokens.map((t) => Number(re.exec(t.name)?.[1] || 0))) + 1;
          const tokens = spots.map((p) => ({
            name: n === 1 && next === 1 ? base : `${base} ${next++}`,
            x: p.x, y: p.y, size,
            hp: hpMode.value === 'roll' ? Math.max(1, localRoll(m.hpFormula)) : m.hp,
          }));
          const res = await emit('token:createMany', { sceneId: app.state.scene.id, monsterId, hidden: hidden.checked, tokens });
          if (res) {
            modal.close();
            res.ids.forEach((id) => flashWhenReady(id));
            toast(`${n} token(s) no mapa`, 'ok');
            document.body.dispatchEvent(new CustomEvent('show-map'));
          }
        },
      }, 'Colocar')),
  ]);
}

// ----------------------------------------------------------- lista e detalhe
function rowView(m, kind) {
  return h('li', {}, h('button', {
    class: 'monster-row', onclick: () => { viewing = { kind, id: m.id }; render(true); },
  },
  avatar(m.img, m.name, '#b0473e', 30),
  h('span', { class: 'grow' }, h('b', {}, m.name), h('small', { class: 'muted' }, ` ${m.type || ''}`)),
  h('span', { class: 'tag cat' }, `ND ${m.cr}`)));
}

function filtered(list) {
  const q = query.trim().toLocaleLowerCase('pt-BR');
  return list.filter((m) => (!crFilter || m.cr === crFilter)
    && (!q || `${m.name} ${m.nameEn || ''} ${m.type}`.toLocaleLowerCase('pt-BR').includes(q)));
}

function detail() {
  const kind = viewing.kind;
  const m = kind === 'srd' ? findSrd(viewing.id) : findMine(viewing.id);
  if (!m && viewing.pending) return h('p', { class: 'muted' }, 'Abrindo a ficha…');   // a ficha nova ainda está chegando do servidor
  if (!m) { viewing = null; return listView(); }
  viewing.pending = false;
  const back = h('button', { class: 'btn ghost sm', onclick: () => { viewing = null; render(true); } }, '← Voltar');
  const actions = kind === 'srd'
    ? [
      h('button', { class: 'btn primary sm', onclick: () => placeOnMap(m, 'srd') }, '⬤ Colocar no mapa'),
      h('button', {
        class: 'btn sm',
        onclick: async () => {
          const { id, _i, ...data } = m;
          const res = await emit('monster:create', data);
          if (res) { toast('Copiado para as suas fichas', 'ok'); mode = 'mine'; viewing = { kind: 'mine', id: res.id, pending: true }; render(true); }
        },
      }, '＋ Copiar para minhas fichas'),
      h('button', { class: 'btn sm', onclick: () => openScale(m, 'srd') }, '⇅ Ajustar ND'),
    ]
    : [
      h('button', { class: 'btn primary sm', onclick: () => placeOnMap(m, 'mine') }, '⬤ Colocar no mapa'),
      h('button', { class: 'btn sm', onclick: () => openScale(m, 'mine') }, '⇅ Ajustar ND'),
      h('button', { class: 'btn sm', onclick: () => openEditor(m) }, '✎ Editar'),
      h('button', {
        class: 'btn sm',
        onclick: async () => {
          const { id, createdAt, updatedAt, ...data } = m;
          const res = await emit('monster:create', { ...data, name: `${m.name} (cópia)` });
          if (res) { viewing = { kind: 'mine', id: res.id, pending: true }; render(true); }
        },
      }, '⧉ Duplicar'),
      h('button', { class: 'btn sm danger', onclick: () => confirm(`Apagar a ficha "${m.name}"? Os tokens no mapa continuam.`) && emit('monster:delete', { id: m.id }).then((r) => { if (r) { viewing = null; render(true); } }) }, 'Apagar'),
    ];
  return [
    h('div', { class: 'row gap' }, back, h('span', { class: 'grow' }), privateToggle()),
    h('div', { class: 'row gap wrap sb-actions' }, actions),
    statBlock(m),
  ];
}

function listView() {
  const tabs = h('div', { class: 'seg wide' },
    h('button', { class: 'seg-btn' + (mode === 'mine' ? ' on' : ''), onclick: () => { mode = 'mine'; render(true); } }, `Minhas fichas (${mine().length})`),
    h('button', { class: 'seg-btn' + (mode === 'srd' ? ' on' : ''), onclick: () => { mode = 'srd'; render(true); } }, 'Biblioteca SRD'));
  const search = h('input', {
    type: 'search', placeholder: mode === 'srd' ? 'Buscar (português ou inglês)…' : 'Buscar nas suas fichas…', value: query, 'aria-label': 'Buscar',
    oninput: (e) => { query = e.target.value; drawList(); },
  });
  const crSel = h('select', { 'aria-label': 'Filtrar por ND', onchange: (e) => { crFilter = e.target.value; drawList(); } },
    h('option', { value: '' }, 'Todo ND'), CRS.map((c) => h('option', { value: c, selected: c === crFilter }, `ND ${c}`)));
  const listEl = h('ul', { class: 'plain-list monster-list' });

  const drawList = () => {
    if (mode === 'srd') {
      if (!srd) {
        if (srdError) {
          setKids(listEl, h('li', { class: 'error-box' },
            h('p', {}, 'Não consegui carregar a biblioteca do SRD: ', h('b', {}, srdError), '.'),
            h('button', { class: 'btn sm', onclick: () => { srdError = ''; drawList(); } }, 'Tentar de novo')));
          return;
        }
        setKids(listEl, h('li', { class: 'muted' }, 'Carregando a biblioteca…'));
        if (!srdLoading) loadSrd().then(() => { if (mode === 'srd') drawList(); });
        return;
      }
      const list = filtered(srd.monsters).sort((a, b) => crValue(a.cr) - crValue(b.cr) || a.name.localeCompare(b.name, 'pt-BR'));
      setKids(listEl, list.slice(0, 150).map((m) => rowView(m, 'srd')),
        list.length > 150 ? h('li', { class: 'muted small' }, `Mostrando 150 de ${list.length}. Use a busca ou o filtro de ND.`) : null,
        !list.length ? h('li', { class: 'muted' }, 'Nada encontrado.') : null);
    } else {
      const list = filtered(mine()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setKids(listEl,
        !mine().length ? h('li', { class: 'empty-state' },
          h('p', {}, 'Nenhuma ficha ainda.'),
          h('p', { class: 'muted small' }, 'Crie uma do zero ou pegue um monstro pronto na Biblioteca SRD.')) : null,
        mine().length && !list.length ? h('li', { class: 'muted' }, 'Nada encontrado.') : null,
        list.map((m) => rowView(m, 'mine')));
    }
  };
  drawList();

  return [
    h('div', { class: 'pane-title' }, h('h2', {}, 'Bestiário'), h('button', { class: 'btn primary sm', onclick: () => openEditor(null) }, '+ Nova ficha')),
    encounterBox(),
    tabs,
    h('div', { class: 'row gap' }, search, crSel),
    listEl,
    mode === 'srd' ? h('p', { class: 'muted tiny' }, 'Monstros do System Reference Document 5.1 da Wizards of the Coast, licença CC-BY-4.0. Nomes dos mais comuns e textos de ataque em português; habilidades especiais em inglês.') : null,
  ];
}

// Medidor de dificuldade da cena ativa (Livro do Mestre, cap. 3)
export function encounterBox() {
  const st = app.state;
  if (!st?.scene) return null;
  const e = sceneEncounter();
  const r = e.result;
  if (!e.levels.length) return h('div', { class: 'encounter muted small' }, 'Dificuldade: crie os personagens dos jogadores para calcular.');
  const max = Math.max(r.party[3] * 1.25, r.adjusted, 1);
  return h('div', { class: 'encounter' },
    h('div', { class: 'row gap' },
      h('b', {}, 'Encontro na cena'),
      h('span', { class: `diff d${r.level}` }, !e.crs.length ? 'sem monstros' : r.level < 0 ? 'trivial' : LEVELS[r.level]),
      h('span', { class: 'grow' }),
      h('small', { class: 'muted' }, `${e.crs.length} monstro(s) · ${fmtXp(r.adjusted)} XP ajustado`)),
    h('div', { class: 'diff-bar' },
      r.party.map((v, i) => h('i', { class: `mark d${i}`, style: { left: `${(v / max) * 100}%` }, title: `${LEVELS[i]}: ${fmtXp(v)} XP` })),
      h('span', { class: `fill d${r.level}`, style: { width: `${Math.min(100, (r.adjusted / max) * 100)}%` } })),
    h('div', { class: 'diff-legend' }, r.party.map((v, i) => h('span', { class: `d${i}` }, `${LEVELS[i]} ${fmtXp(v)}`))),
    e.unknown ? h('div', { class: 'muted tiny' }, `${e.unknown} token(s) sem ficha do bestiário não entram na conta.`) : null);
}

function render(force) {
  if (!app.isGM) { setKids(pane); return; }
  if (!force && isEditingIn(pane)) return;
  setKids(pane, viewing ? detail() : listView());
  if (force) pane.scrollTop = 0;
}

export function renderBestiary(state) {
  if (!app.isGM) { if (pane.childElementCount) setKids(pane); return; }
  const key = JSON.stringify([state.monsters, viewing ? null : state.scene?.tokens.map((t) => [t.monsterId, t.hp > 0]), viewing, state.characters.map((c) => [c.level, c.ownerId])]);
  if (key === lastKey) return;
  lastKey = key;
  render(false);
}
