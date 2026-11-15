// Tasks view: add form, filters, tag chips, list with edit-in-place and drag-to-reorder.
import './tasks.css';
import { el, scope } from '../../core/dom.js';
import { svg } from '../../core/icons.js';
import { on } from '../../core/bus.js';
import { state } from '../../core/store.js';
import { toast, iconBtn } from '../../core/ui.js';
import { today, fmt } from '../../core/dates.js';
import { tagsOf, parseTags } from '../../core/util.js';
import { REPEATS, FILTERS, isRepeat, isOverdue, visible, allTags, addTodo, updateTodo, removeTodo, clearCompleted, moveTodo, setDone, describeNext } from '../../services/todos.js';

export const id = 'tasks';
export const label = 'Tasks';

const TEMPLATE = `
<div class="card card-pad">
  <form class="add" id="add">
    <input class="input" id="text" type="text" placeholder="What needs doing?" aria-label="New task" required>
    <input class="input" id="due" type="date" aria-label="Due date">
    <input class="input" id="tags" type="text" placeholder="Tags: work, home" aria-label="Tags, comma separated" style="flex:1 1 140px">
    <select class="input" id="repeat" aria-label="Repeat"></select>
    <button class="btn btn-default" type="submit"><span data-i="plus"></span>Add</button>
  </form>
</div>
<div class="tabs-row">
  <div class="tabs-list" id="tabs" role="tablist"></div>
  <button class="btn btn-ghost sm-text" id="clear" type="button" style="color:var(--muted-foreground)">Clear completed</button>
</div>
<div class="tagbar" id="tagbar"></div>
<ul id="list"></ul>
<div class="footer"><span id="count"></span><span>Drag <span data-i="grip" style="vertical-align:-3px"></span> to reorder · double-click to edit</span></div>`;

let $, active = false;
let filter = 'all', tagFilter = null, editingId = null, dragId = null;

function fillRepeat(select, value = '') {
  select.setAttribute('aria-label', 'Repeat');
  select.replaceChildren(el('option', { value: '', textContent: 'No repeat' }),
    ...Object.entries(REPEATS).map(([k, v]) => el('option', { value: k, textContent: v })));
  select.value = isRepeat(value) ? value : '';
  return select;
}

export function mount(section) {
  $ = scope(section);
  section.innerHTML = TEMPLATE;
  fillRepeat($('repeat'));
  $('add').onsubmit = e => {
    e.preventDefault();
    const text = $('text').value.trim();
    if (!text) return;
    addTodo({ text, due: $('due').value, tags: parseTags($('tags').value), repeat: $('repeat').value });
    ['text', 'due', 'tags', 'repeat'].forEach(f => { $(f).value = ''; });
    render(); $('text').focus();
  };
  $('clear').onclick = () => { clearCompleted(); render(); };
  on('day:changed', () => { if (active && !editingId) render(); });   // refresh Today / Overdue badges
}
export function show() { active = true; render(); }
export function hide() { active = false; }
export function reset() { filter = 'all'; tagFilter = null; editingId = null; }

function render() {
  $('tabs').replaceChildren(...Object.keys(FILTERS).map(f => {
    const n = state.todos.filter(FILTERS[f]).length;
    const b = el('button', { className: 'tab', type: 'button', textContent: f[0].toUpperCase() + f.slice(1) + (f === 'overdue' && n ? ' ' + n : '') });
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', f === filter);
    b.onclick = () => { filter = f; render(); };
    return b;
  }));

  const tags = allTags();
  if (tagFilter && !tags.includes(tagFilter)) tagFilter = null;
  $('tagbar').replaceChildren(...tags.map(g => {
    const b = el('button', { className: 'tagchip', type: 'button', textContent: '#' + g });
    b.setAttribute('aria-pressed', g === tagFilter);
    b.onclick = () => { tagFilter = tagFilter === g ? null : g; render(); };
    return b;
  }));

  const shown = state.todos.filter(t => visible(t, filter, tagFilter));
  if (!shown.length) {
    const e = el('div', { className: 'empty' });
    e.innerHTML = '<p class="serif"></p><span></span>';
    e.firstChild.textContent = filter === 'all' ? 'A clear slate' : 'Nothing here';
    e.lastChild.textContent = filter === 'all' ? 'Add your first task above.' : 'No tasks match this filter.';
    $('list').replaceChildren(e);
  } else $('list').replaceChildren(...shown.map(rowFor));

  const left = state.todos.filter(t => !t.done).length;
  $('count').textContent = left + (left === 1 ? ' task left' : ' tasks left');
}

