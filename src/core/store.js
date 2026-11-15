// The app's data lives in one object, `state`. Features read and mutate it, then call persist(name).
// Add a new collection by adding one entry to SPECS (and, for the desktop app, one repo in electron/db/repos).
import { kv } from './storage.js';
import { defaultNotify, cleanNotify } from './notify-schema.js';

const SPECS = {
  todos: { key: 'todos.v1',           empty: () => [],   valid: Array.isArray },
  plan:  { key: 'todos.plan.v1',      empty: () => ({}),  valid: v => v && typeof v === 'object' && !Array.isArray(v) },
  marks: { key: 'todos.bookmarks.v1', empty: () => [],   valid: Array.isArray },
  notes: { key: 'todos.notes.v1',     empty: () => [],   valid: Array.isArray,
           clean: list => list.filter(n => n && typeof n.id === 'string' && typeof n.text === 'string' && n.text.trim()) },
  notify: { key: 'todos.notify.v1',   empty: defaultNotify, valid: v => !!v && typeof v === 'object' && !Array.isArray(v), clean: cleanNotify },   // device-specific, not part of backups
  vault: { key: 'todos.vault.v1',     empty: () => null,  valid: v => v && v.v === 1 && typeof v.data === 'string' }   // encrypted envelope only
};

export const state = {};

function read(name) {
  const spec = SPECS[name];
  try {
    const value = JSON.parse(kv.getItem(spec.key));
    if (!spec.valid(value)) return spec.empty();
    return spec.clean ? spec.clean(value) : value;
  } catch (e) { return spec.empty(); }
}

export function load() { Object.keys(SPECS).forEach(name => { state[name] = read(name); }); }

// returns true on success. With { strict: true } a failure throws instead (used by the vault, which must not fail silently)
export function persist(name, { strict = false } = {}) {
  if (state[name] == null) return true;
  try { kv.setItem(SPECS[name].key, JSON.stringify(state[name])); return true; }
  catch (e) { if (strict) throw e; return false; }
}

export function clear(name) { try { kv.removeItem(SPECS[name].key); } catch (e) { /* ignore */ } state[name] = SPECS[name].empty(); }

export function persistAll() { Object.keys(SPECS).forEach(name => persist(name)); }

load();
