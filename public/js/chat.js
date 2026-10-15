// Dados e conversa: rolagens compartilhadas, mensagens, rolagem secreta.
import { app, emit, doRoll, rollD20, bus, setAdv, setPrivate } from './core.js';
import { $, h, timeLabel, setKids } from './util.js';

const pane = $('#pane-chat');
let log, input, privToggle;
let onUnread = () => {};

const DICE_ONLY = /^[\dd%+\-\s]*(kh|kl)?[\dd%+\-\s]*$/i;

export function initChat(unreadCb) {
  onUnread = unreadCb;
  log = h('div', { class: 'chat-log', role: 'log', 'aria-live': 'polite' });
  input = h('input', {
    placeholder: 'Mensagem ou dados (ex.: 1d20+5, 2d6+3, /r 1d8 espada)',
    'aria-label': 'Mensagem ou rolagem', autocomplete: 'off', enterkeyhint: 'send',
  });
  privToggle = h('input', { type: 'checkbox', onchange: (e) => setPrivate(e.target.checked) });
  bus.addEventListener('private', (e) => { privToggle.checked = e.detail; });

  const dice = [4, 6, 8, 10, 12, 20, 100].map((n) => h('button', {
    class: 'die', title: `Rolar 1d${n}`,
    onclick: () => (n === 20 ? rollD20(0, 'd20') : doRoll(`1d${n}`, `d${n}`)),
  }, `d${n}`));

  const adv = h('div', { class: 'seg', role: 'group', 'aria-label': 'Próximo d20' },
    [['dis', 'Desv.'], ['normal', 'Normal'], ['adv', 'Vant.']].map(([m, l]) =>
      h('button', { class: 'seg-btn', dataset: { adv: m }, onclick: () => setAdv(m) }, l)));

  setKids(pane, 
    log,
    h('div', { class: 'chat-tools' },
      h('div', { class: 'dice-row' }, dice),
      h('div', { class: 'row gap wrap' }, adv,
        h('label', { class: 'mini toggle', id: 'priv-label' }, privToggle, h('span', {}, 'Rolagem secreta')),
        h('label', { class: 'mini toggle', title: 'Mostra um cartão ao lado do painel a cada rolagem' },
          h('input', {
            type: 'checkbox', checked: popupsOn(),
            onchange: (e) => { try { localStorage.setItem('tabula.popups', e.target.checked ? '1' : '0'); } catch { /* ok */ } },
          }), 'Rolagens na tela'))),
    h('form', {
      class: 'chat-form',
      onsubmit: (e) => { e.preventDefault(); send(); },
    }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Enviar')),
  );
  const sync = () => adv.querySelectorAll('[data-adv]').forEach((b) => b.classList.toggle('on', b.dataset.adv === app.advMode));
  bus.addEventListener('adv', sync);
  sync();
}

export function updateChatLabels() {
  const l = $('#priv-label span');
  if (l) l.textContent = app.isGM ? 'Rolagem oculta (só o mestre vê)' : 'Rolagem secreta (só você e o mestre)';
}

async function send() {
  const text = input.value.trim();
  if (!text) return;
  let ok;
  const cmd = /^\/(r|roll|rolar)\s+(\S+)\s*(.*)$/i.exec(text);
  if (cmd) ok = await doRoll(cmd[2], cmd[3]);
  else if (/\dd|^d\d/i.test(text) && DICE_ONLY.test(text)) {
    ok = /^1?d20([+-]\d+)?$/i.test(text.replace(/\s+/g, '')) && app.advMode !== 'normal'
      ? await rollD20(Number((/[+-]\d+$/.exec(text.replace(/\s+/g, '')) || ['0'])[0]), 'd20')
      : await doRoll(text, '');
  } else ok = await emit('chat:send', { text });
  if (ok) input.value = '';
}

function nearBottom() {
  return log.scrollHeight - log.scrollTop - log.clientHeight < 80;
}

function renderRoll(r) {
  return h('div', { class: 'roll-breakdown' },
    r.parts.map((p, i) => {
      const sign = i === 0 ? (p.type === 'mod' && p.value < 0 ? '−' : '') : ((p.type === 'mod' ? p.value : p.sign) < 0 ? ' − ' : ' + ');
      if (p.type === 'mod') return [sign, h('span', { class: 'mod' }, String(Math.abs(p.value)))];
      return [sign, h('span', { class: 'dice-group', title: `${p.count}d${p.sides}${p.keep || ''}` },
        p.rolls.map((d) => h('span', {
          class: 'face' + (d.kept ? '' : ' dropped') + (d.v === p.sides ? ' max' : '') + (d.v === 1 ? ' min' : ''),
        }, String(d.v))))];
    }));
}

function renderMsg(m) {
  if (m.type === 'system') return h('div', { class: 'msg system' }, m.text);
  const head = h('div', { class: 'msg-head' },
    h('b', { style: { color: m.color } }, m.userName),
    m.private ? h('span', { class: 'tag' }, 'secreta') : null,
    h('time', {}, timeLabel(m.ts)));
  if (m.type === 'text') {
    return h('div', { class: 'msg' + (m.private ? ' private' : '') }, head, h('div', { class: 'msg-text' }, m.text));
  }
  const r = m.roll;
  return h('div', { class: 'msg roll' + (m.private ? ' private' : '') },
    head,
    m.label ? h('div', { class: 'roll-label' }, m.label) : null,
    h('div', { class: 'roll-line' },
      h('span', { class: 'roll-total' + (r.crit ? ` crit-${r.crit}` : '') }, String(r.total)),
      h('div', {},
        h('code', { class: 'roll-formula' }, r.formula),
        renderRoll(r),
        r.crit === 'success' ? h('div', { class: 'crit-note ok' }, '20 natural!') : null,
        r.crit === 'fail' ? h('div', { class: 'crit-note bad' }, '1 natural…') : null)));
}

export function setHistory(msgs) {
  setKids(log, ...msgs.map(renderMsg));
  log.scrollTop = log.scrollHeight;
}

// ------------------------------------------------- pop-up das rolagens
function popupsOn() {
  try { return localStorage.getItem('tabula.popups') !== '0'; } catch { return true; }
}
let popBox = null;
function showRollPopup(m) {
  if (m.type !== 'roll' || !popupsOn()) return;
  if (!popBox) {
    popBox = h('div', { class: 'roll-pops', 'aria-live': 'polite' });
    document.body.append(popBox);
  }
  const r = m.roll;
  const card = h('div', {
    class: 'roll-pop' + (m.private ? ' private' : '') + (r.crit ? ` crit-${r.crit}` : ''),
    style: { '--c': m.color || 'var(--gold)' },
    title: 'Clique para fechar',
    onclick: () => close(),
  },
  h('div', { class: 'rp-head' },
    h('b', {}, m.userName),
    m.private ? h('span', { class: 'tag' }, 'secreta') : null),
  m.label ? h('div', { class: 'rp-label' }, m.label) : null,
  h('div', { class: 'rp-body' },
    h('span', { class: 'rp-total' }, String(r.total)),
    h('div', { class: 'rp-detail' }, h('code', {}, r.formula), renderRoll(r))),
  r.crit === 'success' ? h('div', { class: 'crit-note ok' }, '20 natural!') : null,
  r.crit === 'fail' ? h('div', { class: 'crit-note bad' }, '1 natural…') : null);
  let gone = false;
  const close = () => {
    if (gone) return;
    gone = true;
    card.classList.add('out');
    setTimeout(() => card.remove(), 300);
  };
  popBox.prepend(card);
  while (popBox.childElementCount > 3) popBox.lastElementChild.remove();
  setTimeout(close, r.crit ? 8000 : 6000);
}

export function addMessage(m) {
  showRollPopup(m);
  const stick = nearBottom() || m.userId === app.me?.id;
  log.append(renderMsg(m));
  while (log.childElementCount > 300) log.firstElementChild.remove();
  if (stick) log.scrollTop = log.scrollHeight;
  onUnread(m);
}

export function scrollChatToEnd() {
  if (log) log.scrollTop = log.scrollHeight;
}
