'use strict';
const { DATE, REPEATS, s, flag, tagsJson, parse, hasId } = require('../sanitize');

module.exports = {
  key: 'todos.v1',
  save(db, arr, h) {
    const rows = (Array.isArray(arr) ? arr : []).filter(hasId);
    h.prune('todos', rows.map(t => t.id));
    const up = db.prepare(`INSERT INTO todos (id, position, text, due, done, recur, spawned, tags) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET position=excluded.position, text=excluded.text, due=excluded.due, done=excluded.done,
      recur=excluded.recur, spawned=excluded.spawned, tags=excluded.tags`);
    rows.forEach((t, i) => up.run(s(t.id, 80), i, s(t.text, 500), DATE.test(t.due) ? t.due : '', flag(t.done),
      REPEATS.includes(t.repeat) ? t.repeat : '', flag(t.spawned), tagsJson(t.tags)));
  },
  load(db) {
    const todos = db.prepare('SELECT * FROM todos ORDER BY position').all().map(r => ({
      id: r.id, text: r.text, due: r.due, tags: parse(r.tags, []), done: !!r.done, repeat: r.recur, spawned: !!r.spawned }));
    return todos.length ? JSON.stringify(todos) : undefined;
  }
};
