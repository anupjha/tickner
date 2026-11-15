import { state, persist } from '../core/store.js';
import { uid } from '../core/util.js';

export const getNote = id => state.notes.find(n => n.id === id);
const lines = n => n.text.split('\n').map(l => l.trim()).filter(Boolean);
export const noteTitle = n => lines(n)[0] || 'Untitled note';
export const notePreview = n => lines(n).slice(1).join(' · ').slice(0, 90);
export const noteStats = n => ({ words: (n.text.trim().match(/\S+/g) || []).length, chars: n.text.length });

// pinned first, then most recently edited
export const sortedNotes = () => state.notes.slice().sort((a, b) => (b.pinned === true) - (a.pinned === true) || b.updated - a.updated);
export const searchNotes = q => sortedNotes().filter(n => !q || n.text.toLowerCase().includes(q));

// a new note is not saved until it has text
export function createNote() {
  const n = { id: uid(), text: '', pinned: false, created: Date.now(), updated: Date.now() };
  state.notes.push(n);
  return n;
}
// blank notes are discarded when you move away from them
export function pruneEmpty(keepId) {
  const before = state.notes.length;
  state.notes = state.notes.filter(n => n.text.trim() || n.id === keepId);
  if (state.notes.length !== before) persist('notes');
}
export function editNote(n, text) { n.text = text; n.updated = Date.now(); }
export function togglePin(n) { n.pinned = !n.pinned; persist('notes'); }
export function deleteNote(id) { state.notes = state.notes.filter(n => n.id !== id); persist('notes'); }
export const saveNotes = () => persist('notes');
