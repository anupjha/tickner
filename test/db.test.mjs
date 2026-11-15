import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openStore } from '../electron/db/index.js';
import { LATEST } from '../electron/db/migrations.js';

const withStore = fn => async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tickner-db-')), store = openStore(join(dir, 'tickner.db'));
  try { await fn(store, join(dir, 'tickner.db')); } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
};
const J = JSON.stringify;

test('schema is created and versioned', withStore((store, file) => {
  store.close();
  const db = new DatabaseSync(file, { readOnly: true });
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, LATEST);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1").all().map(r => r.name);
  for (const t of ['bookmarks', 'meta', 'notes', 'plan_blocks', 'todos', 'vault']) assert.ok(tables.includes(t), t);
  db.close();
}));

test('every collection round-trips through the repos', withStore(store => {
  const todos = [{ id: 't1', text: 'A', due: '2026-11-20', tags: ['x'], done: true, repeat: 'weekly', spawned: true }, { id: 't2', text: 'B', due: '', tags: [], done: false, repeat: '', spawned: false }];
  const plan = { '2026-11-13': [{ id: 'b1', title: 'W', start: 540, end: 600, todoId: 't1', done: false }] };
  const marks = [{ id: 'm1', url: 'https://example.com/', title: 'E', tags: ['dev'], fav: true, added: 1700000000000 }];
  const notes = [{ id: 'n1', text: 'hello', pinned: true, created: 1, updated: 2 }];
  assert.ok(store.save('todos.v1', J(todos)) && store.save('todos.plan.v1', J(plan)) && store.save('todos.bookmarks.v1', J(marks)) && store.save('todos.notes.v1', J(notes)));
  assert.ok(store.save('todos.theme', 'dark') && store.save('todos.vault.settings', J({ autoLockMin: 15 })));
  const all = store.loadAll();
  assert.deepEqual(JSON.parse(all['todos.v1']), todos);
  assert.deepEqual(JSON.parse(all['todos.plan.v1']), plan);
  assert.deepEqual(JSON.parse(all['todos.bookmarks.v1']), marks);
  assert.deepEqual(JSON.parse(all['todos.notes.v1']), notes);
  assert.equal(all['todos.theme'], 'dark'); assert.equal(JSON.parse(all['todos.vault.settings']).autoLockMin, 15);
}));

test('rows that disappear from the app disappear from the database; order is kept', withStore(store => {
  store.save('todos.v1', J([{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }, { id: 'c', text: 'c' }]));
  store.save('todos.v1', J([{ id: 'c', text: 'c' }, { id: 'a', text: 'a' }]));
  assert.deepEqual(JSON.parse(store.loadAll()['todos.v1']).map(t => t.id), ['c', 'a']);
  store.save('todos.v1', '[]');
  assert.equal(store.loadAll()['todos.v1'], undefined);
}));

test('a bookmark URL can move to a new id within one save (prune before insert)', withStore(store => {
  store.save('todos.bookmarks.v1', J([{ id: 'old', url: 'https://example.com/', title: 'x' }]));
  assert.equal(store.save('todos.bookmarks.v1', J([{ id: 'new', url: 'https://example.com/', title: 'y' }])), true);
  assert.deepEqual(JSON.parse(store.loadAll()['todos.bookmarks.v1']).map(m => m.id), ['new']);
}));

test('bad input is rejected and leaves data untouched', withStore(store => {
  store.save('todos.v1', J([{ id: 'a', text: 'keep' }]));
  assert.equal(store.save('todos.v1', 'not json'), false);
  assert.equal(store.save('nope', '[]'), false);
  assert.equal(store.save('toString', '{}'), false);
  assert.equal(store.save('todos.theme', 'purple'), false);
  assert.equal(store.save('todos.vault.v1', J({ v: 2 })), false);
  assert.equal(JSON.parse(store.loadAll()['todos.v1'])[0].text, 'keep');
}));

test('values are coerced to safe types and sizes', withStore(store => {
  store.save('todos.v1', J([{ id: 'a', text: 'x'.repeat(2000), due: 'tomorrow', repeat: 'hourly', done: 'yes', tags: ['ok', 7, 'y'.repeat(99)] }]));
  const t = JSON.parse(store.loadAll()['todos.v1'])[0];
  assert.equal(t.text.length, 500); assert.equal(t.due, ''); assert.equal(t.repeat, ''); assert.equal(t.done, true);
  assert.deepEqual(t.tags, ['ok', 'y'.repeat(24)]);
}));

test('the vault is stored as the ciphertext envelope and can be removed', withStore((store, file) => {
  const env = { v: 1, kdf: 'PBKDF2-SHA256', iter: 600000, salt: 'c2FsdA==', iv: 'aXY=', data: 'Y2lwaGVydGV4dA==' };
  assert.ok(store.save('todos.vault.v1', J(env)));
  assert.deepEqual(JSON.parse(store.loadAll()['todos.vault.v1']), env);
  store.remove('todos.vault.v1');
  assert.equal(store.loadAll()['todos.vault.v1'], undefined);
}));

test('reopening a database keeps its data and does not re-run migrations', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tickner-db-')), file = join(dir, 'tickner.db');
  try {
    let s = openStore(file); s.save('todos.notes.v1', J([{ id: 'n', text: 'persist me', created: 1, updated: 1 }])); s.save('__migrated', '1'); s.close();
    s = openStore(file);
    assert.equal(JSON.parse(s.loadAll()['todos.notes.v1'])[0].text, 'persist me');
    assert.equal(s.loadAll().__migrated, '1');
    s.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
