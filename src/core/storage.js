// Key/value storage with the same API everywhere (getItem / setItem / removeItem):
//   - desktop app : SQLite, through the preload bridge (window.desktop.db)
//   - browser     : localStorage
//   - tests / blocked storage : in-memory
const memory = new Map();
const memoryStore = {
  getItem: k => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => { memory.set(k, String(v)); },
  removeItem: k => { memory.delete(k); }
};

// keys written by earlier versions of the desktop app (browser storage), moved into SQLite once
const LEGACY_KEYS = ['todos.v1', 'todos.plan.v1', 'todos.bookmarks.v1', 'todos.notes.v1', 'todos.vault.v1', 'todos.vault.settings', 'todos.theme'];

function desktopStore(bridge) {
  const cache = bridge.loadAll();   // { storageKey: jsonString } for everything already saved
  if (!cache.__migrated) {
    try {
      const ls = window.localStorage; let ok = true;
      LEGACY_KEYS.forEach(k => {
        const v = ls.getItem(k);
        if (v != null && cache[k] == null) { if (bridge.save(k, v)) cache[k] = v; else ok = false; }
      });
      if (ok) { bridge.save('__migrated', '1'); cache.__migrated = '1'; LEGACY_KEYS.forEach(k => ls.removeItem(k)); }
    } catch (e) { /* try again next launch */ }
  }
  return {
    getItem: k => (cache[k] == null ? null : cache[k]),
    setItem: (k, v) => { v = String(v); if (!bridge.save(k, v)) throw new Error('Database write failed'); cache[k] = v; },
    removeItem: k => { bridge.remove(k); delete cache[k]; }
  };
}

function create() {
  if (typeof window === 'undefined') return memoryStore;
  if (window.desktop && window.desktop.db) return desktopStore(window.desktop.db);
  try { return window.localStorage || memoryStore; } catch (e) { return memoryStore; }
}

export const kv = create();
