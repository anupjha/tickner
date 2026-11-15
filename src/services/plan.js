// Daily plan rules: time blocks per day, overlap layout, link to tasks.
import { state, persist } from '../core/store.js';
import { uid } from '../core/util.js';
import { setDone } from './todos.js';

export const blocksOf = day => (state.plan[day] || []).slice().sort((a, b) => a.start - b.start || a.end - b.end);
export const linkedTodo = b => state.todos.find(t => t.id === b.todoId);
export const isBlockDone = b => { const t = linkedTodo(b); return t ? t.done : !!b.done; };

// open tasks that have no block on `day` yet
export const unscheduled = (day, limit = 6) => {
  const blocks = blocksOf(day);
  return state.todos.filter(t => !t.done && !blocks.some(b => b.todoId === t.id)).slice(0, limit);
};

export function summarize(day) {
  const blocks = blocksOf(day);
  return { count: blocks.length, minutes: blocks.reduce((a, b) => a + b.end - b.start, 0), done: blocks.filter(isBlockDone).length };
}

// visible hours for a day: 6:00-22:00, stretched to fit blocks outside that range
export function hourRange(blocks) {
  return {
    startH: Math.min(6, ...blocks.map(b => Math.floor(b.start / 60))),
    endH: Math.min(24, Math.max(22, ...blocks.map(b => Math.ceil(b.end / 60))))
  };
}

// place overlapping blocks side by side: returns [{ b, col, n }] (n = columns in its overlap group)
export function layout(blocks) {
  const out = []; let cluster = [], ends = [], clusterEnd = 0;
  const flush = () => { cluster.forEach(c => { c.n = ends.length; }); out.push(...cluster); cluster = []; ends = []; clusterEnd = 0; };
  blocks.forEach(b => {
    if (cluster.length && b.start >= clusterEnd) flush();
    let i = ends.findIndex(e => e <= b.start);
    if (i < 0) i = ends.length;
    ends[i] = b.end; clusterEnd = Math.max(clusterEnd, b.end);
    cluster.push({ b, col: i, n: 1 });
  });
  flush();
  return out;
}

export function saveBlock(day, data, id) {
  const list = state.plan[day] || (state.plan[day] = []);
  if (id) { const b = list.find(x => x.id === id); if (b) Object.assign(b, data); }
  else list.push({ id: uid(), done: false, ...data });
  persist('plan');
}
export function removeBlock(day, id) { state.plan[day] = (state.plan[day] || []).filter(x => x.id !== id); persist('plan'); }

// ticking a block also completes its linked task (which may spawn the next recurring one)
export function toggleBlock(b) {
  b.done = !isBlockDone(b);
  const t = linkedTodo(b);
  const next = t ? setDone(t, b.done) : null;
  persist('plan');
  return { todo: t, next };
}
