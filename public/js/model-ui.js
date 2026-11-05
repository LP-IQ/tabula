// Controles da miniatura 3D (Vista 3D): enviar um .glb, tamanho e para onde ela olha.
// Usado na ficha do personagem, no painel do token (mestre) e na ficha do bestiário.
import { h, setKids, pickFile, uploadImage, toast } from './util.js';

export async function chooseAndUploadModel() {
  const file = await pickFile('.glb,model/gltf-binary');
  if (!file) return null;
  if (!/\.glb$/i.test(file.name)) { toast('Use um arquivo .glb (glTF binário)', 'error'); return null; }
  try {
    toast('Enviando modelo 3D…');
    return await uploadImage(file);
  } catch (e) {
    toast(e.message, 'error');
    return null;
  }
}

export const EXAMPLE = '/modelos/miniatura-exemplo.glb';
const SCALES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

// value = { model, modelScale, modelTurn }; onChange(patch) recebe só o que mudou.
export function modelControls(value, onChange, { compact = false } = {}) {
  const v = { model: value.model || '', modelScale: value.modelScale || 1, modelTurn: value.modelTurn || 0 };
  const box = h('div', { class: 'model-ctl' + (compact ? ' compact' : '') });
  const set = (patch) => { Object.assign(v, patch); onChange(patch); draw(); };
  function draw() {
    const name = v.model ? decodeURIComponent(v.model.split('/').pop().split('?')[0]) : '';
    setKids(box,
      h('div', { class: 'row gap wrap' },
        h('span', { class: 'model-label' }, '🧊 Miniatura 3D'),
        v.model
          ? h('span', { class: 'muted small grow', title: name }, v.model === EXAMPLE ? 'aventureiro de exemplo' : v.model.startsWith('/uploads/') ? 'modelo enviado' : name)
          : h('span', { class: 'muted small grow' }, 'nenhuma — na Vista 3D aparece a imagem em pé'),
        h('button', { type: 'button', class: 'btn sm', onclick: async () => { const u = await chooseAndUploadModel(); if (u) set({ model: u }); } },
          v.model ? 'Trocar…' : 'Enviar .glb…'),
        v.model ? h('button', { type: 'button', class: 'btn ghost sm', onclick: () => set({ model: '' }) }, 'Tirar')
          : h('button', { type: 'button', class: 'btn ghost sm', title: 'Um aventureiro simples que vem com a Tábula, para experimentar', onclick: () => set({ model: EXAMPLE }) }, 'Usar o exemplo')),
      v.model ? h('div', { class: 'row gap wrap' },
        h('label', { class: 'mini' }, 'Tamanho',
          h('select', { 'aria-label': 'Tamanho da miniatura', onchange: (e) => set({ modelScale: Number(e.target.value) }) },
            SCALES.map((s) => h('option', { value: String(s), selected: Math.abs(s - v.modelScale) < 0.01 }, `${String(s).replace('.', ',')}×`)),
            SCALES.some((s) => Math.abs(s - v.modelScale) < 0.01) ? null : h('option', { value: String(v.modelScale), selected: true }, `${v.modelScale}×`))),
        h('span', { class: 'small muted' }, 'Virar'),
        h('button', { type: 'button', class: 'btn sm', title: 'Girar 45° para a esquerda', 'aria-label': 'Girar para a esquerda', onclick: () => set({ modelTurn: (v.modelTurn + 315) % 360 }) }, '↺'),
        h('span', { class: 'small' }, `${v.modelTurn}°`),
        h('button', { type: 'button', class: 'btn sm', title: 'Girar 45° para a direita', 'aria-label': 'Girar para a direita', onclick: () => set({ modelTurn: (v.modelTurn + 45) % 360 }) }, '↻')) : null);
  }
  draw();
  return box;
}
