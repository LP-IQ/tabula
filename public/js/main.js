// Ponto de entrada: login, conexão em tempo real, abas e distribuição do estado.
import { app } from './core.js';
import { $, h, toast, avatar, setKids } from './util.js';
import { renderMap, onTokenMoved, showPing, fit } from './map.js';
import { renderSheet } from './sheet.js';
import { initChat, setHistory, addMessage, updateChatLabels, scrollChatToEnd } from './chat.js';
import { renderInitiative } from './initiative.js';
import { renderHandouts, markAllSeen, unseenCount } from './handouts.js';
import { renderGM } from './gm.js';

const TOKEN_KEY = 'tabula.token';
const mobile = window.matchMedia('(max-width: 820px)');

// ------------------------------------------------------------------- abas
const TABS = [
  { id: 'map', label: 'Mapa', icon: '🗺', mobileOnly: true },
  { id: 'sheet', label: 'Ficha', icon: '📜' },
  { id: 'chat', label: 'Dados', icon: '🎲' },
  { id: 'init', label: 'Iniciativa', icon: '⚔' },
  { id: 'handouts', label: 'Segredos', icon: '✉' },
  { id: 'gm', label: 'Mestre', icon: '👑', gmOnly: true },
];
let sideTab = localStorage.getItem('tabula.tab') || 'sheet';
let mobileTab = 'map';
let unreadChat = 0;

function visibleTabs() {
  return TABS.filter((t) => !t.gmOnly || app.isGM);
}
function activeTab() {
  return mobile.matches ? mobileTab : sideTab;
}
function selectTab(id) {
  if (id === 'map') {
    mobileTab = 'map';
  } else {
    sideTab = id;
    mobileTab = id;
    localStorage.setItem('tabula.tab', id);
  }
  if (activeTab() === 'chat') { unreadChat = 0; scrollChatToEnd(); }
  if (activeTab() === 'handouts') { renderHandouts(app.state, true); markAllSeen(); }
  layoutTabs();
}

function badgeFor(id) {
  if (id === 'chat') return unreadChat;
  if (id === 'handouts') return unseenCount();
  return 0;
}

function layoutTabs() {
  if (!app.state) return;
  if (!visibleTabs().some((t) => t.id === sideTab)) sideTab = 'sheet';
  document.body.dataset.mpane = mobileTab;
  for (const p of document.querySelectorAll('.sidebar .pane')) p.classList.toggle('active', p.dataset.pane === sideTab);

  const mk = (t, cur) => h('button', {
    class: 'tab' + (t.id === cur ? ' active' : ''), role: 'tab', 'aria-selected': String(t.id === cur),
    onclick: () => selectTab(t.id),
  }, h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, t.icon), h('span', { class: 'tab-label' }, t.label),
  badgeFor(t.id) ? h('span', { class: 'badge' }, String(badgeFor(t.id))) : null);

  setKids($('#tabs'), ...visibleTabs().filter((t) => !t.mobileOnly).map((t) => mk(t, sideTab)));
  setKids($('#bottom-tabs'), ...visibleTabs().map((t) => mk(t, mobileTab)));
}
mobile.addEventListener('change', () => { layoutTabs(); setTimeout(fit, 50); });
document.body.addEventListener('show-map', () => { if (mobile.matches) selectTab('map'); });

// --------------------------------------------------------------- presença
function renderPresence(state) {
  setKids($('#presence'), ...state.users.filter((u) => u.online).map((u) => {
    const a = avatar(null, u.name, u.color, 28);
    a.title = `${u.name} (online)`;
    a.style.background = u.color;
    return a;
  }));
  $('#me-name').textContent = state.me.name + (app.isGM ? ' · Mestre' : '');
}

