// Small pure helpers shared across services and features (no DOM).
export const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
export const short = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
export const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
export const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
export const dedupe = (arr, key) => { const seen = new Set(); return arr.filter(x => !seen.has(x[key]) && seen.add(x[key])); };

export const tagsOf = item => (Array.isArray(item.tags) ? item.tags : []);
export function parseTags(input) {
  const out = [];
  String(input).split(',').forEach(x => {
    x = x.trim().replace(/^#+/, '').toLowerCase().slice(0, 24);
    if (x && !out.includes(x)) out.push(x);
  });
  return out.slice(0, 8);
}

// Only http(s) links are accepted, so javascript:, data: and similar schemes are rejected.
export function normUrl(input) {
  let s = String(input).trim();
  if (!s) return null;
  if (!/^https?:[/][/]/i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.username || u.password) return null;   // 'mailto:a@b.co' would otherwise become https://mailto:a@b.co
    return /^https?:$/.test(u.protocol) && (u.hostname.includes('.') || u.hostname === 'localhost') ? u.href : null;
  } catch (e) { return null; }
}
export function hostOf(url) {
  try { const h = new URL(url).hostname; return h.startsWith('www.') ? h.slice(4) : h; } catch (e) { return url; }
}
export function shortUrl(url) {
  try { const x = new URL(url); return hostOf(url) + (x.pathname === '/' ? '' : x.pathname) + x.search; } catch (e) { return url; }
}