function checkbox(t) {
  const b = el('button', { type: 'button', className: 'cb' });
  b.setAttribute('role', 'checkbox'); b.setAttribute('aria-checked', t.done); b.setAttribute('aria-label', 'Complete task');
  b.innerHTML = svg('check', 13, 3);
  b.onclick = () => { const next = setDone(t, !t.done); if (next) toast(describeNext(t, next)); render(); };
  return b;
}

function dueBadge(t) {
  if (!t.due) return null;
  const overdue = isOverdue(t), isToday = t.due === today();
  const b = el('span', { className: 'badge ' + (overdue ? 'badge-destructive' : isToday ? 'badge-secondary' : 'badge-outline') });
  b.innerHTML = svg(overdue ? 'alert' : 'cal', 11);
  b.append((overdue ? 'Overdue · ' : isToday ? 'Today · ' : '') + fmt(t.due));
  return b;
}

function editRow(t, li) {
  const ti = el('input', { className: 'input', type: 'text', value: t.text });
  const di = el('input', { className: 'input', type: 'date', value: t.due || '' });
  const gi = el('input', { className: 'input', type: 'text', value: tagsOf(t).join(', '), placeholder: 'Tags: work, home' });
  const ri = fillRepeat(el('select', { className: 'input' }), t.repeat);
  const commit = () => {
    const text = ti.value.trim();
    if (text) updateTodo(t, { text, due: di.value || '', tags: parseTags(gi.value), repeat: ri.value });
    editingId = null; render();
  };
  const cancel = () => { editingId = null; render(); };
  [ti, di, gi].forEach(i => { i.onkeydown = e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }; });
  li.style.paddingLeft = '12px';
  li.append(checkbox(t), el('div', { className: 'editbox' }, ti, di, gi, ri,
    el('button', { className: 'btn btn-default sm-text', type: 'button', textContent: 'Save', onclick: commit }),
    el('button', { className: 'btn btn-outline sm-text', type: 'button', textContent: 'Cancel', onclick: cancel })));
  setTimeout(() => ti.focus(), 0);
}

function rowFor(t) {
  const li = el('li', { className: 'item' + (t.done ? ' done' : '') });
  if (editingId === t.id) { editRow(t, li); return li; }

  const label = el('div', { className: 'label', textContent: t.text, title: 'Double-click to edit' });
  label.ondblclick = () => { editingId = t.id; render(); };
  const body = el('div', { className: 'body' }, label);

  const meta = el('div', { className: 'meta' });
  const due = dueBadge(t); if (due) meta.append(due);
  if (isRepeat(t.repeat)) {
    const r = el('span', { className: 'badge badge-outline', title: 'Repeats ' + REPEATS[t.repeat].toLowerCase() });
    r.innerHTML = svg('repeat', 11); r.append(REPEATS[t.repeat]); meta.append(r);
  }
  tagsOf(t).forEach(g => {
    const c = el('button', { className: 'badge badge-secondary', type: 'button', textContent: '#' + g, title: 'Filter by #' + g });
    c.onclick = () => { tagFilter = g; render(); };
    meta.append(c);
  });
  if (meta.children.length) body.append(meta);

  const grip = el('span', { className: 'grip', title: 'Drag to reorder' }); grip.innerHTML = svg('grip', 16);
  const actions = el('div', { className: 'actions' },
    iconBtn('pencil', 'Edit', '', () => { editingId = t.id; render(); }),
    iconBtn('trash', 'Delete', 'destructive', () => { removeTodo(t.id); render(); }));
  li.append(grip, checkbox(t), body, actions);

  li.draggable = true;
  li.ondragstart = e => { dragId = t.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); };
  li.ondragend = () => { dragId = null; render(); };
  li.ondragover = e => { if (dragId && dragId !== t.id) { e.preventDefault(); li.classList.add('over'); } };
  li.ondragleave = () => li.classList.remove('over');
  li.ondrop = e => { e.preventDefault(); if (dragId && dragId !== t.id) { moveTodo(dragId, t.id); render(); } };
  return li;
}