// ------------------------------------------------------------- renderização
let renderQueued = false;
function renderAll() {
  renderQueued = false;
  const s = app.state;
  if (!s) return;
  document.body.classList.toggle('gm', app.isGM);
  document.body.classList.toggle('viewer', s.me.role === 'viewer');
  renderPresence(s);
  renderMap(s);
  if (s.me.role !== 'viewer') {
    renderSheet(s);
    renderInitiative(s);
    renderHandouts(s, activeTab() === 'handouts');
    renderGM(s);
    updateChatLabels();
  }
  layoutTabs();
}
function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(renderAll);
}
// quando o usuário sai de um campo, aplica o que chegou enquanto ele digitava
document.addEventListener('focusout', () => setTimeout(queueRender, 50));

// ---------------------------------------------------------------- conexão
function setConn(ok) {
  const c = $('#conn');
  c.classList.toggle('on', ok);
  c.title = ok ? 'Conectado' : 'Reconectando…';
}

let chatReady = false;
let pendingHistory = null;

function connect(token) {
  if (app.socket) app.socket.disconnect();
  chatReady = false;
  app.state = null;
  const socket = window.io({ auth: { token } });
  app.socket = socket;

  socket.on('connect', () => setConn(true));
  socket.on('disconnect', () => setConn(false));
  socket.on('connect_error', (err) => {
    setConn(false);
    if (err.message === 'auth') {
      socket.disconnect();
      localStorage.removeItem(TOKEN_KEY);
      showLogin('Sua sessão expirou. Entre de novo.');
    }
  });
  socket.on('state', (state) => {
    const first = !app.state;
    app.state = state;
    if (first) {
      $('#login').hidden = true;
      $('#app').hidden = false;
      initChat(onChatMessage);
      chatReady = true;
      if (pendingHistory) { setHistory(pendingHistory); pendingHistory = null; }
      if (state.me.role === 'viewer') mobileTab = 'map';
    }
    queueRender();
  });
  socket.on('chat:history', (msgs) => { if (chatReady) setHistory(msgs); else pendingHistory = msgs; });
  socket.on('chat', (m) => { if (chatReady) addMessage(m); });
  socket.on('token:moved', onTokenMoved);
  socket.on('ping', showPing);
  socket.on('handout:new', (x) => {
    toast(`✉ Novo segredo: ${x.title}`, 'secret', 6000);
    queueRender();
  });
}

function onChatMessage(m) {
  if (activeTab() !== 'chat' && m.userId !== app.me?.id) {
    unreadChat += 1;
    layoutTabs();
  }
}

// ------------------------------------------------------------------- login
async function showLogin(msg = '') {
  $('#app').hidden = true;
  app.state = null;
  const box = $('#login');
  box.hidden = false;
  $('#login-error').textContent = msg;
  let status;
  try {
    status = await (await fetch('/api/status')).json();
  } catch {
    $('#login-error').textContent = 'Não consegui falar com o servidor.';
    return;
  }
  $('#setup-form').hidden = !status.needsSetup;
  $('#login-form').hidden = status.needsSetup;
  $('#login-sub').textContent = status.needsSetup ? 'Configurar a mesa' : 'Entre na mesa';
  const sel = $('#login-user');
  const last = localStorage.getItem('tabula.lastUser');
  setKids(sel, ...status.users.map((u) => h('option', { value: u.id, selected: u.id === last }, u.name)));
  (status.needsSetup ? $('#setup-pass') : $('#login-pass')).focus();
}

async function postJSON(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Erro');
  return j;
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true;
  try {
    const userId = $('#login-user').value;
    const { token } = await postJSON('/api/login', { userId, password: $('#login-pass').value });
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('tabula.lastUser', userId);
    $('#login-pass').value = '';
    connect(token);
  } catch (err) {
    $('#login-error').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$('#setup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { token } = await postJSON('/api/setup', { name: $('#setup-name').value, password: $('#setup-pass').value });
    localStorage.setItem(TOKEN_KEY, token);
    connect(token);
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

$('#logout').addEventListener('click', async () => {
  const token = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  try { await fetch('/api/logout', { method: 'POST', headers: { 'x-token': token || '' } }); } catch { /* ok */ }
  app.socket?.disconnect();
  location.reload();
});

// ------------------------------------------------------------------- início
const saved = localStorage.getItem(TOKEN_KEY);
if (saved) connect(saved);
else showLogin();
