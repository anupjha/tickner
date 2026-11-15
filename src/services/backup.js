// Export / import of all app data as one JSON file.
//
// Each kind of data is a "section" below. Adding a new collection to backups = adding one entry:
//   key      name in the file          name   name in the store      clean()   validate + rebuild untrusted input
//   count()  how many items            merge()/replace()  apply it, return how many were added
// Files are untrusted input: clean() rebuilds every field instead of trusting what the file says.
import { state, persist } from '../core/store.js';
import { getTheme, setTheme } from '../core/prefs.js';
import { emit } from '../core/bus.js';
import { isDate } from '../core/dates.js';
import { uid, str, dedupe, plural, parseTags, normUrl, hostOf } from '../core/util.js';
import { isRepeat } from './todos.js';
import { lock as lockVault } from './vault/session.js';

export const APP_ID = 'tickner';
const LEGACY_APP_IDS = ['tasks-app'];   // backups made before the app was renamed still import

const idOf = v => (typeof v === 'string' && v && v.length <= 80 ? v : uid());
const tagList = v => (Array.isArray(v) ? parseTags(v.filter(x => typeof x === 'string').join(',')) : []);
const finite = (v, fallback) => (Number.isFinite(v) ? v : fallback);

const SECTIONS = [
  {
    key: 'todos', name: 'todos', always: true, label: n => plural(n, 'task'),
    export: () => state.todos,
    clean(raw) {
      const out = [];
      (Array.isArray(raw) ? raw : []).forEach(t => {
        const text = t && str(t.text, 500).trim(); if (!text) return;
        out.push({ id: idOf(t.id), text, due: isDate(t.due) ? t.due : '', tags: tagList(t.tags), done: t.done === true, repeat: isRepeat(t.repeat) ? t.repeat : '', spawned: t.spawned === true });
      });
      return dedupe(out, 'id');
    },
    count: v => v.length,
    merge(v) { const ids = new Set(state.todos.map(t => t.id)); let n = 0; v.forEach(t => { if (!ids.has(t.id)) { state.todos.push(t); ids.add(t.id); n++; } }); return n; },
    replace(v) { state.todos = v; return v.length; }
  },
  {
    key: 'plan', name: 'plan', always: true, label: n => plural(n, 'plan block'),
    export: () => state.plan,
    clean(raw) {
      const out = {};
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
      Object.keys(raw).forEach(day => {
        if (!isDate(day) || !Array.isArray(raw[day])) return;
        const blocks = [];
        raw[day].forEach(b => {
          const s = b && b.start, e = b && b.end, title = b && str(b.title, 200).trim();
          if (!title || !Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e > 1440 || e <= s) return;
          blocks.push({ id: idOf(b.id), title, start: s, end: e, todoId: str(b.todoId, 80), done: b.done === true });
        });
        if (blocks.length) out[day] = dedupe(blocks, 'id');
      });
      return out;
    },
    count: v => Object.values(v).reduce((a, b) => a + b.length, 0),
    merge(v) {
      let n = 0;
      Object.keys(v).forEach(day => {
        const cur = state.plan[day] || (state.plan[day] = []), ids = new Set(cur.map(b => b.id));
        v[day].forEach(b => { if (!ids.has(b.id)) { cur.push(b); ids.add(b.id); n++; } });
      });
      return n;
    },
    replace(v) { state.plan = v; return this.count(v); }
  },
  {
    key: 'bookmarks', name: 'marks', always: true, label: n => plural(n, 'bookmark'),
    export: () => state.marks,
    clean(raw) {
      const out = [];
      (Array.isArray(raw) ? raw : []).forEach(m => {
        const url = m && typeof m.url === 'string' ? normUrl(m.url) : null; if (!url) return;
        out.push({ id: idOf(m.id), url, title: str(m.title, 300).trim() || hostOf(url), tags: tagList(m.tags), fav: m.fav === true, added: finite(m.added, Date.now()) });
      });
      return dedupe(out, 'url');
    },
    count: v => v.length,
    merge(v) {
      const urls = new Set(state.marks.map(m => m.url)); let n = 0;
      v.forEach(m => { if (!urls.has(m.url)) { state.marks.push(m); urls.add(m.url); n++; } });
      state.marks.sort((a, b) => (b.added || 0) - (a.added || 0));
      return n;
    },
    replace(v) { state.marks = v; return v.length; }
  },
  {
    key: 'notes', name: 'notes', always: true, label: n => plural(n, 'note'),
    export: () => state.notes,
    clean(raw) {
      const out = [];
      (Array.isArray(raw) ? raw : []).forEach(n => {
        const text = n && str(n.text, 100000); if (!text || !text.trim()) return;
        out.push({ id: idOf(n.id), text, pinned: n.pinned === true, created: finite(n.created, Date.now()), updated: finite(n.updated, Date.now()) });
      });
      return dedupe(out, 'id');
    },
    count: v => v.length,
    merge(v) { const ids = new Set(state.notes.map(n => n.id)); let n = 0; v.forEach(x => { if (!ids.has(x.id)) { state.notes.push(x); ids.add(x.id); n++; } }); return n; },
    replace(v) { state.notes = v; return v.length; }
  },
  {
    // arrives still encrypted; only the envelope's shape is checked. Never replaced by a file that has no vault.
    key: 'vault', name: 'vault', always: false, label: () => 'encrypted vault',
    export: () => state.vault,
    clean(raw) {
      const v = raw;
      const base64 = /^[A-Za-z0-9+/]*={0,2}$/;
      if (v && typeof v === 'object' && v.v === 1 && v.kdf === 'PBKDF2-SHA256' && Number.isInteger(v.iter) && v.iter >= 100000 && v.iter <= 10000000 &&
          [v.salt, v.iv, v.data].every(x => typeof x === 'string' && x.length <= 7000000 && base64.test(x))) {
        return { v: 1, kdf: 'PBKDF2-SHA256', iter: v.iter, salt: v.salt, iv: v.iv, data: v.data };
      }
      return null;
    },
    count: v => (v ? 1 : 0),
    merge(v) { if (v && !state.vault) { state.vault = v; return 1; } return 0; },
    replace(v) { if (v) { state.vault = v; return 1; } return 0; }
  }
];

