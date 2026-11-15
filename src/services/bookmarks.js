import { state, persist } from '../core/store.js';
import { uid, normUrl, hostOf, parseTags } from '../core/util.js';

// -> { error: 'invalid' | 'duplicate' } | { mark }
function check(fields, exceptId) {
  const url = normUrl(fields.url);
  if (!url) return { error: 'invalid' };
  if (state.marks.some(m => m.id !== exceptId && m.url === url)) return { error: 'duplicate' };
  return { url, title: (fields.title || '').trim() || hostOf(url), tags: parseTags(fields.tags || '') };
}

export function addMark(fields) {
  const c = check(fields);
  if (c.error) return c;
  const mark = { id: uid(), url: c.url, title: c.title, tags: c.tags, fav: false, added: Date.now() };
  state.marks.unshift(mark); persist('marks');
  return { mark };
}
export function updateMark(m, fields) {
  const c = check(fields, m.id);
  if (c.error) return c;
  Object.assign(m, { url: c.url, title: c.title, tags: c.tags }); persist('marks');
  return { mark: m };
}
export function toggleFav(m) { m.fav = !m.fav; persist('marks'); }
export function removeMark(id) { state.marks = state.marks.filter(m => m.id !== id); persist('marks'); }

export const markTags = () => [...new Set(state.marks.flatMap(m => m.tags || []))].sort();
export function filterMarks({ q = '', tag = null, fav = false }) {
  return state.marks.filter(m => (!fav || m.fav) && (!tag || (m.tags || []).includes(tag)) &&
    (!q || (m.title + ' ' + m.url + ' ' + (m.tags || []).join(' ')).toLowerCase().includes(q)));
}
