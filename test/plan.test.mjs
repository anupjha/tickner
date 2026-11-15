import test from 'node:test';
import assert from 'node:assert/strict';
import { resetState } from './helpers.mjs';
import { state } from '../src/core/store.js';
import { addTodo } from '../src/services/todos.js';
import { layout, hourRange, saveBlock, removeBlock, blocksOf, toggleBlock, summarize, unscheduled } from '../src/services/plan.js';

const B = (id, start, end) => ({ id, title: id, start, end, todoId: '', done: false });

test('overlapping blocks are laid out in side-by-side columns', () => {
  const out = layout([B('a', 540, 600), B('b', 560, 620), B('c', 700, 760)]);
  const by = Object.fromEntries(out.map(x => [x.b.id, x]));
  assert.equal(by.a.n, 2); assert.equal(by.b.n, 2); assert.notEqual(by.a.col, by.b.col);
  assert.equal(by.c.n, 1); assert.equal(by.c.col, 0);
});

test('visible hour range stretches to fit early and late blocks', () => {
  assert.deepEqual(hourRange([]), { startH: 6, endH: 22 });
  assert.deepEqual(hourRange([B('x', 300, 360), B('y', 1300, 1380)]), { startH: 5, endH: 23 });
});

test('blocks can be saved, edited, removed and summarized', () => {
  resetState();
  saveBlock('2026-11-13', { title: 'Deep work', start: 540, end: 630, todoId: '' });
  const [b] = blocksOf('2026-11-13');
  saveBlock('2026-11-13', { title: 'Deep work v2', start: 540, end: 660, todoId: '' }, b.id);
  assert.equal(blocksOf('2026-11-13')[0].title, 'Deep work v2');
  assert.deepEqual(summarize('2026-11-13'), { count: 1, minutes: 120, done: 0 });
  removeBlock('2026-11-13', b.id);
  assert.equal(blocksOf('2026-11-13').length, 0);
});

test('ticking a block completes its linked task and spawns the next recurring one', () => {
  resetState();
  const t = addTodo({ text: 'Stretch', repeat: 'daily' });
  saveBlock('2026-11-13', { title: 'Stretch', start: 480, end: 500, todoId: t.id });
  assert.deepEqual(unscheduled('2026-11-13').map(x => x.id), []);
  const { next } = toggleBlock(blocksOf('2026-11-13')[0]);
  assert.equal(state.todos[0].done, true);
  assert.ok(next);
  assert.equal(state.todos.length, 2);
});
