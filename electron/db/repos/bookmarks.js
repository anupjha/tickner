'use strict';
const { s, flag, int, tagsJson, parse, hasId } = require('../sanitize');

module.exports = {
  key: 'todos.bookmarks.v1',
  save(db, arr, h) {
    const rows = (Array.isArray(arr) ? arr : []).filter(m => hasId(m) && typeof m.url === 'string' && m.url);
    h.prune('bookmarks', rows.map(m => m.id));   // pruned first so a URL can move to a new id in the same save
    const up = db.prepare(`INSERT INTO bookmarks (id, position, url, title, tags, fav, added) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET position=excluded.position, url=excluded.url, title=excluded.title,
      tags=excluded.tags, fav=excluded.fav, added=excluded.added`);
    rows.forEach((m, i) => up.run(s(m.id, 80), i, s(m.url, 2048), s(m.title, 300), tagsJson(m.tags), flag(m.fav), int(m.added)));
  },
  load(db) {
    const marks = db.prepare('SELECT * FROM bookmarks ORDER BY position').all().map(r => ({
      id: r.id, url: r.url, title: r.title, tags: parse(r.tags, []), fav: !!r.fav, added: r.added }));
    return marks.length ? JSON.stringify(marks) : undefined;
  }
};
