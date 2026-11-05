// Demonstração do mapa 2D da página inicial: arrastar o token, régua em metros, névoa que abre.
(() => {
  const board = document.getElementById('board');
  const hero = document.getElementById('hero');
  const fog = document.getElementById('fog');
  const ruler = document.getElementById('ruler');
  const note = document.getElementById('note');
  const roll = document.getElementById('roll');
  const foes = [...board.querySelectorAll('.tok.foe')];
  const COLS = 12, ROWS = 8, SIGHT = 2.6;           // visão em quadrados
  const walls = [[5, 0, 1, 4], [5, 5, 5, 1], [0, 5, 2, 1]];   // x, y, largura, altura
  const pos = { x: 1, y: 2 };
  const seen = [];
  let found = 0;

  const blocked = (x, y) => x < 0 || y < 0 || x >= COLS || y >= ROWS || walls.some(([wx, wy, ww, wh]) => x >= wx && x < wx + ww && y >= wy && y < wy + wh);

  function size() {
    const r = board.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    fog.width = Math.round(r.width * dpr); fog.height = Math.round(r.height * dpr);
    ruler.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    drawFog();
  }
  function drawFog() {
    const g = fog.getContext('2d');
    const sq = fog.width / COLS;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, fog.width, fog.height);
    g.fillStyle = 'rgba(22, 15, 10, .9)';   // quase opaca: dá para adivinhar as paredes
    g.fillRect(0, 0, fog.width, fog.height);
    g.globalCompositeOperation = 'destination-out';
    for (const p of seen) {
      const cx = (p.x + .5) * sq, cy = (p.y + .5) * sq, r = SIGHT * sq;
      const grad = g.createRadialGradient(cx, cy, r * .55, cx, cy, r);
      grad.addColorStop(0, '#000'); grad.addColorStop(1, '#0000');
      g.fillStyle = grad;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
  }
  function reveal() {
    if (!seen.some((p) => p.x === pos.x && p.y === pos.y)) seen.push({ ...pos });
    drawFog();
    for (const f of foes) {
      if (f.classList.contains('seen')) continue;
      const d = Math.hypot(f.dataset.x - pos.x, f.dataset.y - pos.y);
      if (d <= SIGHT - .4) { f.classList.add('seen'); found += 1; }
    }
    if (found === foes.length) {
      note.innerHTML = '<b>Dois goblins</b> saíram da névoa. Hora da iniciativa.';
      roll.hidden = false;
    } else if (found === 1) {
      note.innerHTML = 'Um <b>goblin</b>! Será que ele está sozinho?';
    }
  }
  function place() {
    hero.style.left = (pos.x * 100 / COLS) + '%';
    hero.style.top = (pos.y * 100 / ROWS) + '%';
  }
  function measure(a, b) {
    if (!a) { ruler.innerHTML = ''; return; }
    const sq = board.clientWidth / COLS;
    const sqs = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    const x1 = (a.x + .5) * sq, y1 = (a.y + .5) * sq, x2 = (b.x + .5) * sq, y2 = (b.y + .5) * sq;
    const label = `${(sqs * 1.5).toLocaleString('pt-BR')} m`;
    ruler.innerHTML = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle cx="${x1}" cy="${y1}" r="5"/>` +
      (sqs ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 12}" text-anchor="middle">${label}</text>` : '');
  }

  let start = null;
  hero.addEventListener('pointerdown', (e) => {
    hero.setPointerCapture(e.pointerId);
    hero.classList.add('drag');
    start = { ...pos };
  });
  hero.addEventListener('pointermove', (e) => {
    if (!start) return;
    const r = board.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / (r.width / COLS));
    const y = Math.floor((e.clientY - r.top) / (r.height / ROWS));
    if ((x !== pos.x || y !== pos.y) && !blocked(x, y)) {
      pos.x = x; pos.y = y; place(); reveal();
    }
    measure(start, pos);
  });
  const end = () => { if (!start) return; start = null; hero.classList.remove('drag'); setTimeout(() => measure(null), 900); };
  hero.addEventListener('pointerup', end);
  hero.addEventListener('pointercancel', end);

  let keyStart = null, keyTimer = 0;
  hero.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const x = pos.x + d[0], y = pos.y + d[1];
    if (blocked(x, y)) return;
    if (!keyStart) keyStart = { ...pos };
    pos.x = x; pos.y = y; place(); reveal(); measure(keyStart, pos);
    clearTimeout(keyTimer);
    keyTimer = setTimeout(() => { keyStart = null; measure(null); }, 1200);
  });

  roll.addEventListener('click', () => {
    const t = 1 + Math.floor(Math.random() * 20);
    const g = 1 + Math.floor(Math.random() * 20) + 2;
    note.innerHTML = `Iniciativa: <b>Tharkino ${t}</b>, goblins ${g}. ${t >= g ? 'Tharkino age primeiro.' : 'Os goblins agem primeiro.'}`;
    roll.textContent = 'Rolar de novo';
  });

  window.addEventListener('resize', size);
  size();
  reveal();
})();
