import test from 'node:test';
import assert from 'node:assert/strict';
import { resetState } from './helpers.mjs';
import { state } from '../src/core/store.js';
import { addTodo } from '../src/services/todos.js';
import { saveBlock } from '../src/services/plan.js';
import { addMark } from '../src/services/bookmarks.js';
import { createNote, editNote } from '../src/services/notes.js';
import { buildExport, cleanImport, applyImport, countsOf, total, describe } from '../src/services/backup.js';

function seed() {
  resetState();
  addTodo({ text: 'Water plants', due: '2026-11-20', tags: ['home'], repeat: 'weekly' });
  saveBlock('2026-11-13', { title: 'Deep work', start: 540, end: 630, todoId: '' });
  addMark({ url: 'example.com', title: 'Example', tags: 'dev' });
  const n = createNote(); editNote(n, 'Groceries\nmilk');
}
const roundTrip = () => JSON.parse(JSON.stringify(buildExport()));

test('exports use the new app id, and backups made before the rename still import', () => {
  seed();
  const file = roundTrip();
  assert.equal(file.app, 'tickner');
  assert.equal(total(countsOf(cleanImport({ ...file, app: 'tasks-app' }))), 4);
});

test('rejects files that are not from this app', () => {
  assert.throws(() => cleanImport({ hello: 'world' }), /isn’t a backup/);
  assert.throws(() => cleanImport(null));
});

test('export -> import keeps everything (counts and descriptions)', () => {
  seed();
  const counts = countsOf(cleanImport(roundTrip()));
  assert.deepEqual(counts, { todos: 1, plan: 1, bookmarks: 1, notes: 1, vault: 0 });
  assert.equal(describe(counts), '1 task, 1 plan block, 1 bookmark, 1 note');
});

test('untrusted fields are rebuilt: bad URLs, impossible times, oversized or wrong-typed values are dropped', () => {
  const file = { app: 'tickner', data: {
    todos: [{ id: 't', text: 'ok', due: 'tomorrow', tags: ['A', 5], repeat: 'hourly', done: 'yes' }, { text: '   ' }, null],
    plan: { '2026-11-13': [{ id: 'b', title: 'x', start: 600, end: 500 }, { id: 'c', title: 'good', start: 60, end: 120 }], 'not-a-date': [{ title: 'y', start: 0, end: 10 }] },
    bookmarks: [{ url: 'javascript:alert(1)', title: 'evil' }, { url: 'good.example.com', title: 'g' }],
    notes: [{ text: '' }, { text: 'keep' }],
    vault: { v: 1, kdf: 'PBKDF2-SHA256', iter: 5, salt: 'AAAA', iv: 'AAAA', data: 'AAAA' }
  } };
  const c = cleanImport(file);
  assert.equal(c.todos.length, 1);
  assert.deepEqual([c.todos[0].due, c.todos[0].repeat, c.todos[0].done, c.todos[0].tags], ['', '', false, ['a']]);
  assert.deepEqual(Object.keys(c.plan), ['2026-11-13']); assert.equal(c.plan['2026-11-13'].length, 1);
  assert.deepEqual(c.bookmarks.map(b => b.url), ['https://good.example.com/']);
  assert.equal(c.notes.length, 1);
  assert.equal(c.vault, null);   // iteration count too low to be one of ours
});

test('merge adds only what is missing; replace swaps everything', () => {
  seed();
  const file = roundTrip();
  assert.equal(total(applyImport(cleanImport(file), 'merge')), 0);   // importing the same file again adds nothing
  addTodo({ text: 'Extra' });
  applyImport(cleanImport(file), 'replace');
  assert.deepEqual(state.todos.map(t => t.text), ['Water plants']);
});

test('the vault is only replaced when the file has one, and merge never overwrites an existing vault', () => {
  seed();
  const env = { v: 1, kdf: 'PBKDF2-SHA256', iter: 600000, salt: 'AAAA', iv: 'AAAA', data: 'AAAA' };
  state.vault = env;
  const noVault = roundTrip(); noVault.data.vault = null;
  applyImport(cleanImport(noVault), 'replace');
  assert.equal(state.vault, env, 'a file without a vault must not delete yours');
  const other = { ...env, salt: 'BBBB' };
  const withOther = roundTrip(); withOther.data.vault = other;
  applyImport(cleanImport(withOther), 'merge');
  assert.equal(state.vault.salt, 'AAAA', 'merge keeps the existing vault');
  applyImport(cleanImport(withOther), 'replace');
  assert.equal(state.vault.salt, 'BBBB', 'replace adopts the vault from the file');
});
