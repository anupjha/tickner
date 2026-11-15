// Vault session: holds the unlocked key and items in memory only. No DOM in here.
import { state, persist, clear } from '../../core/store.js';
import { emit } from '../../core/bus.js';
import { uid } from '../../core/util.js';
import { KDF_ITER, deriveKey, seal, open, randomSalt, toB64 } from './crypto.js';

let key = null, items = null, fails = 0;

export const exists = () => !!state.vault;
export const isUnlocked = () => !!key;
export const getItems = () => items;
export const failedAttempts = () => fails;

// encrypt + store; on failure the previous stored version is restored and the error is thrown
async function save() {
  const prev = state.vault;
  const { iv, data } = await seal(key, items);
  state.vault = { v: 1, kdf: 'PBKDF2-SHA256', iter: prev.iter, salt: prev.salt, iv, data };
  try { persist('vault', { strict: true }); } catch (e) { state.vault = prev; throw e; }
}
// apply a change to the items and save; roll back the in-memory change if saving fails
async function change(fn) {
  const snapshot = JSON.stringify(items);
  fn();
  try { await save(); } catch (e) { items = JSON.parse(snapshot); throw e; }
}

export async function create(password) {
  const salt = randomSalt();
  try {
    key = await deriveKey(password, salt, KDF_ITER); items = [];
    state.vault = { v: 1, kdf: 'PBKDF2-SHA256', iter: KDF_ITER, salt: toB64(salt), iv: '', data: '' };
    await save();
    fails = 0;
  } catch (e) { key = null; items = null; state.vault = null; throw e; }
}

export const unlockDelayMs = () => Math.min(fails, 5) * 1000;   // each wrong attempt waits a bit longer (max 5 s)
export async function unlock(password) {
  const r = await open(state.vault, password);
  if (!r) { fails++; return false; }
  key = r.key; items = r.items; fails = 0;
  return true;
}
export const verifyPassword = async password => !!(await open(state.vault, password));

export function lock() {
  const was = !!key;
  key = null; items = null;
  if (was) emit('vault:locked');
}

export const upsert = (id, data) => change(() => {
  const existing = id && items.find(x => x.id === id);
  if (existing) Object.assign(existing, data); else items.push({ id: uid(), created: Date.now(), ...data });
});
export const remove = id => change(() => { items = items.filter(x => x.id !== id); });

export async function changePassword(newPassword) {
  const prevKey = key, prevVault = state.vault, salt = randomSalt();
  try {
    key = await deriveKey(newPassword, salt, KDF_ITER);
    state.vault = { ...state.vault, iter: KDF_ITER, salt: toB64(salt) };
    await save();
  } catch (e) { key = prevKey; state.vault = prevVault; throw e; }
}

export function erase() { lock(); clear('vault'); }
