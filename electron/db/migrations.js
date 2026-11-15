'use strict';
// Schema versions. PRAGMA user_version records how far this database has got.
// To change the schema: append a new { version, up } entry. Never edit an old one.
const MIGRATIONS = [
  {
    version: 1,
    up: `
      CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE todos (
        id TEXT PRIMARY KEY, position INTEGER NOT NULL, text TEXT NOT NULL,
        due TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0,
        recur TEXT NOT NULL DEFAULT '', spawned INTEGER NOT NULL DEFAULT 0, tags TEXT NOT NULL DEFAULT '[]');
      CREATE INDEX idx_todos_due ON todos(due);
      CREATE TABLE plan_blocks (
        id TEXT PRIMARY KEY, day TEXT NOT NULL, start_min INTEGER NOT NULL, end_min INTEGER NOT NULL,
        title TEXT NOT NULL, todo_id TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX idx_plan_day ON plan_blocks(day, start_min);
      CREATE TABLE bookmarks (
        id TEXT PRIMARY KEY, position INTEGER NOT NULL, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]', fav INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE notes (
        id TEXT PRIMARY KEY, text TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0,
        created INTEGER NOT NULL, updated INTEGER NOT NULL);
      CREATE INDEX idx_notes_updated ON notes(updated);
      CREATE TABLE vault (id INTEGER PRIMARY KEY CHECK (id = 1), env TEXT NOT NULL);`
  }
];

function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (const m of MIGRATIONS.filter(x => x.version > current)) {
    db.exec('BEGIN');
    try { db.exec(m.up); db.exec(`PRAGMA user_version = ${m.version}`); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
}

module.exports = { migrate, LATEST: MIGRATIONS[MIGRATIONS.length - 1].version };
