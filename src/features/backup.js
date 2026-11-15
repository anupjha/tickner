// Header buttons + dialogs for exporting and importing all data. The rules live in services/backup.js.
import { el } from '../core/dom.js';
import { svg } from '../core/icons.js';
import { register } from '../core/commands.js';
import { today } from '../core/dates.js';
import { toast, openDialog, closeDialog, dlgBtn, copyText } from '../core/ui.js';
import { saveTextFile, pickTextFile } from '../core/platform.js';
import { buildExport, cleanImport, applyImport, countsOf, total, describe } from '../services/backup.js';

function headerButton(actionsEl, icon, label, handler) {
  const b = el('button', { className: 'btn btn-outline btn-icon', type: 'button', title: label, onclick: handler });
  b.setAttribute('aria-label', label); b.innerHTML = svg(icon, 16);
  actionsEl.append(b);
}

export function initBackup(actionsEl) {
  headerButton(actionsEl, 'download', 'Export all data as JSON', doExport);
  headerButton(actionsEl, 'upload', 'Import data from JSON', doImport);
  register('export', doExport);
  register('import', doImport);
}

async function doExport() {
  const json = JSON.stringify(buildExport(), null, 2);
  const result = await saveTextFile('tickner-backup-' + today() + '.json', json);
  if (result === 'saved') toast('Backup saved');
  else if (result === 'error') toast('Couldn’t save the file');
  else if (result === 'unsupported') {
    // no way to write a file here: let the user copy the JSON instead
    const ta = el('textarea', { className: 'dlg-text', value: json, readOnly: true });
    ta.onfocus = () => ta.select();
    openDialog('Export data', 'Saving files isn’t available here. Copy this JSON and keep it in a .json file.', [ta],
      [dlgBtn('Copy', 'btn-default', () => copyText(json, () => toast('Copied to clipboard'))), dlgBtn('Close', 'btn-outline', closeDialog)]);
  }
}

const closeOnly = [dlgBtn('Close', 'btn-outline', closeDialog)];

async function doImport() {
  let file;
  try { file = await pickTextFile(); } catch (e) { toast('Couldn’t read that file.'); return; }
  if (!file) return;
  if (file.tooLarge || file.text == null) { toast('That file is too large (5 MB max).'); return; }
  let cleaned;
  try { cleaned = cleanImport(JSON.parse(file.text)); }
  catch (err) { openDialog('Can’t import this file', err instanceof SyntaxError ? 'The file isn’t valid JSON.' : err.message, [], closeOnly); return; }
  askImport(cleaned, file.name);
}

function askImport(cleaned, name) {
  const counts = countsOf(cleaned);
  if (!total(counts)) { openDialog('Nothing to import', name + ' doesn’t contain any data.', [], closeOnly); return; }

  const option = (value, title, sub, checked) => {
    const radio = el('input', { type: 'radio', name: 'imode', value, checked });
    return el('label', { className: 'choice' }, radio, el('div', {}, el('b', { textContent: title }), el('span', { textContent: sub })));
  };
  const body = [
    option('merge', 'Merge with current data', 'Adds items you don’t have yet. Nothing is deleted. An existing vault is kept as is.', true),
    option('replace', 'Replace everything', 'Erases your current tasks, plans, bookmarks and notes first. Your vault is replaced only if the file contains one.', false)
  ];
  const go = dlgBtn('Import', 'btn-default', () => {
    const mode = document.querySelector('dialog input[name=imode]:checked').value;
    const added = applyImport(cleaned, mode);
    closeDialog();
    toast(total(added) ? 'Imported ' + describe(added) : 'Nothing new to import');
  });
  body.forEach(label => { label.querySelector('input').onchange = e => { go.textContent = e.target.value === 'replace' ? 'Replace & import' : 'Import'; }; });
  openDialog('Import data', `${name}: ${describe(counts)}.`, body, [dlgBtn('Cancel', 'btn-outline', closeDialog), go]);
}
