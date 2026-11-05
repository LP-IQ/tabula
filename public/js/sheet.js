// Ficha de personagem (D&D 5e, simplificada). O jogador edita só a dele; o mestre, todas.
import { app, emit, rollD20, doRoll, bus, setAdv } from './core.js';
import { $, h, abilityMod, fmtMod, profBonus, debounce, chooseAndUpload, avatar, isEditingIn, toast, setKids, openModal } from './util.js';
import { focusToken } from './map.js';
import { CONDITIONS, CONDITION_ICON, CONDITION_LABEL, XP_LEVELS, CLASSES, classDie, dieAverage, prereqProblems, suggestSlots } from './rules.js';
import { equipmentBox, dollView } from './equipment.js';
import { computeAc, weaponAttacks } from './itemdata.js';
import { openWindow, getWindow, isMobile, activeWindow } from './windows.js';
import { openSpellPicker, openSpellById } from './library.js';

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

export function createSheet(pane, opts = {}) {
  const extraKeys = {};
  let currentId = opts.fixedId || localStorage.getItem('tabula.sheet') || null;
  let builtFor = null;
  let attacksKey = '';


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
  function paste(url) {
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
  function openSheet(id) {
    currentId = id;
    if (!opts.fixedId) localStorage.setItem('tabula.sheet', id);
    if (app.state) render(app.state);
  }

  let stripKey = '';
  function renderStrip(c) {
    const slot = pane.querySelector('.char-strip');
    if (!slot) return;
    const chars = available();
    const key = JSON.stringify([c.id, chars.map((x) => [x.id, x.name, x.img, x.ownerId])]);
    if (key === stripKey) return;
    stripKey = key;
    slot.hidden = chars.length < 2 || !!opts.fixedId;
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

  // Classe: sugere as do Livro do Jogador e já define o dado de vida
  function classField(c) {
    const el = h('input', { 'data-f': 'class', list: 'tabula-classes', placeholder: 'Classe', 'aria-label': 'Classe', autocomplete: 'off' });
    el.addEventListener('change', async () => {
      const before = app.char(c.id)?.hitDie;
      const r = await patch(c, { class: el.value });
      const die = classDie(el.value);
      if (r && die && before !== 'd' + die) toast(`Dado de vida: d${die}`, 'ok');
    });
    return el;
  }

  // PV pela classe: liga o cálculo, mostra os níveis pendentes e rola (ou pega a média) para cada um
  // PV por nível de cada classe (espelho de server/classes.js)
  function hpInfo(c) {
    const classes = c.classes?.length ? c.classes : [{ id: '_', name: c.class, level: c.level, die: Number(String(c.hitDie || 'd8').slice(1)) || 8 }];
    const entries = (c.hpRolls || []).map((r) => (typeof r === 'number' ? { cid: classes[0].id, v: r } : r));
    const per = classes.map((k, i) => {
      const done = entries.filter((r) => r.cid === k.id);
      const need = k.level - (i === 0 ? 1 : 0);
      return { ...k, first: i === 0, done: done.slice(0, need).map((r) => r.v), pending: Math.max(0, need - done.length) };
    });
    return { classes: per, pending: per.filter((k) => k.pending > 0) };
  }

  // PV pela classe: liga o cálculo, mostra os níveis pendentes e rola (ou pega a média) para cada um
  function hpClassBox(c) {
    const info = hpInfo(c);
    const multi = info.classes.length > 1;
    const first = info.classes[0];
    const con = abilityMod(c.attrs?.con);
    const per = con + (Number(c.hpBonus) || 0);
    const rule = app.state.rules?.hp || 'choose';
    const known = info.classes.some((k) => classDie(k.name));
    const sign = (n) => (n ? `${n > 0 ? ' + ' : ' − '}${Math.abs(n)}` : '');
    if (!c.hpAuto) {
      return h('div', { class: 'hpclass off' },
        h('span', { class: 'muted small grow' }, known
          ? `PV pela classe: ${first.die} no 1º nível, depois o dado de cada classe por nível (rolar ou média) + CON.`
          : 'Escolha a classe para os PV seguirem o dado de vida dela.'),
        h('button', {
          class: 'btn sm',
          onclick: async () => {
            const ok = confirm(`Calcular os PV pela classe?\n\n1º nível: ${first.die}${sign(per)}. A cada nível seguinte: o dado da classe daquele nível (ou a média)${sign(per)}.\n\nOs PV máximos digitados (${c.hpMax}) passam a ser calculados. Se o personagem já tem nível acima de 1, você ganha os PV de cada nível agora.`);
            if (ok) await emit('hp:auto', { charId: c.id, on: true });
          },
        }, `❤ PV pela classe (d${first.die})`));
    }
    const canRoll = rule !== 'avg' || app.isGM;
    const canAvg = rule !== 'roll' || app.isGM;
    const next = info.pending[0];
    const lvlLabel = (k) => {
      const n = k.done.length + (k.first ? 2 : 1);
      return multi ? `${k.name || 'Classe'} ${n}` : `${n}º nível`;
    };
    const totalPending = info.pending.reduce((s, k) => s + k.pending, 0);
    const history = info.classes.map((k) => {
      const vals = [...(k.first ? [k.die] : []), ...k.done];
      return multi ? `${k.name || '?'}: ${vals.join(' · ') || '—'}` : vals.map((v, i) => `${i + 1}º ${v}`).join(' · ');
    }).join('  |  ');
    return h('div', { class: 'hpclass' + (next ? ' pending' : '') },
      next ? h('div', { class: 'level-gain' },
        h('b', {}, `⬆ ${lvlLabel(next)}: ganhe os PV`),
        totalPending > 1 ? h('span', { class: 'muted small' }, ` (faltam ${totalPending} níveis)`) : null,
        h('div', { class: 'row gap wrap' },
          canRoll ? h('button', {
            class: 'btn sm primary',
            onclick: async () => { const r = await emit('hp:level', { charId: c.id, mode: 'roll', cid: next.id }); if (r) toast(`+${r.gain} PV`, 'ok'); },
          }, `🎲 Rolar 1d${next.die}${sign(per)}`) : null,
          canAvg ? h('button', {
            class: 'btn sm' + (canRoll ? '' : ' primary'),
            onclick: async () => { const r = await emit('hp:level', { charId: c.id, mode: 'avg', cid: next.id }); if (r) toast(`+${r.gain} PV`, 'ok'); },
          }, `Média: ${dieAverage(next.die)}${sign(per)} = ${Math.max(1, dieAverage(next.die) + per)}`) : null),
        rule !== 'choose' && !app.isGM ? h('span', { class: 'muted tiny' }, rule === 'roll' ? 'Nesta mesa os PV são rolados.' : 'Nesta mesa os PV são a média fixa.') : null) : null,
      h('div', { class: 'row gap wrap hp-rule' },
        h('span', { class: 'small' }, `❤ PV pela classe · ${multi ? info.classes.map((k) => 'd' + k.die).join('/') : 'd' + first.die} · CON ${fmtMod(con)}`),
        h('span', { class: 'muted tiny grow', title: `O que cada nível rendeu no dado (sem a CON): ${history}` }, history),
        h('label', { class: 'mini', title: 'PV extras por nível: anão da colina +1, talento Robusto +2, feiticeiro dracônico +1…' }, 'Bônus/nível',
          h('input', { type: 'number', class: 'num', min: '-5', max: '10', value: String(c.hpBonus || 0), onchange: (e) => patch(c, { hpBonus: Number(e.target.value) }) })),
        app.isGM && (c.hpRolls || []).length ? h('button', { class: 'btn ghost sm', title: 'Desfazer a última rolagem de PV (só o mestre)', onclick: () => confirm('Desfazer a última rolagem de PV deste personagem?') && emit('hp:undo', { charId: c.id }) }, '↶') : null,
        app.isGM ? h('button', { class: 'btn ghost sm', title: 'Voltar aos PV digitados à mão (só o mestre)', onclick: () => confirm('Desligar os PV pela classe? Os PV máximos voltam a ser digitados à mão (as rolagens ficam guardadas).') && emit('hp:auto', { charId: c.id, on: false }) }, 'desligar') : null));
  }

  // Classes do personagem: com uma só, um link para a multiclasse; com várias, a lista para editar
  function classesBox(c) {
    const list = (c.classes || []).map((k) => ({ ...k }));
    const save = (next) => patch(c, { classes: next });
    if (list.length <= 1) {
      return h('div', { class: 'classes-line' },
        h('button', {
          class: 'link small',
          title: 'Dar ao personagem níveis em outra classe (Livro do Jogador, cap. 6)',
          onclick: () => save([...list, { name: '', level: 1, die: 8 }]),
        }, '＋ Multiclasse'));
    }
    const total = list.reduce((s, k) => s + k.level, 0);
    const problems = prereqProblems(c);
    const row = (k, i) => {
      const name = h('input', { value: k.name, list: 'tabula-classes', placeholder: 'Classe', 'aria-label': `Classe ${i + 1}`, autocomplete: 'off' });
      const dieSel = h('select', {
        'aria-label': `Dado de vida de ${k.name || 'classe'}`, title: 'Dado de vida',
        onchange: (e) => { const next = list.map((x) => ({ ...x })); next[i].die = Number(e.target.value); save(next); },
      }, [6, 8, 10, 12].map((d) => h('option', { value: String(d), selected: d === k.die }, 'd' + d)));
      name.addEventListener('change', () => {
        const next = list.map((x) => ({ ...x }));
        next[i].name = name.value;
        const die = classDie(name.value);
        if (die) { next[i].die = die; dieSel.value = String(die); }   // mostra já, sem esperar o servidor
        list[i] = next[i];
        save(next);
      });
      return h('div', { class: 'class-row' },
        name,
        h('label', { class: 'mini' }, 'Nível', h('input', {
          type: 'number', class: 'num', min: '1', max: '20', value: String(k.level), 'aria-label': `Nível em ${k.name || 'classe'}`,
          onchange: (e) => { const next = list.map((x) => ({ ...x })); next[i].level = Number(e.target.value) || 1; save(next); },
        })),
        dieSel,
        i === 0 ? h('span', { class: 'muted tiny', title: 'A classe em que o personagem começou: ela dá os PV do 1º nível' }, '1ª') :
          h('button', {
            class: 'btn ghost sm', title: `Tirar ${k.name || 'esta classe'}`,
            onclick: () => confirm(`Tirar ${k.name || 'esta classe'} do personagem? Os níveis e os PV dela saem junto.`) && save(list.filter((_, j) => j !== i)),
          }, '✕'));
    };
    return h('div', { class: 'classes-box' },
      h('div', { class: 'row gap' }, h('b', { class: 'grow' }, 'Multiclasse'), h('span', { class: 'muted small' }, `nível total ${total}`)),
      list.map(row),
      total < 20 ? h('button', { class: 'btn sm', onclick: () => save([...list, { name: '', level: 1, die: 8 }]) }, '＋ Outra classe') : null,
      problems.length ? h('p', { class: 'warn small' }, '⚠ Requisitos de multiclasse (atributo 13 ou mais): ', problems.join('; '), '. Confira com o mestre.') : null,
      h('p', { class: 'muted tiny' }, 'O bônus de proficiência e o XP usam o nível total. Ao ganhar um nível, suba o nível da classe escolhida aqui.'));
  }

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

    const party = !opts.inWindow && !app.isGM ? app.state.characters.filter((x) => x.ownerId !== app.me.id) : [];
    setKids(pane,
      picker,
      party.length ? h('div', { class: 'party-row' }, h('small', { class: 'muted' }, 'O grupo:'),
        party.map((x) => h('button', { class: 'party-pick', title: `Ver o equipamento de ${x.name}`, onclick: () => openSheetWindow(x.id) },
          avatar(x.img, x.name, app.user(x.ownerId)?.color, 28)))) : null,
      h('div', { class: 'sheet-head' },
        avatarBtn,
        h('div', { class: 'sheet-id' },
          field(c, 'name', { class: 'title-input', label: 'Nome' }),
          h('div', { class: 'row gap wrap' },
            field(c, 'race', { placeholder: 'Raça', label: 'Raça' }),
            classField(c),
            h('label', { class: 'mini' }, 'Nível', field(c, 'level', { type: 'number', class: 'num', label: 'Nível' }))),
          h('div', { class: 'row gap wrap sheet-meta' },
            h('button', {
              class: 'link',
              onclick: () => {
                if (focusToken(c.id)) document.body.dispatchEvent(new CustomEvent('show-map'));
                else toast('Esse personagem não está na cena atual');
              },
            }, '◎ Achar no mapa'),
            opts.inWindow ? null : h('button', { class: 'link desk-only', title: 'Abrir esta ficha numa janela por cima do mapa', onclick: () => openSheetWindow(c.id) }, '⧉ Em janela'),
            h('span', { class: 'save-status', dataset: { kind: 'saved' }, title: 'A ficha salva sozinha a cada alteração' }, '✓ Salvo')))),

      h('div', { class: 'sx', dataset: { sx: 'classes' } }),

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

      h('div', { class: 'sx', dataset: { sx: 'hpclass' } }),
      h('div', { class: 'sx', dataset: { sx: 'status' } }),
      h('div', { class: 'sx', dataset: { sx: 'aspect' } }),

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
        h('div', { class: 'attacks', dataset: { box: 'attacks' } }),
        h('button', {
          class: 'btn sm', onclick: () => {
            const cur = app.char(c.id);
            patch(c, { attacks: [...(cur.attacks || []), { name: 'Novo ataque', bonus: 0, damage: '1d6' }] });
          },
        }, '+ Ataque')),

      h('details', { class: 'block' }, h('summary', {}, 'Características e talentos'), field(c, 'features', { multiline: true, rows: 6, label: 'Características' })),
      h('details', { class: 'block' }, h('summary', {}, 'Magias'),
        h('div', { class: 'sx', dataset: { sx: 'slots' } }),
        h('div', { class: 'sx', dataset: { sx: 'book' } }),
        h('details', { class: 'sub' }, h('summary', {}, 'Anotações de magias'),
          field(c, 'spells', { multiline: true, rows: 5, label: 'Anotações de magias', placeholder: 'Magias que não estão na Biblioteca, CD e bônus de ataque, observações…' }))),
      h('details', { class: 'block', open: true }, h('summary', {}, 'Dados de vida e descanso'), h('div', { class: 'sx', dataset: { sx: 'hd' } })),
      h('details', { class: 'block' }, h('summary', {}, 'Experiência e moedas'), h('div', { class: 'sx', dataset: { sx: 'xp' } })),
      h('details', { class: 'block equip-block', open: true }, h('summary', {}, 'Equipamento e mochila'),
        h('div', { class: 'sx', dataset: { sx: 'equip' } }),
        h('details', { class: 'sub' }, h('summary', {}, 'Anotações do inventário'),
          field(c, 'inventory', { multiline: true, rows: 4, label: 'Anotações do inventário', placeholder: 'O que não couber como item: dívidas, coisas guardadas na estalagem…' }))),
      h('details', { class: 'block' }, h('summary', {}, 'Anotações'), field(c, 'notes', { multiline: true, rows: 6, label: 'Anotações' })),
      h('label', { class: 'mini muted' }, 'Bônus extra de iniciativa', field(c, 'initBonus', { type: 'number', class: 'num', label: 'Bônus extra de iniciativa' })),
    );
    syncAdv();
  }

  function renderAttacks(c) {
    const box = pane.querySelector('[data-box="attacks"]');
    if (!box) return;
    const gear = weaponAttacks(c);
    const key = JSON.stringify([c.attacks || [], gear.map((g) => [g.name, g.toHit, g.damage, g.type, g.note])]);
    if (key === attacksKey || isEditingIn(box)) return;
    attacksKey = key;
    const list = c.attacks || [];
    const set = (i, f, v) => {
      const cur = app.char(c.id).attacks.map((a) => ({ ...a }));
      cur[i][f] = v;
      patch(c, { attacks: cur });
    };
    setKids(box,
      gear.map((g) => h('div', { class: 'attack gear', title: 'Arma equipada: bônus e dano calculados pela ficha. Para mudar, edite o item.' },
        h('span', { class: 'gear-name' }, h('b', {}, g.name), g.type || g.note ? h('small', { class: 'muted' }, ` ${[g.type, g.note].filter(Boolean).join(', ')}`) : null),
        h('span', { class: 'gear-num' }, fmtMod(g.toHit)),
        h('span', { class: 'gear-dmg' }, g.damage),
        h('button', { class: 'btn sm', title: 'Rolar ataque', onclick: () => rollD20(g.toHit, `${g.name} — ataque`) }, '⚔'),
        h('button', { class: 'btn sm', title: 'Rolar dano', onclick: () => doRoll(g.damage, `${g.name} — dano${g.type ? ' ' + g.type : ''}`) }, '🎲'))),
      list.length || gear.length ? null : h('p', { class: 'muted small' }, 'Nenhum ataque ainda. Equipe uma arma ou adicione um ataque.'),
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
  function slotOf(id) { return pane.querySelector(`[data-sx="${id}"]`); }
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
        // cópia local: duas edições seguidas não se atropelam enquanto o servidor responde
        const local = { ...app.char(c.id)[key] };
        const set = (f) => (e) => { local[f] = e.target.value; patch(c, { [key]: { ...local } }); };
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
    const sug = suggestSlots(c);
    const same = sug.slots.length && sug.slots.every((n, i) => (slots[i]?.max || 0) === n) && slots.slice(sug.slots.length).every((x) => !x.max);
    const applySug = () => {
      const cur = app.char(c.id).slots.map((x, i) => ({ max: sug.slots[i] || 0, used: Math.min(x.used, sug.slots[i] || 0) }));
      patch(c, { slots: cur });
    };
    return h('div', { class: 'slots' },
      h('div', { class: 'row gap wrap' }, h('small', { class: 'muted' }, 'Espaços de magia — clique para gastar/recuperar')),
      sug.slots.length && !same ? h('div', { class: 'row gap wrap slot-suggest' },
        h('span', { class: 'small' }, `${sug.multi ? 'Pela tabela de multiclasse' : 'Pela tabela da classe'} (nível de conjurador ${sug.casterLevel}): `,
          h('b', {}, sug.slots.map((n, i) => `${n}×${i + 1}º`).join(' · '))),
        h('button', { class: 'btn sm', onclick: applySug }, 'Usar esses')) : null,
      sug.pact ? h('p', { class: 'muted small' }, `Bruxo: Magia de Pacto à parte — ${sug.pact.count} espaço(s) de ${sug.pact.circle}º círculo, que voltam no descanso curto.`) : null,
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

  // Magias da ficha (escolhidas na Biblioteca do compêndio): por círculo, com "preparada" e o cartão da magia
  function bookBox(c) {
    const book = c.spellbook || [];
    const set = (next) => patch(c, { spellbook: next });
    const groups = new Map();
    for (const sp of [...book].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'))) {
      if (!groups.has(sp.level)) groups.set(sp.level, []);
      groups.get(sp.level).push(sp);
    }
    const prepCount = book.filter((x) => x.prep && x.level > 0).length;
    return h('div', { class: 'stack spellbook' },
      h('div', { class: 'row gap wrap' },
        h('small', { class: 'muted grow' }, book.length
          ? `${book.length} magia${book.length === 1 ? '' : 's'}${prepCount ? ` · ${prepCount} preparada${prepCount === 1 ? '' : 's'}` : ''}`
          : 'Nenhuma magia ainda. Procure na Biblioteca (truques e magias das suas classes).'),
        h('button', { class: 'btn sm', onclick: () => openSpellPicker(c.id) }, '＋ Procurar magias')),
      [...groups].map(([lvl, list]) => h('div', { class: 'book-group' },
        h('div', { class: 'book-level' }, lvl === 0 ? 'Truques' : `${lvl}º círculo`),
        list.map((sp) => h('div', { class: 'book-row' + (sp.prep ? ' prep' : '') },
          lvl > 0 ? h('button', {
            class: 'pip' + (sp.prep ? ' on' : ''), title: sp.prep ? 'Preparada (clique para tirar)' : 'Não preparada (clique para preparar)',
            'aria-label': `${sp.name}: preparada`, 'aria-pressed': String(!!sp.prep),
            onclick: () => set(app.char(c.id).spellbook.map((x) => (x.id === sp.id && x.name === sp.name ? { ...x, prep: !x.prep } : x))),
          }) : h('span', { class: 'pip-space' }),
          h('button', { class: 'link grow', title: 'Abrir o cartão da magia', onclick: () => openSpellById(sp.id, sp.name) }, sp.name),
          h('button', {
            class: 'btn ghost sm', title: 'Tirar da ficha', 'aria-label': `Tirar ${sp.name}`,
            onclick: () => set(app.char(c.id).spellbook.filter((x) => !(x.id === sp.id && x.name === sp.name))),
          }, '✕'))))));
  }

  function hdBox(c) {
    const con = abilityMod(c.attrs?.con);
    const multi = (c.classes || []).length > 1;
    const pools = {};
    for (const k of (c.classes?.length ? c.classes : [{ level: c.level, die: Number(String(c.hitDie || 'd8').slice(1)) }])) pools['d' + k.die] = (pools['d' + k.die] || 0) + k.level;
    const usedBy = c.hdUsedBy && Object.keys(c.hdUsedBy).length ? c.hdUsedBy : { [c.hitDie || 'd8']: c.hdUsed || 0 };
    const spend = async (d) => {
      const cur = app.char(c.id);
      const used = { ...(cur.hdUsedBy || {}) };
      if ((pools[d] || 0) - (used[d] || 0) <= 0) return toast('Sem dados de vida desse tipo. Eles voltam no descanso longo.', 'error');
      const r = await doRoll(`1${d}${con ? fmtMod(con) : ''}`, `${cur.name} — dado de vida (descanso curto)`);
      if (!r) return;
      const heal = Math.max(0, r.total);
      const now = app.char(c.id);
      patch(c, { hp: Math.min(now.hpMax, Math.max(0, now.hp) + heal), hdUsedBy: { ...(now.hdUsedBy || {}), [d]: ((now.hdUsedBy || {})[d] || 0) + 1 } });
      toast(`+${heal} PV`, 'ok');
    };
    const dice = Object.keys(pools).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
    return h('div', { class: 'stack' },
      dice.map((d) => {
        const left = Math.max(0, pools[d] - (usedBy[d] || 0));
        return h('div', { class: 'row gap wrap' },
          multi ? h('b', { class: 'hd-die' }, d) : h('label', { class: 'mini' }, 'Dado',
            h('select', { onchange: (e) => patch(c, { hitDie: e.target.value }) },
              ['d6', 'd8', 'd10', 'd12'].map((x) => h('option', { value: x, selected: x === (c.hitDie || 'd8') }, x)))),
          h('span', {}, h('b', { class: 'big-inline' }, String(left)), ` de ${pools[d]} disponíveis`),
          h('span', { class: 'grow' }),
          h('button', { class: 'btn sm primary', disabled: left <= 0, onclick: () => spend(d) }, `☕ Gastar 1 (1${d}${con ? fmtMod(con) : ''})`));
      }),
      h('p', { class: 'muted small' }, multi
        ? 'Na multiclasse, cada tipo de dado tem o seu monte. No descanso longo você recupera metade do total (os maiores primeiro).'
        : 'No descanso curto, gaste dados de vida para recuperar PV. No descanso longo (o mestre marca), PV e espaços de magia voltam e você recupera metade dos dados de vida.'));
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
    redraw('hpclass', JSON.stringify([c.hpAuto, c.hitDie, c.level, c.hpRolls, c.hpBonus, c.attrs?.con, c.classes, c.hpMax, app.state.rules, app.isGM]), () => hpClassBox(c));
    redraw('classes', JSON.stringify([c.classes, c.attrs]), () => classesBox(c));
    redraw('equip', JSON.stringify([c.items, c.attrs, c.autoAc, c.ac, c.level, c.ownerId, app.isGM,
      app.state.characters.map((x) => [x.id, x.name])]), () => equipmentBox(c, { patch }));
    redraw('status', JSON.stringify([c.conditions, c.inspiration, c.deathSaves, c.hp <= 0, c.name]), () => statusBox(c));
    redraw('aspect', JSON.stringify([c.aspect, c.ring, c.level, app.isGM]), () => aspectBox(c));
    redraw('slots', JSON.stringify([c.slots, c.classes, c.class, c.level]), () => slotsBox(c));
    redraw('book', JSON.stringify(c.spellbook || []), () => bookBox(c));
    redraw('hd', JSON.stringify([c.level, c.hdUsed, c.hdUsedBy, c.hitDie, c.classes, c.attrs?.con]), () => hdBox(c));
    redraw('xp', JSON.stringify([c.xp, c.level, c.coins]), () => xpBox(c));
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
    const multi = (c.classes || []).length > 1;
    for (const f of ['class', 'level']) {
      const el = pane.querySelector(`[data-f="${f}"]`);
      if (!el) continue;
      el.readOnly = multi;
      el.classList.toggle('auto', multi);
      el.title = multi ? `${c.class} — multiclasse: edite as classes e os níveis na lista logo abaixo` : '';
    }
    const maxEl = pane.querySelector('[data-f="hpMax"]');
    if (maxEl) {
      maxEl.readOnly = !!c.hpAuto;
      maxEl.classList.toggle('auto', !!c.hpAuto);
      maxEl.title = c.hpAuto ? 'Calculado pela classe e pelas rolagens de cada nível' : 'PV máximos';
    }
    const acEl = pane.querySelector('[data-f="ac"]');
    if (acEl) {
      const auto = c.autoAc !== false && computeAc(c) !== null;
      acEl.readOnly = auto;
      acEl.classList.toggle('auto', auto);
      acEl.title = auto ? 'Calculada pelo equipamento (para digitar, desligue "automática" em Equipamento)' : 'Classe de Armadura';
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

  function render(state) {
    const chars = available();
    if (!chars.length) {
      builtFor = null;
      setKids(pane, h('div', { class: 'empty-state' },
        h('p', {}, app.isGM ? 'Nenhum personagem criado ainda.' : 'O mestre ainda não vinculou um personagem a você.'),
        app.isGM ? h('p', { class: 'muted' }, 'Crie personagens na aba "Mestre" → Jogadores e personagens.') : null));
      return false;
    }
    let c = opts.fixedId ? chars.find((x) => x.id === opts.fixedId) : chars.find((x) => x.id === currentId) || chars[0];
    if (!c) return false;
    currentId = c.id;
    if (builtFor !== c.id || !pane.querySelector('.sheet-head')) build(c);
    renderStrip(c);
    fill(c);
    return true;
  }

  bus.addEventListener('adv', syncAdv);
  return { render, open: openSheet, paste, get id() { return builtFor; }, pane };
}

// lista de classes para o campo "Classe" (uma só, usada por todas as fichas abertas)
document.body.append(h('datalist', { id: 'tabula-classes' }, CLASSES.map(([n]) => h('option', { value: n }))));

// Fichas que esta pessoa pode editar: o mestre, todas; o jogador, as dele
function available() {
  const s = app.state;
  if (!s) return [];
  return app.isGM ? s.characters : s.characters.filter((c) => c.ownerId === s.me.id);
}
const canEdit = (c) => app.isGM || c.ownerId === app.me?.id;

// ------------------------------------------------------------ a ficha da aba lateral
const main = createSheet($('#pane-sheet'));
export const renderSheet = (state) => main.render(state);
export const openSheet = (id) => main.open(id);
export function pasteToSheet(url) {
  return main.paste(url);
}

// ------------------------------------------------------------ fichas em janelas
const wins = new Map();   // charId → { win, sheet | null, key }

// Abre a ficha de um personagem numa janela. Quem não pode editar (ficha de outro jogador)
// vê só o retrato, a vida, as condições e o equipamento.
export function openSheetWindow(charId) {
  const c = app.char(charId);
  if (!c) return;
  if (isMobile()) {
    if (canEdit(c)) {
      openSheet(charId);
      document.body.dispatchEvent(new CustomEvent('open-tab', { detail: 'sheet' }));
    } else {
      openModal(c.name, viewCard(c));
    }
    return;
  }
  const have = wins.get(charId);
  if (have) { have.win.focus(); return; }
  const body = h('div', { class: 'sheet-pane' });
  const full = canEdit(c);
  const win = openWindow({
    key: (full ? 'sheet-' : 'view-') + charId,
    title: c.name,
    content: body,
    width: full ? 440 : 320,
    height: full ? 680 : 560,
    className: full ? 'sheet-win' : 'view-win',
    onClose: () => wins.delete(charId),
  });
  const sheet = full ? createSheet(body, { fixedId: charId, inWindow: true }) : null;
  wins.set(charId, { win, sheet, body, key: '' });
  renderSheetWindows(app.state);
}

function viewCard(c) {
  const owner = c.ownerId ? app.user(c.ownerId) : null;
  const r = c.hpMax ? Math.max(0, Math.min(1, c.hp / c.hpMax)) : 0;
  return h('div', { class: 'view-card' },
    h('div', { class: 'row gap' },
      avatar(c.img, c.name, owner?.color, 64),
      h('div', { class: 'stack' },
        h('b', { class: 'view-name' }, c.name),
        h('span', { class: 'muted small' }, [c.race, c.class, c.level ? `nível ${c.level}` : ''].filter(Boolean).join(' · ')),
        owner ? h('span', { class: 'muted tiny' }, `de ${owner.name}`) : null)),
    h('div', { class: 'hp-bar' }, h('i', { style: { width: r * 100 + '%' }, dataset: { level: r <= 0 ? 'down' : r <= 0.5 ? 'low' : 'ok' } })),
    c.conditions?.length ? h('div', { class: 'small' }, c.conditions.map((k) => `${CONDITION_ICON[k]} ${CONDITION_LABEL[k]}`).join('  ')) : null,
    h('small', { class: 'muted' }, 'Equipamento'),
    dollView(c.equip || []));
}

export function renderSheetWindows(state) {
  for (const [id, w] of wins) {
    const c = state.characters.find((x) => x.id === id);
    if (!c) { w.win.close(); continue; }
    w.win.setTitle(c.name);
    if (w.sheet) {
      if (!canEdit(c)) { w.win.close(); continue; }
      w.sheet.render(state);
    } else {
      const key = JSON.stringify([c.name, c.img, c.hp, c.hpMax, c.conditions, c.equip, c.level, c.class, c.race]);
      if (key !== w.key) { w.key = key; setKids(w.body, viewCard(c)); }
    }
  }
}

// Ctrl+V com uma janela de ficha em foco
export function pasteToWindow(url) {
  const a = activeWindow();
  if (!a) return false;
  for (const w of wins.values()) if (w.win === a && w.sheet) return w.sheet.paste(url);
  return false;
}
export const sheetWindowActive = () => {
  const a = activeWindow();
  return !!a && [...wins.values()].some((w) => w.win === a && w.sheet);
};
