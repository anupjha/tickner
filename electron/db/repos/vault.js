'use strict';
const { s, int } = require('../sanitize');

// stored exactly as the app encrypted it: this table never sees plain text
module.exports = {
  key: 'todos.vault.v1',
  save(db, env) {
    if (!env || typeof env !== 'object' || env.v !== 1 || typeof env.data !== 'string' || typeof env.iv !== 'string' || typeof env.salt !== 'string') throw new Error('bad vault');
    if (env.data.length > 8e6) throw new Error('vault too large');
    const clean = { v: 1, kdf: s(env.kdf, 40), iter: int(env.iter), salt: s(env.salt, 100), iv: s(env.iv, 100), data: env.data };
    db.prepare('INSERT INTO vault (id, env) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET env = excluded.env').run(JSON.stringify(clean));
  },
  load(db) { const r = db.prepare('SELECT env FROM vault WHERE id = 1').get(); return r ? r.env : undefined; },
  remove(db) { db.prepare('DELETE FROM vault').run(); }
};
