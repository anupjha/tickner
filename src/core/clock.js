import { emit } from './bus.js';
import { today } from './dates.js';

export function startClock(node) {
  let lastDay = today();
  const tick = () => {
    const d = new Date();
    node.textContent =
      d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' · ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    if (today() !== lastDay) { lastDay = today(); emit('day:changed'); }   // overdue / today badges need a refresh
    emit('tick');
  };
  tick();
  setInterval(tick, 1000);
}
