'use strict';
// SQLite storage for the desktop app, using Node's built-in node:sqlite (no native modules to build).
//
// Each storage key is handled by a "repo" in ./repos:   { key, save(db, data, helpers), load(db, helpers), remove?(db), raw? }
// To store a new collection: add a migration (migrations.js), add a repo file, and list it below.
const { DatabaseSync } = require('node:sqlite');
const { migrate } = require('./migrations');

const REPOS = [
  require('./repos/todos'), require('./repos/plan'), require('./repos/bookmarks'), require('./repos/notes'),
  require('./repos/vault'), require('./repos/notify'), ...require('./repos/settings')
];
const MAX_PAYLOAD = 20 * 1024 * 1024;

function openStore(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
  migrate(db);

  const helpers = {
    // delete rows that are no longer in the app's list (done first so unique values can be reused)
    prune: (table, ids) => db.prepare(`DELETE FROM ${table} WHERE id NOT IN (SELECT value FROM json_each(?))`).run(JSON.stringify(ids)),
    getMeta: name => { const r = db.prepare('SELECT value FROM meta WHERE name = ?').get(name); return r ? r.value : null; },
    setMeta: (name, value) => db.prepare('INSERT INTO meta (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value').run(name, value)
  };
  const byKey = new Map(REPOS.map(r => [r.key, r]));

  const tx = fn => { db.exec('BEGIN IMMEDIATE'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };

  function save(key, value) {
    const repo = byKey.get(key);
    if (!repo || typeof value !== 'string' || value.length > MAX_PAYLOAD) return false;
    try {
      const data = repo.raw ? value : JSON.parse(value);
      tx(() => repo.save(db, data, helpers));
      return true;
    } catch (e) { console.error('[db] save failed for', key, '-', e.message); return false; }
  }

  function remove(key) {
    const repo = byKey.get(key);
    try { if (repo && repo.remove) repo.remove(db); return true; }
    catch (e) { console.error('[db] remove failed for', key, '-', e.message); return false; }
  }

  // { storageKey: jsonString } for everything that has data
  function loadAll() {
    const out = {};
    for (const repo of REPOS) { const v = repo.load(db, helpers); if (v !== undefined) out[repo.key] = v; }
    return out;
  }

  function close() {
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) { /* ignore */ }
    try { db.close(); } catch (e) { /* ignore */ }
  }

  return { file, loadAll, save, remove, close };
}

module.exports = { openStore };