export function buildExport() {
  const data = {};
  SECTIONS.forEach(s => { data[s.key] = s.export(); });
  data.theme = getTheme();
  return { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), data };
}

// -> { todos, plan, bookmarks, notes, vault, theme }   (throws if this isn't one of our backup files)
export function cleanImport(raw) {
  if (!raw || ![APP_ID, ...LEGACY_APP_IDS].includes(raw.app) || !raw.data || typeof raw.data !== 'object') throw new Error('This isn’t a backup file from this app.');
  const out = {};
  SECTIONS.forEach(s => { out[s.key] = s.clean(raw.data[s.key]); });
  out.theme = raw.data.theme === 'dark' || raw.data.theme === 'light' ? raw.data.theme : null;
  return out;
}

export const countsOf = cleaned => Object.fromEntries(SECTIONS.map(s => [s.key, s.count(cleaned[s.key])]));
export const total = counts => Object.values(counts).reduce((a, b) => a + b, 0);
// "12 tasks, 3 plan blocks, 20 bookmarks, 4 notes, encrypted vault"
export const describe = counts => SECTIONS.filter(s => s.always || counts[s.key] > 0).map(s => s.label(counts[s.key])).join(', ');

// mode 'merge' adds what is missing; 'replace' swaps everything in (the vault only if the file has one)
export function applyImport(cleaned, mode) {
  const added = {};
  SECTIONS.forEach(s => { added[s.key] = mode === 'replace' ? s.replace(cleaned[s.key]) : s.merge(cleaned[s.key]); });
  if (mode === 'replace' && cleaned.theme) { setTheme(cleaned.theme); emit('theme:set', cleaned.theme); }
  SECTIONS.forEach(s => persist(s.name));
  if (added.vault) lockVault();
  emit('data:replaced');
  return added;
}
