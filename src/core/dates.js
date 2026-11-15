// Date and time helpers. Dates are 'YYYY-MM-DD' strings in local time; times of day are minutes since midnight.
const pad = n => String(n).padStart(2, '0');

export const dayStr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => dayStr(new Date());
export const isDate = s => typeof s === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s);

export function parseDay(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(s, n) { const d = parseDay(s); d.setDate(d.getDate() + n); return dayStr(d); }
export const fmt = s => parseDay(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const toTime = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
export const fmtTime = m => new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
export const durFmt = m => ((Math.floor(m / 60) ? Math.floor(m / 60) + 'h ' : '') + (m % 60 ? (m % 60) + 'm' : '')).trim() || '0m';

export function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
