// Small settings that are not collections: theme and vault auto-lock.
import { kv } from './storage.js';

const THEME = 'todos.theme', VAULT = 'todos.vault.settings';

export function getTheme() {
  try { const t = kv.getItem(THEME); return t === 'dark' || t === 'light' ? t : null; } catch (e) { return null; }
}
export function setTheme(t) { try { kv.setItem(THEME, t); } catch (e) { /* ignore */ } }

export const AUTO_LOCK_CHOICES = [1, 5, 15, 30];
export function getVaultPrefs() {
  try {
    const v = JSON.parse(kv.getItem(VAULT));
    return { autoLockMin: AUTO_LOCK_CHOICES.includes(v && v.autoLockMin) ? v.autoLockMin : 5 };
  } catch (e) { return { autoLockMin: 5 }; }
}
export function setVaultPrefs(p) { try { kv.setItem(VAULT, JSON.stringify(p)); } catch (e) { /* ignore */ } }
