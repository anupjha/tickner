// Scratch pad view: quick notes with autosave, search and pinning.
import './notes.css';
import { el, scope } from '../../core/dom.js';
import { svg } from '../../core/icons.js';
import { state } from '../../core/store.js';
import { register, run } from '../../core/commands.js';
import { ago } from '../../core/dates.js';
import { toast, openDialog, closeDialog, dlgBtn, copyText } from '../../core/ui.js';
import { getNote, noteTitle, notePreview, noteStats, sortedNotes, searchNotes, createNote, pruneEmpty, editNote, togglePin, deleteNote, saveNotes } from '../../services/notes.js';

export const id = 'notes';
export const label = 'Scratch pad';

const TEMPLATE = `
<div class="notes-layout">
  <aside class="notes-side">
    <div class="notes-side-head">
      <input class="input" id="nSearch" type="search" placeholder="Search notes" aria-label="Search notes">
      <button class="btn btn-default btn-icon" id="nNew" type="button" aria-label="New note" title="New note"><span data-i="plus"></span></button>
    </div>
    <ul id="nList"></ul>
  </aside>
  <div class="card notes-editor">
    <div class="notes-toolbar">
      <span class="notes-meta" id="nMeta"></span>
      <div class="actions" id="nActions">
        <button class="btn btn-ghost sm" id="nPin" type="button" aria-label="Pin note"><span data-i="pin"></span></button>
        <button class="btn btn-ghost sm" id="nCopy" type="button" aria-label="Copy note" title="Copy note"><span data-i="copy"></span></button>
        <button class="btn btn-ghost sm destructive" id="nDel" type="button" aria-label="Delete note" title="Delete note"><span data-i="trash"></span></button>
      </div>
    </div>
    <textarea class="notes-text" id="nText" placeholder="Start typing. The first line becomes the title." aria-label="Note"></textarea>
    <div class="notes-empty" id="nEmpty" hidden>
      <p class="serif" style="font-size:1.15rem;color:var(--foreground)">No notes yet</p>
      <p>Jot down anything. It saves as you type.</p>
      <button class="btn btn-default" id="nEmptyNew" type="button">New note</button>
    </div>
  </div>
</div>`;

let $, selected = null, query = '', timer = null;
const current = () => getNote(selected);

export function mount(section) {
  $ = scope(section);
  section.innerHTML = TEMPLATE;
  $('nNew').onclick = $('nEmptyNew').onclick = newNote;
  $('nSearch').oninput = e => { query = e.target.value.trim().toLowerCase(); renderList(); };
  $('nText').oninput = () => {
    const n = current(); if (!n) return;
    editNote(n, $('nText').value);
    $('nMeta').textContent = 'Saving…';
    clearTimeout(timer); timer = setTimeout(commit, 350);   // autosave shortly after typing stops
  };
  $('nPin').onclick = () => { const n = current(); if (!n) return; togglePin(n); renderList(); loadEditor(); };
  $('nCopy').onclick = () => { const n = current(); if (n) copyText(n.text, () => toast('Note copied')); };
  $('nDel').onclick = onDelete;
  addEventListener('pagehide', () => { if (timer) commit(); });
  register('note:new', () => { run('view:notes'); newNote(); });
}
export function show() { renderNotes(); }
export function hide() { if (timer) commit(); pruneEmpty(null); }
export function reset() { selected = null; query = ''; $('nSearch').value = ''; }

function commit() {
  clearTimeout(timer); timer = null;
  saveNotes(); renderList(); updateMeta();
}

function updateMeta() {
  const n = current(); if (!n) return;
  const { words, chars } = noteStats(n);
  $('nMeta').textContent = `${words} word${words === 1 ? '' : 's'} · ${chars} chars · Saved ${ago(n.updated)}`;
}

function renderList() {
  const list = searchNotes(query), ul = $('nList');
  if (!list.length) { ul.replaceChildren(el('div', { className: 'empty', textContent: state.notes.length ? 'No notes match.' : 'No notes yet.' })); return; }
  ul.replaceChildren(...list.map(n => {
    const b = el('button', { type: 'button', className: 'note-item' + (n.id === selected ? ' sel' : '') });
    b.setAttribute('aria-current', n.id === selected);
    const title = el('div', { className: 'ni-title' });
    if (n.pinned) { const p = el('span', { className: 'ni-pin' }); p.innerHTML = svg('pin', 12); title.append(p); }
    title.append(noteTitle(n));
    b.append(title, el('div', { className: 'ni-prev', textContent: notePreview(n) || 'No additional text' }), el('div', { className: 'ni-time', textContent: ago(n.updated) }));
    b.onclick = () => selectNote(n.id);
    return b;
  }));
}

function loadEditor() {
  const n = current();
  $('nText').hidden = !n; $('nActions').hidden = !n; $('nMeta').hidden = !n; $('nEmpty').hidden = !!n;
  if (!n) return;
  if ($('nText').value !== n.text) $('nText').value = n.text;
  $('nPin').classList.toggle('faved', !!n.pinned);
  $('nPin').querySelector('svg').setAttribute('fill', n.pinned ? 'currentColor' : 'none');
  $('nPin').title = n.pinned ? 'Unpin' : 'Pin to top';
  updateMeta();
}

function renderNotes() {
  if (!state.notes.some(n => n.id === selected)) { const first = sortedNotes()[0]; selected = first ? first.id : null; }
  renderList(); loadEditor();
}

function selectNote(noteId) { if (timer) commit(); pruneEmpty(noteId); selected = noteId; renderNotes(); }

function newNote() {
  if (timer) commit();
  const cur = current();
  if (cur && !cur.text.trim()) { $('nText').focus(); return; }   // reuse the blank note you already have
  pruneEmpty(null);
  const n = createNote();
  selected = n.id; query = ''; $('nSearch').value = '';
  renderNotes(); $('nText').focus();
}

function onDelete() {
  const n = current(); if (!n) return;
  const remove = () => { clearTimeout(timer); timer = null; deleteNote(n.id); selected = null; renderNotes(); };
  if (!n.text.trim()) { remove(); return; }
  openDialog('Delete this note?', noteTitle(n), [], [dlgBtn('Cancel', 'btn-outline', closeDialog), dlgBtn('Delete', 'btn-destructive', () => { closeDialog(); remove(); })]);
}
