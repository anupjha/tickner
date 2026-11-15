import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../electron/db/index.js';
import { migrateLegacyData } from '../electron/legacy.js';

const sandbox = () => { const root = mkdtempSync(join(tmpdir(), 'tickner-legacy-')); return { root, appData: join(root, 'appData'), userData: join(root, 'appData', 'Tickner'), oldDir: join(root, 'appData', 'Tasks') }; };
const seedOldDb = (dir, name = 'tasks.db') => {
  mkdirSync(dir, { recursive: true });
  const s = openStore(join(dir, name));
  s.save('todos.v1', JSON.stringify([{ id: 'a', text: 'from the old app', done: false }]));
  s.save('todos.theme', 'dark');
  s.close();
};

test('data from the old "Tasks" folder is copied into the new app folder', () => {
  const d = sandbox();
  try {
    seedOldDb(d.oldDir);
    const r = migrateLegacyData({ userData: d.userData, appData: d.appData });
    assert.equal(r.migrated, true);
    const s = openStore(join(d.userData, 'tickner.db'));
    assert.equal(JSON.parse(s.loadAll()['todos.v1'])[0].text, 'from the old app');
    assert.equal(s.loadAll()['todos.theme'], 'dark');
    s.close();
    assert.ok(existsSync(join(d.oldDir, 'tasks.db')), 'the old files are kept as a backup');
  } finally { rmSync(d.root, { recursive: true, force: true }); }
});

test('an old tasks.db inside the same folder is picked up too', () => {
  const d = sandbox();
  try {
    seedOldDb(d.userData);
    assert.equal(migrateLegacyData({ userData: d.userData, appData: d.appData }).migrated, true);
    assert.ok(existsSync(join(d.userData, 'tickner.db')));
  } finally { rmSync(d.root, { recursive: true, force: true }); }
});

test('browser storage of the oldest versions is carried over as well', () => {
  const d = sandbox();
  try {
    mkdirSync(join(d.oldDir, 'Local Storage', 'leveldb'), { recursive: true });
    writeFileSync(join(d.oldDir, 'Local Storage', 'leveldb', '000003.log'), 'legacy');
    const r = migrateLegacyData({ userData: d.userData, appData: d.appData });
    assert.equal(r.localStorage, true); assert.equal(r.migrated, false);
    assert.equal(readFileSync(join(d.userData, 'Local Storage', 'leveldb', '000003.log'), 'utf8'), 'legacy');
  } finally { rmSync(d.root, { recursive: true, force: true }); }
});

test('never overwrites an existing Tickner database, and does nothing on a fresh install', () => {
  const d = sandbox();
  try {
    assert.deepEqual(migrateLegacyData({ userData: d.userData, appData: d.appData }), { migrated: false, from: null, localStorage: false });
    seedOldDb(d.oldDir);
    const mine = openStore(join(d.userData, 'tickner.db')); mine.save('todos.v1', JSON.stringify([{ id: 'n', text: 'new data' }])); mine.close();
    assert.equal(migrateLegacyData({ userData: d.userData, appData: d.appData }).migrated, false);
    const s = openStore(join(d.userData, 'tickner.db'));
    assert.equal(JSON.parse(s.loadAll()['todos.v1'])[0].text, 'new data');
    s.close();
  } finally { rmSync(d.root, { recursive: true, force: true }); }
});
