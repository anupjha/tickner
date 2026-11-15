// Shape of the notification state (what has been seen, what is unread, preferences). Pure, shared by the store and the service.
export const isVersion = v => typeof v === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(v);
export const DEFAULT_PREFS = { newFeatures: true, updateCheck: true, system: true };
export const defaultNotify = () => ({ seenVersion: null, items: [], dismissedUpdates: [], prefs: { ...DEFAULT_PREFS }, lastCheck: 0 });

const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const httpsUrl = v => (typeof v === 'string' && v.length <= 500 && /^https:[/][/]/i.test(v) ? v : '');

// rebuilds every field, so a damaged or tampered value can never break the app
export function cleanNotify(raw) {
  const out = defaultNotify();
  if (!raw || typeof raw !== 'object') return out;
  if (isVersion(raw.seenVersion)) out.seenVersion = raw.seenVersion;
  const p = raw.prefs || {};
  out.prefs = { newFeatures: bool(p.newFeatures, true), updateCheck: bool(p.updateCheck, true), system: bool(p.system, true) };
  out.lastCheck = Number.isFinite(raw.lastCheck) ? raw.lastCheck : 0;
  out.dismissedUpdates = (Array.isArray(raw.dismissedUpdates) ? raw.dismissedUpdates : []).filter(isVersion).slice(-20);
  out.items = (Array.isArray(raw.items) ? raw.items : [])
    .filter(i => i && (i.type === 'whatsnew' || i.type === 'update') && isVersion(i.version))
    .slice(-30)
    .map(i => ({
      id: i.type + ':' + i.version, type: i.type, version: i.version,
      createdAt: Number.isFinite(i.createdAt) ? i.createdAt : Date.now(), read: i.read === true,
      ...(i.type === 'update' ? { url: httpsUrl(i.url), notes: typeof i.notes === 'string' ? i.notes.slice(0, 2000) : '' } : {})
    }));
  return out;
}
