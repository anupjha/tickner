// File access that works in all three places the app runs: desktop (native dialogs), the claude.ai
// artifact runtime (downloads capability) and a normal browser.
import { el } from './dom.js';

const desktop = () => (typeof window !== 'undefined' ? window.desktop : undefined);

// -> 'saved' | 'cancelled' | 'unsupported' | 'error'
export async function saveTextFile(filename, text) {
  const d = desktop();
  if (d) {
    try { return (await d.saveFile(filename, text)) ? 'saved' : 'cancelled'; } catch (e) { return 'error'; }
  }
  if (typeof claude !== 'undefined') {
    let downloads = null;
    try { downloads = await claude.use('downloads'); } catch (e) { /* not available */ }
    if (!downloads) return 'unsupported';
    try { await downloads.save({ filename, data: text }); return 'saved'; }
    catch (e) { return e && e.code === 'declined' ? 'cancelled' : 'unsupported'; }
  }
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: filename });
  document.body.append(a); a.click(); a.remove();
  return 'saved';
}

// -> { name, text } | null   (call from a click handler so browsers allow the file picker)
export async function pickTextFile() {
  const d = desktop();
  if (d) return d.openFile();
  return new Promise(resolve => {
    const input = el('input', { type: 'file', accept: 'application/json,.json' });
    input.onchange = async () => {
      const f = input.files[0];
      resolve(f ? { name: f.name, text: f.size > 5 * 1024 * 1024 ? null : await f.text(), tooLarge: f.size > 5 * 1024 * 1024 } : null);
    };
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

// open an https link in the user's default browser
export function openExternal(url) {
  if (typeof url !== 'string' || !/^https:[/][/]/i.test(url)) return;
  const d = desktop();
  if (d && d.openExternal) d.openExternal(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}
