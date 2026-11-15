// Pure cryptography for the vault (Web Crypto only; runs in browsers, Electron and Node).
//   master password --PBKDF2-SHA256 (600k rounds)--> AES-256-GCM key (non-extractable)
// Only { v, kdf, iter, salt, iv, data } is ever stored. Every save uses a fresh random IV.
export const KDF_ITER = 600000;
// Authenticated-data label baked into every vault. It predates the app's current name and must NEVER change:
// changing it would make every existing vault undecryptable.
const AAD = new TextEncoder().encode('tasks-app-vault-v1');

export const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(s); };
export const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const randomSalt = () => crypto.getRandomValues(new Uint8Array(16));
export const cryptoAvailable = () => !!(globalThis.crypto && crypto.subtle);

export async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(key, items) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, new TextEncoder().encode(JSON.stringify({ items })));
  return { iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
}

// -> { key, items } or null when the password is wrong or the data was tampered with
export async function open(envelope, password) {
  try {
    const key = await deriveKey(password, fromB64(envelope.salt), envelope.iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv), additionalData: AAD }, key, fromB64(envelope.data));
    const obj = JSON.parse(new TextDecoder().decode(pt));
    return { key, items: Array.isArray(obj.items) ? obj.items : [] };
  } catch (e) { return null; }
}

// ---- password helpers ----
export function genPassword(length, sets) {
  const pools = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.?' };
  const chosen = Object.keys(sets).filter(k => sets[k]);
  if (!chosen.length) return '';
  const all = chosen.map(k => pools[k]).join('');
  // unbiased random index (rejection sampling)
  const rnd = n => { const lim = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1); do crypto.getRandomValues(a); while (a[0] >= lim); return a[0] % n; };
  const out = chosen.map(k => pools[k][rnd(pools[k].length)]);   // at least one of each chosen kind
  while (out.length < length) out.push(all[rnd(all.length)]);
  for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}

export function passwordBits(p) {
  let pool = 0;
  if (/[a-z]/.test(p)) pool += 26;
  if (/[A-Z]/.test(p)) pool += 26;
  if (/[0-9]/.test(p)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(p)) pool += 32;
  return pool ? p.length * Math.log2(pool) : 0;
}
