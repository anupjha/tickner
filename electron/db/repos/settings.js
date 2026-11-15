'use strict';
// small values kept in the meta table: theme, vault auto-lock, and the one-time migration flag
module.exports = [
  {
    key: 'todos.vault.settings',
    save(db, o, h) { h.setMeta('vault.settings', JSON.stringify({ autoLockMin: [1, 5, 15, 30].includes(o && o.autoLockMin) ? o.autoLockMin : 5 })); },
    load(db, h) { return h.getMeta('vault.settings') || undefined; }
  },
  {
    key: 'todos.theme', raw: true,
    save(db, theme, h) { if (theme !== 'dark' && theme !== 'light') throw new Error('bad theme'); h.setMeta('theme', theme); },
    load(db, h) { return h.getMeta('theme') || undefined; }
  },
  {
    key: '__migrated', raw: true,
    save(db, _v, h) { h.setMeta('migrated_from_localstorage', '1'); },
    load(db, h) { return h.getMeta('migrated_from_localstorage') ? '1' : undefined; }
  }
];
