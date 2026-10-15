// Estado compartilhado do cliente + comunicação com o servidor.
import { toast } from './util.js';

export const bus = new EventTarget();

export const app = {
  state: null,
  socket: null,
  advMode: 'normal',      // 'normal' | 'adv' | 'dis'  (vale para a próxima rolagem de d20)
  privateRolls: false,
  get me() { return this.state?.me; },
  get isGM() { return this.state?.me?.role === 'gm'; },
  user(id) { return this.state?.users.find((u) => u.id === id); },
  char(id) { return this.state?.characters.find((c) => c.id === id); },
  myCharacters() { return (this.state?.characters || []).filter((c) => c.ownerId === this.me?.id); },
};

// Envia uma ação ao servidor. Resolve com a resposta, ou null se deu erro (o erro já vira aviso na tela).
export function emit(event, payload = {}) {
  return new Promise((resolve) => {
    if (!app.socket?.connected) {
      toast('Sem conexão com o servidor', 'error');
      return resolve(null);
    }
    app.socket.timeout(10000).emit(event, payload, (err, res) => {
      if (err) { toast('O servidor não respondeu', 'error'); return resolve(null); }
      if (!res?.ok) { toast(res?.error || 'Erro', 'error'); return resolve(null); }
      resolve(res);
    });
  });
}

export function setAdv(mode) {
  app.advMode = mode;
  bus.dispatchEvent(new CustomEvent('adv', { detail: mode }));
}

export function doRoll(formula, label = '') {
  return emit('roll', { formula, label, private: app.privateRolls });
}

// Teste de d20 com bônus, respeitando vantagem/desvantagem escolhida (que volta ao normal depois)
export function rollD20(bonus, label) {
  const m = app.advMode;
  const base = m === 'adv' ? '2d20kh1' : m === 'dis' ? '2d20kl1' : '1d20';
  const b = Number(bonus) || 0;
  const formula = base + (b ? (b > 0 ? `+${b}` : `${b}`) : '');
  const suffix = m === 'adv' ? ' · vantagem' : m === 'dis' ? ' · desvantagem' : '';
  setAdv('normal');
  return doRoll(formula, label + suffix);
}
