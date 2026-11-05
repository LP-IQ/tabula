// Vista 3D do mapa (three.js). O mapa da cena vira o chão de um tabuleiro; cada token vira uma miniatura:
// o modelo .glb do personagem/NPC, se houver, ou a imagem do token "em pé" numa base colorida.
// Tudo o que vale no 2D continua valendo: o servidor manda só o que cada um pode ver, a névoa cobre o chão,
// cada um só arrasta os próprios tokens, dois toques abrem a ficha e dois toques no chão sinalizam um ponto.
// Este arquivo só é carregado quando alguém liga a Vista 3D.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { initials, toast } from './util.js';
import { CONDITION_ICON } from './rules.js';

const BASE_H = 0.08;            // altura da base da miniatura (1 unidade = 1 quadrado da grade)
const CARD_W = 0.84;            // imagem em pé: largura e altura relativas ao tamanho do token
const CARD_H = 1.18;
const MODEL_H = 1.35;           // altura padrão de um modelo .glb (criatura Média)
// criaturas Grandes ou maiores não crescem na mesma proporção na altura (senão a cena vira uma floresta de cartazes)
const figScale = (size) => (size >= 2 ? size * 0.62 : size);

// ------------------------------------------------------------------ modelos .glb (um download por arquivo)
const gltfCache = new Map();
let loader = null;
function loadModel(url) {
  if (!loader) {
    const draco = new DRACOLoader().setDecoderPath('/vendor/three/addons/libs/draco/');
    loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  }
  if (!gltfCache.has(url)) {
    gltfCache.set(url, new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)));
  }
  return gltfCache.get(url);
}
const failed = new Set();

