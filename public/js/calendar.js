// Calendário do mundo: relógio no topo para todos; o mestre passa o tempo, marca descansos e edita os meses.
import { app, emit } from './core.js';
import { $, h, setKids, openModal, toast } from './util.js';

const clock = $('#clock');
let lastKey = '';

export function describe(cal) {
  if (!cal) return '';
  const m = cal.months[cal.month];
  const hh = String(Math.floor(cal.minutes / 60)).padStart(2, '0');
  const mm = String(cal.minutes % 60).padStart(2, '0');
  const date = m.festival ? `${m.name}, ${cal.year} ${cal.era}` : `${cal.day} de ${m.name} de ${cal.year} ${cal.era}`;
  return `${date} · ${hh}:${mm}`;
}

function period(minutes) {
  const hr = Math.floor(minutes / 60);
  if (hr < 5) return '🌑';
  if (hr < 7) return '🌅';
  if (hr < 18) return '☀';
  if (hr < 20) return '🌇';
  return '🌙';
}

export function renderClock(state) {
  const cal = state.calendar;
  const key = JSON.stringify([cal, app.isGM]);
  if (key === lastKey) return;
  lastKey = key;
  clock.hidden = !cal;
  if (!cal) return;
  setKids(clock, h('span', { class: 'clock-icon', 'aria-hidden': 'true' }, period(cal.minutes)), h('span', { class: 'clock-text' }, describe(cal)));
  clock.title = app.isGM ? 'Data no mundo do jogo — clique para passar o tempo ou marcar descansos' : 'Data no mundo do jogo';
  clock.classList.toggle('gm', app.isGM);
}

clock.addEventListener('click', () => { if (app.isGM) openCalendar(); });

// ------------------------------------------------------------ janela do mestre
function openCalendar() {
  const cal = () => app.state.calendar;
  const now = h('p', { class: 'cal-now' });
  const drawNow = () => setKids(now, period(cal().minutes), ' ', describe(cal()));
  drawNow();
  const refresh = () => setTimeout(drawNow, 150);

  const step = (label, minutes, announce) => h('button', {
    class: 'btn sm',
    onclick: async () => { if (await emit('calendar:advance', { minutes, announce })) refresh(); },
  }, label);

  // definir data
  const c = cal();
  const year = h('input', { type: 'number', class: 'num', value: String(c.year), 'aria-label': 'Ano' });
  const month = h('select', { 'aria-label': 'Mês' }, c.months.map((m, i) => h('option', { value: String(i), selected: i === c.month }, m.name)));
  const day = h('input', { type: 'number', class: 'num', min: '1', value: String(c.day), 'aria-label': 'Dia' });
  const time = h('input', { type: 'time', value: `${String(Math.floor(c.minutes / 60)).padStart(2, '0')}:${String(c.minutes % 60).padStart(2, '0')}`, 'aria-label': 'Hora' });

  // editar meses
  const months = h('textarea', {
    rows: 8, 'aria-label': 'Meses',
    value: c.months.map((m) => `${m.name} | ${m.days}${m.festival ? ' | festival' : ''}`).join('\n'),
  });
  const era = h('input', { value: c.era, maxlength: '12', 'aria-label': 'Era', style: { width: '90px' } });

  const modal = openModal('Calendário do mundo', [
    now,
    h('h4', {}, 'Passar o tempo'),
    h('div', { class: 'row gap wrap' },
      step('+10 min', 10), step('+1 hora', 60), step('+8 horas', 480, 'Passaram-se 8 horas'),
      step('+1 dia', 1440, 'Passou-se um dia'), step('+1 semana (10 dias)', 14400, 'Passou-se uma dezena'),
      step('−1 hora', -60)),
    h('h4', {}, 'Descansos'),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn', onclick: async () => { if (await emit('rest:short')) { toast('Descanso curto marcado', 'ok'); refresh(); } } }, '☕ Descanso curto (1 h)'),
      h('button', {
        class: 'btn primary',
        onclick: async () => {
          if (!confirm('Descanso longo para o grupo?\n\nPassa 8 horas e, para os personagens dos jogadores: PV cheios, espaços de magia recuperados e metade dos dados de vida de volta.')) return;
          if (await emit('rest:long')) { toast('Descanso longo feito', 'ok'); refresh(); }
        },
      }, '🌙 Descanso longo')),
    h('p', { class: 'muted small' }, 'No descanso curto, cada jogador gasta os próprios dados de vida na ficha.'),
    h('h4', {}, 'Definir a data'),
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'mini' }, 'Dia', day), h('label', { class: 'mini' }, 'Mês', month),
      h('label', { class: 'mini' }, 'Ano', year), h('label', { class: 'mini' }, 'Hora', time),
      h('button', {
        class: 'btn sm',
        onclick: async () => {
          const [hh, mm] = (time.value || '08:00').split(':').map(Number);
          if (await emit('calendar:set', { year: Number(year.value), month: Number(month.value), day: Number(day.value), hour: hh, minute: mm })) refresh();
        },
      }, 'Aplicar')),
    h('details', { class: 'block' }, h('summary', {}, 'Meses do mundo'),
      h('div', { class: 'stack' },
        h('p', { class: 'muted small' }, 'Um mês por linha: Nome | dias. Para um dia festivo fora dos meses, acrescente "| festival". O padrão é o calendário de Harptos (Faerûn): troque os nomes pelos do seu mundo.'),
        months,
        h('div', { class: 'row gap wrap' },
          h('label', { class: 'mini' }, 'Era', era),
          h('span', { class: 'grow' }),
          h('button', {
            class: 'btn sm ghost',
            onclick: async () => { if (confirm('Voltar ao calendário de Harptos (e à data 1 de Hammer de 1492)?') && await emit('calendar:reset')) { modal.close(); toast('Calendário padrão restaurado', 'ok'); } },
          }, 'Restaurar padrão'),
          h('button', {
            class: 'btn sm primary',
            onclick: async () => {
              const list = months.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
                const [name, days, fest] = l.split('|').map((x) => x.trim());
                return { name, days: Number(days) || 30, festival: /fest/i.test(fest || '') };
              });
              if (await emit('calendar:config', { months: list, era: era.value })) { modal.close(); toast('Calendário salvo', 'ok'); }
            },
          }, 'Salvar meses')))),
  ], { wide: true });
}

// ------------------------------------------------------------ aviso de versão nova (mestre)
const banner = h('div', { class: 'update-banner', hidden: true });
document.body.append(banner);
let dismissed = '';
try { dismissed = localStorage.getItem('tabula.updateDismissed') || ''; } catch { /* ok */ }

export function renderUpdate(state) {
  const u = state.update;
  if (!u || !app.isGM || dismissed === u.latest) { banner.hidden = true; return; }
  banner.hidden = false;
  setKids(banner,
    h('span', {}, '★ Versão ', h('b', {}, u.latest), ` disponível (você tem ${u.current}). Feche a mesa e rode `, h('code', {}, u.script || 'atualizar.bat'), '.'),
    h('a', { href: 'https://github.com/LP-IQ/tabula/blob/main/CHANGELOG.md', target: '_blank', rel: 'noopener' }, 'O que mudou'),
    h('button', {
      class: 'btn ghost sm', title: 'Esconder este aviso',
      onclick: () => { dismissed = u.latest; try { localStorage.setItem('tabula.updateDismissed', u.latest); } catch { /* ok */ } banner.hidden = true; },
    }, '✕'));
}
