import test from 'node:test';
import assert from 'node:assert/strict';
import { resetState } from './helpers.mjs';
import { state } from '../src/core/store.js';
import { nextDue, setDone, addTodo, moveTodo, clearCompleted, FILTERS, visible, isOverdue } from '../src/services/todos.js';
import { today, addDays } from '../src/core/dates.js';

test('daily / weekly recurrence moves forward and never lands in the past', () => {
  assert.equal(nextDue({ repeat: 'daily', due: '2026-11-10' }, '2026-11-01'), '2026-11-11');
  assert.equal(nextDue({ repeat: 'weekly', due: '2026-11-10' }, '2026-11-01'), '2026-11-17');
  assert.equal(nextDue({ repeat: 'daily', due: '2026-11-01' }, '2026-11-10'), '2026-11-10');   // 9 days late -> today
  assert.equal(nextDue({ repeat: 'weekly', due: '2026-11-01' }, '2026-11-10'), '2026-11-15');
});

test('monthly recurrence clamps to the last day of shorter months', () => {
  assert.equal(nextDue({ repeat: 'monthly', due: '2027-01-31' }, '2027-01-01'), '2027-02-28');
  assert.equal(nextDue({ repeat: 'monthly', due: '2028-01-31' }, '2028-01-01'), '2028-02-29');
  assert.equal(nextDue({ repeat: 'monthly', due: '2026-12-15' }, '2026-12-01'), '2027-01-15');
});

test('weekday recurrence skips weekends', () => {
  assert.equal(nextDue({ repeat: 'weekdays', due: '2026-11-13' }, '2026-11-01'), '2026-11-16');   // Fri -> Mon
});

test('completing a recurring task spawns the next one exactly once', () => {
  resetState();
  const t = addTodo({ text: 'Water plants', due: addDays(today(), 1), tags: ['home'], repeat: 'weekly' });
  const next = setDone(t, true);
  assert.ok(next);
  assert.equal(state.todos.length, 2);
  assert.equal(state.todos[1].id, next.id);                 // inserted right after the original
  assert.deepEqual(next.tags, ['home']);
  assert.equal(next.done, false);
  setDone(t, false);
  assert.equal(setDone(t, true), null);                      // toggling again does not duplicate
  assert.equal(state.todos.length, 2);
});

test('non-recurring tasks never spawn', () => {
  resetState();
  const t = addTodo({ text: 'One-off' });
  assert.equal(setDone(t, true), null);
  assert.equal(state.todos.length, 1);
});

test('filters and overdue', () => {
  resetState();
  const a = addTodo({ text: 'late', due: '2000-01-01' }), b = addTodo({ text: 'done', tags: ['x'] });
  setDone(b, true);
  assert.ok(isOverdue(a)); assert.ok(!isOverdue(b));
  assert.deepEqual(state.todos.filter(FILTERS.active).map(t => t.text), ['late']);
  assert.deepEqual(state.todos.filter(t => visible(t, 'all', 'x')).map(t => t.text), ['done']);
});

test('moveTodo reorders on the full list and clearCompleted removes done items', () => {
  resetState();
  const [a, b, c] = ['a', 'b', 'c'].map(text => addTodo({ text }));
  moveTodo(c.id, a.id);
  assert.deepEqual(state.todos.map(t => t.text), ['c', 'a', 'b']);
  setDone(a, true); clearCompleted();
  assert.deepEqual(state.todos.map(t => t.text), ['c', 'b']);
});
