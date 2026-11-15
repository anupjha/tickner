'use strict';
// notification state (seen version, unread items, preferences): small, device-specific, kept in the meta table
module.exports = {
  key: 'todos.notify.v1',
  save(db, o, h) {
    if (!o || typeof o !== 'object' || Array.isArray(o) || !Array.isArray(o.items) || o.items.length > 50) throw new Error('bad notify state');
    const json = JSON.stringify(o);
    if (json.length > 100000) throw new Error('notify state too large');
    h.setMeta('notify.v1', json);
  },
  load(db, h) { return h.getMeta('notify.v1') || undefined; }
};
