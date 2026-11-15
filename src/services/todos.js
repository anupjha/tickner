// Task rules: filters, recurrence and all mutations. Each mutation persists, so the UI never has to.
import { state, persist } from '../core/store.js';
import { today, parseDay, dayStr, addDays, fmt } from '../core/dates.js';
import { uid, tagsOf } from '../core/util.js';

export const REPEATS = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly' };
export const isRepeat = v => typeof v === 'string' && Object.prototype.hasOwnProperty.call(REPEATS, v);
export const isOverdue = t => !t.done && !!t.due && t.due < today();

export const FILTERS = {
  all: () => true,
  active: t => !t.done,
  completed: t => t.done,
  overdue: isOverdue
};
export const visible = (t, filter, tag) => FILTERS[filter](t) && (!tag || tagsOf(t).includes(tag));
export const allTags = () => [...new Set(state.todos.flatMap(tagsOf))].sort();

// next occurrence after the current due date (or today); never lands in the past
export function nextDue(t, now = today()) {
  let d = t.due || now;
  do {
    if (t.repeat === 'monthly') {
      const p = parseDay(d), y = p.getFullYear(), m = p.getMonth() + 1, last = new Date(y, m + 1, 0).getDate();
      d = dayStr(new Date(y, m, Math.min(p.getDate(), last)));   // Jan 31 -> Feb 28
    } else if (t.repeat === 'weekly') d = addDays(d, 7);
    else {
      d = addDays(d, 1);
      if (t.repeat === 'weekdays') while ([0, 6].includes(parseDay(d).getDay())) d = addDays(d, 1);
    }
  } while (d < now);
  return d;
}
export const describeNext = (t, next) => 'Next ' + REPEATS[t.repeat].toLowerCase() + ' task added for ' + fmt(next.due);

// Completing a recurring task creates its next occurrence (once). Returns the new task or null.
export function setDone(t, done) {
  const was = t.done;
  t.done = done;
  let next = null;
  if (done && !was && isRepeat(t.repeat) && !t.spawned) {
    t.spawned = true;
    next = { id: uid(), text: t.text, due: nextDue(t), tags: tagsOf(t).slice(), done: false, repeat: t.repeat };
    state.todos.splice(state.todos.indexOf(t) + 1, 0, next);
  }
  persist('todos');
  return next;
}

export function addTodo({ text, due = '', tags = [], repeat = '' }) {
  const t = { id: uid(), text, due, tags, done: false, repeat: isRepeat(repeat) ? repeat : '' };
  state.todos.push(t); persist('todos');
  return t;
}
export function updateTodo(t, patch) { Object.assign(t, patch); persist('todos'); }
export function removeTodo(id) { state.todos = state.todos.filter(t => t.id !== id); persist('todos'); }
export function clearCompleted() { state.todos = state.todos.filter(t => !t.done); persist('todos'); }

// drag and drop: put `fromId` where `beforeId` is (works on the full list, so filters don't matter)
export function moveTodo(fromId, beforeId) {
  const from = state.todos.findIndex(x => x.id === fromId);
  if (from < 0) return;
  const [moved] = state.todos.splice(from, 1);
  const to = state.todos.findIndex(x => x.id === beforeId);
  state.todos.splice(to < 0 ? state.todos.length : to, 0, moved);
  persist('todos');
}
