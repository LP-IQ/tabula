// Demonstração da Vista 3D: o mesmo tabuleiro da abertura, com a miniatura de exemplo da Tábula.
// Só carrega quando a seção aparece na tela; sem WebGL, fica a foto.
const stage = document.getElementById('stage');
const tip = document.getElementById('stage-tip');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); boot().catch(() => stage.classList.add('static')); } }, { rootMargin: '200px' });
io.observe(stage);

async function boot() {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const COLS = 12, ROWS = 8;
  const walls = [[5, 0, 1, 4], [5, 5, 5, 1], [0, 5, 2, 1]];
  const blocked = (x, y) => x < 0 || y < 0 || x >= COLS || y >= ROWS || walls.some(([wx, wy, ww, wh]) => x >= wx && x < wx + ww && y >= wy && y < wy + wh);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0e1630');
  const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(COLS / 2, 0, ROWS / 2);
  camera.position.set(COLS / 2 + 1.5, 8.4, ROWS / 2 + 9.4);
  controls.enableDamping = true;
  controls.enableZoom = false;   // a rodinha continua rolando a página
  controls.enablePan = false;
  controls.maxPolarAngle = 1.32;
  controls.minPolarAngle = 0.35;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.6;
  controls.addEventListener('start', () => { controls.autoRotate = false; tip.style.opacity = 0; });

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a2a20, 2.1));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(COLS / 2 - 4, 14, ROWS / 2 + 6);
  sun.target.position.set(COLS / 2, 0, ROWS / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // chão: pergaminho com grade, tapete e paredes pintadas (como um mapa de verdade)
  const S = 64, cv = document.createElement('canvas');
  cv.width = COLS * S; cv.height = ROWS * S;
  const g = cv.getContext('2d');
  g.fillStyle = '#d9c49b'; g.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,60,30,${Math.random() * 0.06})`; g.fillRect(Math.random() * cv.width, Math.random() * cv.height, 3, 3); }
  g.fillStyle = '#a8352e'; g.beginPath(); g.ellipse(8.75 * S, 1.75 * S, 1.3 * S, 1.15 * S, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#d4a94e'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#3a2a1f';
  for (const [x, y, w, h] of walls) g.fillRect(x * S, y * S, w * S, h * S);
  g.strokeStyle = 'rgba(42,28,19,.35)'; g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= COLS; x++) { g.moveTo(x * S, 0); g.lineTo(x * S, cv.height); }
  for (let y = 0; y <= ROWS; y++) { g.moveTo(0, y * S); g.lineTo(cv.width, y * S); }
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(COLS / 2, 0, ROWS / 2);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.ShadowMaterial({ opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(COLS / 2, 0.004, ROWS / 2); shadow.receiveShadow = true;
  const board = new THREE.Mesh(new THREE.BoxGeometry(COLS + 0.5, 0.25, ROWS + 0.5), new THREE.MeshStandardMaterial({ color: '#36261d', roughness: 0.9 }));
  board.position.set(COLS / 2, -0.135, ROWS / 2);   // topo um pouco abaixo do mapa (sem "briga" de profundidade)
  scene.add(ground, shadow, board);

  const base = (color) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.47, 0.08, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.15 }));
    m.position.y = 0.04; m.castShadow = true; return m;
  };
  // goblins: miniaturas de papelão
  const goblins = [];
  for (const [x, y, label] of [[9, 2, 'G1'], [10, 6, 'G2']]) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 180;
    const k = c.getContext('2d');
    k.fillStyle = '#a8352e'; k.beginPath(); k.roundRect(0, 0, 128, 180, 16); k.fill();
    k.fillStyle = '#1d1410'; k.beginPath(); k.roundRect(7, 7, 114, 166, 11); k.fill();
    k.fillStyle = '#efe3cc'; k.font = '700 50px Alegreya Sans, sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(label, 64, 92);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.98), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: false }));
    card.position.y = 0.58; card.castShadow = true;
    const grp = new THREE.Group(); grp.add(base('#a8352e'), card);
    grp.position.set(x + 0.5, 0, y + 0.5);
    scene.add(grp); goblins.push(card);
  }
  // Tharkino: a miniatura de exemplo (.glb) com animações
  const hero = new THREE.Group(); hero.add(base('#d4a94e'));
  hero.position.set(1.5, 0, 2.5);
  scene.add(hero);
  const gltf = await new GLTFLoader().loadAsync('modelos/miniatura-exemplo.glb');
  const fig = gltf.scene;
  fig.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(fig);
  const k = 1.3 / (box.max.y - box.min.y);
  fig.scale.setScalar(k); fig.position.y = 0.08 - box.min.y * k;
  hero.add(fig);
  const mixer = new THREE.AnimationMixer(fig);
  const idle = mixer.clipAction(gltf.animations.find((a) => a.name === 'idle'));
  const walk = mixer.clipAction(gltf.animations.find((a) => a.name === 'walk'));
  idle.play();
  let walking = false;

  // tocar num quadrado: o Tharkino anda até lá (desviando das paredes, quadrado por quadrado)
  let path = [];
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, p)) return;
    const gx = Math.floor(p.x), gy = Math.floor(p.z);
    if (blocked(gx, gy)) return;
    path = route(Math.floor(hero.position.x), Math.floor(hero.position.z), gx, gy);
    tip.style.opacity = 0;
  });
  function route(sx, sy, tx, ty) {           // busca em largura na grade
    const prev = new Map([[sx + ',' + sy, null]]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy, key = nx + ',' + ny;
        if (prev.has(key) || blocked(nx, ny) || (dx && dy && (blocked(x + dx, y) || blocked(x, y + dy)))) continue;
        prev.set(key, [x, y]); q.push([nx, ny]);
      }
    }
    const out = []; let cur = [tx, ty];
    if (!prev.has(tx + ',' + ty)) return [];
    while (cur && !(cur[0] === sx && cur[1] === sy)) { out.unshift(cur); cur = prev.get(cur[0] + ',' + cur[1]); }
    return out;
  }

  const resize = () => {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();
  let visible = true;
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); }).observe(stage);
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    if (!visible) return;
    if (path.length) {
      const [x, y] = path[0];
      tmp.set(x + 0.5 - hero.position.x, 0, y + 0.5 - hero.position.z);
      const d = tmp.length();
      if (d < 0.04) { hero.position.set(x + 0.5, 0, y + 0.5); path.shift(); }
      else {
        hero.position.addScaledVector(tmp.normalize(), Math.min(d, dt * 3.2));
        const want = Math.atan2(tmp.x, tmp.z);
        let a = want - hero.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
        hero.rotation.y += a * Math.min(1, dt * 12);
      }
    }
    const moving = path.length > 0;
    if (moving !== walking) {
      walking = moving;
      const [from, to] = moving ? [idle, walk] : [walk, idle];
      to.reset().play(); from.crossFadeTo(to, 0.2, false);
    }
    for (const c of goblins) c.parent.rotation.y = Math.atan2(camera.position.x - c.parent.position.x, camera.position.z - c.parent.position.z);
    mixer.update(dt);
    controls.update();
    renderer.render(scene, camera);
  });
  stage.style.backgroundImage = 'none';
}
