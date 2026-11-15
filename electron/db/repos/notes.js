'use strict';
const { s, flag, int, hasId } = require('../sanitize');

module.exports = {
  key: 'todos.notes.v1',
  save(db, arr, h) {
    const rows = (Array.isArray(arr) ? arr : []).filter(n => hasId(n) && typeof n.text === 'string');
    h.prune('notes', rows.map(n => n.id));
    const up = db.prepare(`INSERT INTO notes (id, text, pinned, created, updated) VALUES (?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET text=excluded.text, pinned=excluded.pinned, created=excluded.created, updated=excluded.updated`);
    rows.forEach(n => up.run(s(n.id, 80), s(n.text, 100000), flag(n.pinned), int(n.created), int(n.updated)));
  },
  load(db) {
    const notes = db.prepare('SELECT * FROM notes ORDER BY updated DESC').all().map(r => ({
      id: r.id, text: r.text, pinned: !!r.pinned, created: r.created, updated: r.updated }));
    return notes.length ? JSON.stringify(notes) : undefined;
  }
};