// ------------------------------------------------------------------ texturas desenhadas em canvas
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const imgCache = new Map();
function loadImage(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((resolve) => {
      const im = new Image();
      if (!src.startsWith('/')) im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    }));
  }
  return imgCache.get(src);
}
// Cartão da miniatura de papelão: moldura na cor do dono, imagem recortada (ou as iniciais)
function cardCanvas(info, im) {
  const W = 256, H = Math.round(256 * CARD_H / CARD_W);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const r = 26;
  ctx.fillStyle = info.color;
  roundRect(ctx, 0, 0, W, H, r);
  ctx.fill();
  ctx.save();
  roundRect(ctx, 9, 9, W - 18, H - 18, r - 8);
  ctx.clip();
  ctx.fillStyle = '#1d1a24';
  ctx.fillRect(0, 0, W, H);
  let drawn = false;
  if (im) {
    try {
      const s = Math.max((W - 18) / im.width, (H - 18) / im.height);
      const w = im.width * s, h = im.height * s;
      ctx.drawImage(im, (W - w) / 2, 9 + (H - 18 - h) * 0.25, w, h);
      ctx.getImageData(0, 0, 1, 1); // imagem de outro site sem permissão: cai nas iniciais
      drawn = true;
    } catch {
      ctx.fillStyle = '#1d1a24';
      ctx.fillRect(0, 0, W, H);
    }
  }
  if (!drawn) {
    ctx.fillStyle = '#e8dcc0';
    ctx.font = `700 ${Math.round(W * 0.36)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(info.name), W / 2, H / 2);
  }
  const grad = ctx.createLinearGradient(0, H * 0.7, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  return cv;
}
// Etiqueta acima da miniatura: nome, barra de vida e condições
function labelCanvas(info, hp, conds) {
  const W = 512, H = 150;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.font = '700 46px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = info.name.length > 22 ? info.name.slice(0, 21) + '…' : info.name;
  const tw = Math.min(W - 20, ctx.measureText(name).width + 36);
  ctx.fillStyle = 'rgba(14,12,20,.78)';
  roundRect(ctx, (W - tw) / 2, 8, tw, 60, 22);
  ctx.fill();
  ctx.fillStyle = '#f4ecd8';
  ctx.fillText(name, W / 2, 40);
  let y = 80;
  if (hp) {
    const bw = 220;
    ctx.fillStyle = 'rgba(14,12,20,.85)';
    roundRect(ctx, (W - bw) / 2 - 4, y - 4, bw + 8, 22, 11);
    ctx.fill();
    ctx.fillStyle = hp.ratio <= 0 ? '#6b6b6b' : hp.ratio <= 0.5 ? '#d4573e' : '#5fb35a';
    roundRect(ctx, (W - bw) / 2, y, Math.max(6, bw * hp.ratio), 14, 7);
    ctx.fill();
    y += 30;
  }
  if (conds.length) {
    ctx.font = '36px system-ui, sans-serif';
    ctx.fillText(conds.slice(0, 6).map((k) => CONDITION_ICON[k] || '•').join(' '), W / 2, y + 16);
  }
  return cv;
}
function canvasTexture(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ==================================================================== cena
export function start(host, api) {
  host.hidden = false;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  const coarse = matchMedia('(pointer: coarse)').matches;   // celular/tablet: economiza bateria
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.append(renderer.domElement);
  const hint = document.createElement('div');
  hint.className = 'map3d-hint';
  hint.textContent = coarse
    ? 'Arraste para andar pelo mapa · dois dedos giram e aproximam · toque duas vezes num token para a ficha'
    : 'Arraste para andar · botão direito gira · roda aproxima · dois cliques num token abrem a ficha';
  host.append(hint);

  const scene3 = new THREE.Scene();
  scene3.background = new THREE.Color('#0e0d12');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = 1.38;
  controls.minDistance = 1.5;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };

  // luz: céu + "sol" com sombra (as miniaturas fazem sombra no mapa)
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x3a3550, 2.1);
  scene3.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene3.add(sun, sun.target);

  // mesa: tabuleiro escuro sob o mapa
  const table = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#17141d', roughness: 1 }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.25;
  table.receiveShadow = true;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshStandardMaterial({ color: '#2a2230', roughness: 0.9 }));
  board.position.y = -0.112;
  board.castShadow = false;
  board.receiveShadow = true;
  const groundMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.38 }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.004;
  shadowCatcher.receiveShadow = true;
  const fogMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: '#ffffff', toneMapped: false });
  const fogMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fogMat);
  fogMesh.rotation.x = -Math.PI / 2;
  fogMesh.position.y = 0.012;
  fogMesh.renderOrder = 2;
  scene3.add(table, board, ground, shadowCatcher, fogMesh);
  const tokensRoot = new THREE.Group();
  scene3.add(tokensRoot);
  const fx = new THREE.Group();
  scene3.add(fx);

  const st = {
    sceneId: null, W: 1, H: 1, g: 70, groundKey: '', fogKey: '', fitted: false,
    dirty: true, recs: new Map(), pings: [], drag: null, down: null, lastTap: { t: 0, x: 0, y: 0 },
    selected: null, raf: 0, clock: new THREE.Clock(), stopped: false,
  };
  const mark = () => { st.dirty = true; };
  controls.addEventListener('change', mark);

  // ------------------------------------------------------------ tamanho da tela
  const resize = () => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    mark();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ------------------------------------------------------------ chão (mapa + grade + desenhos)
  let groundTex = null;
  let drawImgUrl = null;
  function buildGround(sc) {
    const { w, h } = api.mapSize();
    const im = api.mapImg();
    const draws = sc.drawings || [];
    const key = JSON.stringify([sc.id, im?.src || '', w, h, sc.showGrid, sc.gridSize, sc.gridOffsetX, sc.gridOffsetY, draws.map((d) => d.id)]);
    if (key === st.groundKey) return;
    st.groundKey = key;
    const max = Math.min(4096, renderer.capabilities.maxTextureSize || 4096);
    const k = Math.min(1, max / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.max(2, Math.round(w * k));
    cv.height = Math.max(2, Math.round(h * k));
    const ctx = cv.getContext('2d');
    const paint = (drawingsImg) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (im) {
        ctx.drawImage(im, 0, 0, cv.width, cv.height);
      } else {
        ctx.fillStyle = '#2b2733';
        ctx.fillRect(0, 0, cv.width, cv.height);
      }
      ctx.setTransform(k, 0, 0, k, 0, 0);
      if (sc.showGrid) {
        const g = sc.gridSize;
        ctx.strokeStyle = 'rgba(10,8,14,.42)';
        ctx.lineWidth = Math.max(1, 1.2 / k);
        ctx.beginPath();
        for (let x = ((sc.gridOffsetX % g) + g) % g; x <= w; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = ((sc.gridOffsetY % g) + g) % g; y <= h; y += g) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
      }
      if (drawingsImg) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(drawingsImg, 0, 0, cv.width, cv.height);
      }
      if (groundTex) groundTex.dispose();
      groundTex = canvasTexture(cv);
      groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      groundMat.map = groundTex;
      groundMat.needsUpdate = true;
      mark();
    };
    paint(null);
    // desenhos salvos: o SVG da camada 2D vira imagem por cima do mapa
    const svg = api.drawSvg();
    if (draws.length && svg) {
      const xml = new XMLSerializer().serializeToString(svg);
      if (drawImgUrl) URL.revokeObjectURL(drawImgUrl);
      drawImgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
      const di = new Image();
      di.onload = () => { if (st.groundKey === key) paint(di); };
      di.src = drawImgUrl;
    }
  }
  function layoutBoard(sc) {
    const { w, h } = api.mapSize();
    const g = sc.gridSize;
    const W = w / g, H = h / g;
    if (W === st.W && H === st.H && g === st.g) return;
    st.W = W; st.H = H; st.g = g;
    for (const m of [ground, shadowCatcher, fogMesh]) {
      m.scale.set(W, H, 1);
      m.position.x = W / 2;
      m.position.z = H / 2;
    }
    board.scale.set(W + 0.5, 1, H + 0.5);
    board.position.set(W / 2, -0.112, H / 2);   // o topo fica logo abaixo do mapa
    const big = Math.max(W, H);
    table.scale.set(big * 6, big * 6, 1);
    table.position.set(W / 2, -0.25, H / 2);
    sun.position.set(W / 2 - big * 0.35, big * 0.9, H / 2 + big * 0.55);
    sun.target.position.set(W / 2, 0, H / 2);
    const sc2 = sun.shadow.camera;
    sc2.left = -big * 0.8; sc2.right = big * 0.8; sc2.top = big * 0.8; sc2.bottom = -big * 0.8;
    sc2.near = 0.1; sc2.far = big * 3;
    sc2.updateProjectionMatrix();
    controls.maxDistance = big * 2.5 + 10;
    camera.far = big * 12 + 100;
    camera.updateProjectionMatrix();
    mark();
  }
  // enquadra um retângulo do tabuleiro (em quadrados), inclinado ou visto de cima
  function frame(x0, z0, x1, z1, top) {
    const fov = (camera.fov * Math.PI) / 180;
    const polar = top ? 0.02 : 0.9;
    const w = x1 - x0, hgt = z1 - z0;
    const needH = Math.max(hgt * (top ? 1 : 0.8), w / camera.aspect);
    const d = (needH / 2 / Math.tan(fov / 2)) * 1.08;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    controls.target.set(cx, 0, cz);
    camera.position.set(cx, Math.cos(polar) * d, cz + Math.sin(polar) * d);
    controls.update();
    st.top = top;
    mark();
  }
  const fit = (top = false) => frame(0, 0, st.W, st.H, top);
  // primeira vista: perto das miniaturas (no celular o mapa inteiro fica pequeno demais)
  function fitTokens() {
    const list = [...st.recs.values()];
    if (!list.length) return fit(false);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const r of list) {
      x0 = Math.min(x0, r.target.x - r.size / 2); x1 = Math.max(x1, r.target.x + r.size / 2);
      z0 = Math.min(z0, r.target.z - r.size / 2); z1 = Math.max(z1, r.target.z + r.size / 2);
    }
    const minW = Math.min(st.W, 10), minH = Math.min(st.H, 7);
    const pad = 2;
    x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
    if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
    if (z1 - z0 < minH) { const c = (z0 + z1) / 2; z0 = c - minH / 2; z1 = c + minH / 2; }
    frame(x0, z0, x1, z1, false);
  }

  // ------------------------------------------------------------ névoa
  let fogTex = null;
  function syncFog(sc, isGM) {
    const on = !!sc.fog?.enabled;
    const key = JSON.stringify([on, sc.fog?.ops?.length, sc.fog?.ops?.at?.(-1), st.W, st.H]);
    fogMesh.visible = on;
    if (!on || key === st.fogKey) return;
    st.fogKey = key;
    const cv = api.fogCanvas();
    if (!fogTex || fogTex.image !== cv) {
      fogTex?.dispose();
      fogTex = new THREE.CanvasTexture(cv);
      fogTex.colorSpace = THREE.SRGBColorSpace;
      fogMat.map = fogTex;
    }
    fogTex.needsUpdate = true;
    fogMat.opacity = isGM ? 0.5 : 1;
    fogMat.needsUpdate = true;
    mark();
  }

  // ------------------------------------------------------------ miniaturas
  const ringGeo = new THREE.TorusGeometry(1, 0.045, 8, 48);
  function makeRec(t) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.47, 0.5, BASE_H, 40),
      new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.55, metalness: 0.15 }));
    base.position.y = BASE_H / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = false;
    const yaw = new THREE.Group();     // gira para a câmera (papelão) ou para onde anda (modelo)
    const tilt = new THREE.Group();    // tomba quando cai a 0 PV
    tilt.position.y = BASE_H;
    yaw.add(tilt);
    const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 12), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = 0.5;
    pick.userData.tokenId = t.id;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    label.renderOrder = 10;
    group.add(base, ring, yaw, pick, label);
    tokensRoot.add(group);
    const rec = {
      id: t.id, group, base, ring, yaw, tilt, pick, label, card: null, model: null, modelUrl: '', mixer: null,
      actions: {}, walking: false, figH: CARD_H, size: t.size, cardKey: '', labelKey: '', look: 0, facing: 0,
      pos: new THREE.Vector3(), target: new THREE.Vector3(), placed: false, down: false, opacity: 1,
    };
    st.recs.set(t.id, rec);
    return rec;
  }
  function disposeRec(rec) {
    tokensRoot.remove(rec.group);
    rec.group.traverse((o) => {
      if (o.geometry && o.geometry !== ringGeo) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) { m.map?.dispose?.(); m.dispose?.(); }
    });
    rec.mixer?.stopAllAction();
    st.recs.delete(rec.id);
  }
  function setCard(rec, info) {
    const key = JSON.stringify([info.img, info.name, info.color]);
    if (rec.cardKey === key) return;
    rec.cardKey = key;
    const apply = (im) => {
      if (rec.cardKey !== key || st.stopped) return;
      const tex = canvasTexture(cardCanvas(info, im));
      if (!rec.card) {
        rec.card = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H),
          new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5, toneMapped: false }));
        rec.card.position.y = CARD_H / 2 + 0.02;
        rec.card.castShadow = true;
        rec.tilt.add(rec.card);
      } else {
        rec.card.material.map?.dispose();
        rec.card.material.map = tex;
        rec.card.material.needsUpdate = true;
      }
      rec.card.visible = !rec.model;
      applyOpacity(rec, rec.opacity, true);
      mark();
    };
    if (info.img) loadImage(info.img).then(apply);
    else apply(null);
  }
  function setModel(rec, url, scale, turn, size) {
    const key = JSON.stringify([url, scale, size]);
    rec.turn = (turn || 0) * Math.PI / 180;
    if (rec.modelKey === key) return;
    rec.modelKey = key;
    if (rec.model) {
      rec.tilt.remove(rec.model);
      rec.mixer?.stopAllAction();
      rec.model = null; rec.mixer = null; rec.actions = {};
    }
    rec.figH = CARD_H;
    if (rec.card) rec.card.visible = true;
    if (!url) { mark(); return; }
    loadModel(url).then((gltf) => {
      if (rec.modelKey !== key || st.stopped) return;
      const obj = cloneSkinned(gltf.scene);
      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      });
      // ajusta o tamanho: altura de miniatura, sem passar da base (criaturas largas)
      const box = new THREE.Box3().setFromObject(obj);
      const sz = box.getSize(new THREE.Vector3());
      const hgt = sz.y || 1;
      const foot = Math.max(sz.x, sz.z) || 1;
      let k = Math.min(MODEL_H / hgt, 1.15 / foot) * (scale || 1);
      if (!Number.isFinite(k) || k <= 0) k = 1;
      const center = box.getCenter(new THREE.Vector3());
      const holder = new THREE.Group();
      obj.position.set(-center.x, -box.min.y, -center.z);
      holder.add(obj);
      holder.scale.setScalar(k);
      rec.tilt.add(holder);
      rec.model = holder;
      rec.figH = hgt * k;
      if (rec.card) rec.card.visible = false;
      // animações: parado (idle) e andando (walk), se o modelo tiver
      if (gltf.animations?.length) {
        rec.mixer = new THREE.AnimationMixer(obj);
        const find = (re) => gltf.animations.find((a) => re.test(a.name));
        const idle = find(/idle|stand|parad|breath/i) || gltf.animations[0];
        const walk = find(/walk|run|andar|correr/i);
        rec.actions.idle = rec.mixer.clipAction(idle);
        if (walk && walk !== idle) rec.actions.walk = rec.mixer.clipAction(walk);
        rec.actions.idle.play();
      }
      applyOpacity(rec, rec.opacity, true);
      placeLabel(rec);
      mark();
    }).catch((e) => {
      console.warn('modelo 3D', url, e);
      if (!failed.has(url)) {
        failed.add(url);
        toast('Um modelo 3D não carregou (o arquivo .glb pode estar corrompido); usando a imagem em pé', 'error', 6000);
      }
    });
  }
  function applyOpacity(rec, a, force) {
    if (rec.opacity === a && !force) return;
    rec.opacity = a;
    rec.group.traverse((o) => {
      if (o === rec.pick || o === rec.label || o === rec.ring) return;
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        m.transparent = a < 1 || m === rec.card?.material;
        m.opacity = a;
        m.depthWrite = a >= 1;
      }
    });
  }
  function placeLabel(rec) {
    const s = Math.max(1, rec.size * 0.75);
    rec.label.scale.set(2 * s, 0.58 * s, 1);
    const top = BASE_H + rec.figH * figScale(rec.size);
    rec.label.position.y = top + 0.42 * s;
    rec.pick.scale.set(rec.size, top, rec.size);
    rec.pick.position.y = top / 2;
  }

  function syncTokens(sc, state) {
    const g = sc.gridSize;
    const seen = new Set();
    const ini = state.initiative;
    const cur = ini?.active ? ini.entries.find((e) => e.id === ini.currentId) : null;
    for (const t of sc.tokens) {
      seen.add(t.id);
      const rec = st.recs.get(t.id) || makeRec(t);
      const info = api.tokenInfo(t);
      const c = info.c;
      const size = t.size;
      rec.size = size;
      rec.t = t;
      rec.group.scale.setScalar(1);
      rec.base.scale.set(size, 1, size);
      rec.ring.scale.setScalar(size * 0.56);
      rec.tilt.scale.setScalar(figScale(size));
      if (!(st.drag && st.drag.id === t.id)) {
        rec.target.set(t.x / g + size / 2, 0, t.y / g + size / 2);
        if (!rec.placed) { rec.pos.copy(rec.target); rec.placed = true; }
      }
      setCard(rec, info);
      const model = (c && c.model) || t.model || '';
      const mScale = (c && c.model ? c.modelScale : t.modelScale) || 1;
      const mTurn = (c && c.model ? c.modelTurn : t.modelTurn) || 0;
      setModel(rec, model, mScale, mTurn, size);
      // estado: vida, oculto, caído, turno
      const showHp = info.hpMax > 0 && (!!c || api.isGM());
      const ratio = showHp ? Math.max(0, Math.min(1, info.hp / info.hpMax)) : 1;
      const npcState = t.hpState || (!c && info.hpMax ? (info.hp <= 0 ? 'down' : info.hp <= info.hpMax / 2 ? 'bloodied' : 'ok') : 'ok');
      rec.down = npcState === 'down' || (!!c && info.hpMax > 0 && info.hp <= 0);
      const conds = (c ? c.conditions : t.conditions) || [];
      const lk = JSON.stringify([info.name, showHp ? Math.round(ratio * 40) : -1, conds]);
      if (lk !== rec.labelKey) {
        rec.labelKey = lk;
        rec.label.material.map?.dispose();
        rec.label.material.map = canvasTexture(labelCanvas(info, showHp ? { ratio } : null, conds));
        rec.label.material.needsUpdate = true;
      }
      rec.base.material.color.set(npcState === 'bloodied' ? '#7a2222' : info.color);
      applyOpacity(rec, t.hidden ? 0.45 : 1);
      rec.isCurrent = !!cur && (cur.tokenId === t.id || (!!t.characterId && cur.characterId === t.characterId));
      placeLabel(rec);
    }
    for (const rec of [...st.recs.values()]) if (!seen.has(rec.id)) disposeRec(rec);
    mark();
  }

  // ------------------------------------------------------------ animação
  const tmp = new THREE.Vector3();
  function tick() {
    if (st.stopped) return;
    const dt = Math.min(0.1, st.clock.getDelta());
    let busy = controls.update() || false;   // algo mudando agora: desenha todo quadro
    let ambient = false;                      // só animação de fundo (respirar, anel do turno): 30 quadros/s bastam
    const sel = api.selectedId();
    if (sel !== st.selected) { st.selected = sel; st.dirty = true; }
    const now = performance.now() / 1000;
    for (const rec of st.recs.values()) {
      // anda até o destino
      tmp.subVectors(rec.target, rec.pos);
      const dist = tmp.length();
      const moving = dist > 0.01;
      if (moving) {
        const step = Math.min(dist, Math.max(dist * dt * 9, dt * 4));
        rec.pos.addScaledVector(tmp.normalize(), step);
        if (dist > 0.05) rec.facing = Math.atan2(tmp.x, tmp.z);
        busy = true;
      } else rec.pos.copy(rec.target);
      rec.group.position.copy(rec.pos);
      // pulinho da miniatura de papelão enquanto anda
      rec.tilt.position.y = BASE_H + (moving && !rec.model ? Math.abs(Math.sin(now * 14)) * 0.12 : 0);
      if (rec.actions.walk && moving !== rec.walking) {
        rec.walking = moving;
        const [a, b] = moving ? [rec.actions.idle, rec.actions.walk] : [rec.actions.walk, rec.actions.idle];
        b.reset().play();
        a.crossFadeTo(b, 0.25, false);
      }
      // papelão olha para a câmera; modelo olha para onde anda
      if (rec.model) {
        const want = rec.facing + (rec.turn || 0);
        let d = want - rec.yaw.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) > 0.002) { rec.yaw.rotation.y += d * Math.min(1, dt * 10); busy = true; }
      } else {
        rec.yaw.rotation.y = Math.atan2(camera.position.x - rec.pos.x, camera.position.z - rec.pos.z);
      }
      // cai deitado com 0 PV
      const tiltWant = rec.down ? -Math.PI / 2 * 0.92 : 0;
      const td = tiltWant - rec.tilt.rotation.x;
      if (Math.abs(td) > 0.002) { rec.tilt.rotation.x += td * Math.min(1, dt * 8); busy = true; }
      // anel: turno atual (dourado, pulsando) ou selecionado (branco)
      const selected = rec.id === st.selected;
      rec.ring.visible = selected || rec.isCurrent;
      if (rec.isCurrent) {
        rec.ring.material.color.set('#f0c24b');
        rec.ring.material.opacity = 0.6 + Math.sin(now * 4) * 0.35;
        ambient = true;
      } else if (selected) {
        rec.ring.material.color.set('#ffffff');
        rec.ring.material.opacity = 0.9;
      }
      if (rec.mixer) { rec.mixer.update(dt); ambient = true; }
    }
    // sinalizações (ping)
    for (const p of [...st.pings]) {
      const age = now - p.t0;
      if (age > 2.2) { fx.remove(p.obj); p.obj.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); st.pings.splice(st.pings.indexOf(p), 1); continue; }
      const k = (age % 1.1) / 1.1;
      p.ring.scale.setScalar(0.3 + k * 1.6);
      p.ring.material.opacity = (1 - k) * 0.9;
      p.beam.material.opacity = Math.max(0, 0.45 * (1 - age / 2.2));
      busy = true;
    }
    const t = performance.now();
    if (busy || st.dirty || (ambient && t - (st.lastFrame || 0) > 32)) {
      renderer.render(scene3, camera);
      st.dirty = false;
      st.lastFrame = t;
    }
  }
  renderer.setAnimationLoop(tick);

  // ------------------------------------------------------------ toque, clique e arrasto
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function setRay(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function groundAt(e) {
    setRay(e);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, p) ? p : null;
  }
  function tokenAt(e) {
    setRay(e);
    const hits = ray.intersectObjects([...st.recs.values()].map((r) => r.pick), false);
    return hits.length ? st.recs.get(hits[0].object.userData.tokenId) : null;
  }
  const pointers = new Set();
  const el = renderer.domElement;
  const onDown = (e) => {
    pointers.add(e.pointerId);
    if (pointers.size > 1) {
      // segundo dedo: vira gesto de câmera
      if (st.drag) cancelDrag();
      st.down = null;
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) { st.down = null; return; }
    const rec = tokenAt(e);
    st.down = { x: e.clientX, y: e.clientY, t: performance.now(), rec };
    const sc = api.getScene();
    if (rec && sc && api.canMove(rec.t)) {
      e.stopPropagation(); // a câmera não anda enquanto arrasta um token
      const p = groundAt(e);
      if (!p) return;
      st.drag = { id: rec.id, rec, t: rec.t, ox: rec.pos.x - p.x, oz: rec.pos.z - p.z, moved: false, last: 0, x: rec.t.x, y: rec.t.y };
      try { el.setPointerCapture(e.pointerId); } catch { /* ok */ }
    }
  };
  const onMove = (e) => {
    const d = st.drag;
    if (!d) return;
    if (!d.moved && st.down && Math.hypot(e.clientX - st.down.x, e.clientY - st.down.y) < 5) return;
    d.moved = true;
    const p = groundAt(e);
    if (!p) return;
    const sc = api.getScene();
    const g = sc.gridSize;
    const cx = p.x + d.ox, cz = p.z + d.oz;
    d.rec.target.set(cx, 0, cz);
    d.x = (cx - d.t.size / 2) * g;
    d.y = (cz - d.t.size / 2) * g;
    const now = performance.now();
    if (now - d.last > 70) { d.last = now; api.move(d.t, d.x, d.y, false); }
    mark();
  };
  function cancelDrag() {
    const d = st.drag;
    st.drag = null;
    if (!d) return;
    const g = api.getScene()?.gridSize || st.g;
    d.rec.target.set(d.t.x / g + d.t.size / 2, 0, d.t.y / g + d.t.size / 2);
  }
  const onUp = (e) => {
    pointers.delete(e.pointerId);
    const down = st.down;
    st.down = null;
    const d = st.drag;
    if (d) {
      st.drag = null;
      if (d.moved) {
        const s = api.snap(d.x, d.y, d.t.size);
        const g = api.getScene().gridSize;
        d.rec.target.set(s.x / g + d.t.size / 2, 0, s.y / g + d.t.size / 2);
        api.move(d.t, s.x, s.y, true).then((ok) => {
          if (!ok) d.rec.target.set(d.t.x / g + d.t.size / 2, 0, d.t.y / g + d.t.size / 2);
          mark();
        });
        return;
      }
    }
    if (!down || e.type === 'pointercancel') return;
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 500;
    if (!tap) return;
    if (down.rec) {
      api.select(down.rec.id);
      api.tap(down.rec.t);
      mark();
      return;
    }
    const now = performance.now();
    const lt = st.lastTap;
    if (now - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30) {
      st.lastTap = { t: 0, x: 0, y: 0 };
      const p = groundAt(e);
      const g = api.getScene()?.gridSize || st.g;
      if (p) api.ping({ x: p.x * g, y: p.z * g });
    } else {
      st.lastTap = { t: now, x: e.clientX, y: e.clientY };
      api.select(null);
    }
  };
  // a imagem do mapa terminou de carregar depois da vista 3D abrir: refaz o chão
  let lastScene = null;
  const onMapLoaded = () => { if (lastScene) { st.groundKey = ''; layoutBoard(lastScene); buildGround(lastScene); } };
  document.body.addEventListener('map-loaded', onMapLoaded);
  host.addEventListener('pointerdown', onDown, { capture: true });
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  host.addEventListener('contextmenu', (e) => e.preventDefault());

  // ------------------------------------------------------------ API para o map.js
  return {
    render(state) {
      const sc = state.scene;
      api.isGM = () => state.me?.role === 'gm';
      host.classList.toggle('empty', !sc);
      if (!sc) {
        for (const rec of [...st.recs.values()]) disposeRec(rec);
        st.sceneId = null;
        mark();
        return;
      }
      if (sc.id !== st.sceneId) {
        for (const rec of [...st.recs.values()]) disposeRec(rec);
        st.sceneId = sc.id;
        st.fitted = false;
        st.groundKey = '';
        st.fogKey = '';
      }
      lastScene = sc;
      layoutBoard(sc);
      buildGround(sc);
      syncFog(sc, state.me?.role === 'gm');
      syncTokens(sc, state);
      if (!st.fitted && host.clientWidth) { fitTokens(); st.fitted = true; }
    },
    moved(m) {
      const rec = st.recs.get(m.id);
      const sc = api.getScene();
      if (!rec || !sc || (st.drag && st.drag.id === m.id)) return;
      rec.target.set(m.x / sc.gridSize + rec.size / 2, 0, m.y / sc.gridSize + rec.size / 2);
      mark();
    },
    ping(p) {
      const sc = api.getScene();
      if (!sc) return;
      const color = new THREE.Color(p.color || '#f0c24b');
      const obj = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 3;
      obj.add(ring, beam);
      obj.position.set(p.x / sc.gridSize, 0, p.y / sc.gridSize);
      fx.add(obj);
      st.pings.push({ obj, ring, beam, t0: performance.now() / 1000 });
      mark();
    },
    zoom(k) {
      const off = camera.position.clone().sub(controls.target).multiplyScalar(1 / k);
      const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, off.length()));
      camera.position.copy(controls.target).add(off.setLength(len));
      controls.update();
      mark();
    },
    fit() { fit(!!st.top); },
    // alterna entre a vista inclinada e a vista de cima (mantendo o ponto central)
    toggleTop() {
      const top = !st.top;
      const t = controls.target.clone();
      const d = camera.position.distanceTo(t);
      const polar = top ? 0.02 : 0.9;
      camera.position.set(t.x, Math.cos(polar) * d, t.z + Math.sin(polar) * d);
      controls.update();
      st.top = top;
      mark();
      return top;
    },
    stop() {
      st.stopped = true;
      document.body.removeEventListener('map-loaded', onMapLoaded);
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      for (const rec of [...st.recs.values()]) disposeRec(rec);
      groundTex?.dispose();
      fogTex?.dispose();
      if (drawImgUrl) URL.revokeObjectURL(drawImgUrl);
      renderer.dispose();
      renderer.forceContextLoss?.();
      host.replaceChildren();
      host.hidden = true;
    },
    // para os testes: posição na tela do centro da base de um token
    _screen(id) {
      const rec = st.recs.get(id);
      if (!rec) return null;
      const v = rec.pos.clone().setY(BASE_H + 0.3 * figScale(rec.size)).project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
    _debug: () => ({ tokens: [...st.recs.values()].map((r) => ({ id: r.id, model: !!r.model, card: !!r.card?.visible, x: r.pos.x, z: r.pos.z, down: r.down, tilt: +r.tilt.rotation.x.toFixed(2), opacity: r.opacity, anim: !!r.mixer })), cam: camera.position.toArray() }),
  };
}
