// Bookmarks view: save links with tags, search, favorites, edit in place.
import './bookmarks.css';
import { el, scope } from '../../core/dom.js';
import { svg } from '../../core/icons.js';
import { state } from '../../core/store.js';
import { iconBtn, copyText } from '../../core/ui.js';
import { hostOf, shortUrl } from '../../core/util.js';
import { addMark, updateMark, toggleFav, removeMark, markTags, filterMarks } from '../../services/bookmarks.js';

export const id = 'marks';
export const label = 'Bookmarks';

const TEMPLATE = `
<div class="card card-pad">
  <form class="add" id="markForm">
    <input class="input" id="mUrl" type="text" inputmode="url" placeholder="Paste a URL" aria-label="URL" autocomplete="off" required>
    <input class="input" id="mTitle" type="text" placeholder="Title (optional)" aria-label="Title" style="flex:1 1 160px">
    <input class="input" id="mTags" type="text" placeholder="Tags: read, dev" aria-label="Tags, comma separated" style="flex:1 1 140px">
    <button class="btn btn-default" type="submit"><span data-i="plus"></span>Save</button>
  </form>
  <p class="form-msg" id="mMsg" hidden></p>
</div>
<div class="mark-tools">
  <input class="input" id="mSearch" type="search" placeholder="Search title, URL or tag" aria-label="Search bookmarks">
  <button class="btn btn-outline" id="mFavBtn" type="button" aria-pressed="false"><span data-i="star"></span>Favorites</button>
</div>
<div class="tagbar" id="mTagbar"></div>
<ul id="mList"></ul>
<div class="footer"><span id="mCount"></span><span>Saved on this device</span></div>`;

const MESSAGES = { invalid: 'That doesn’t look like a valid http(s) URL.', duplicate: 'You’ve already saved this link.' };

let $, query = '', tagFilter = null, favOnly = false, editingId = null;

export function mount(section) {
  $ = scope(section);
  section.innerHTML = TEMPLATE;
  $('markForm').onsubmit = e => {
    e.preventDefault();
    const r = addMark({ url: $('mUrl').value, title: $('mTitle').value, tags: $('mTags').value });
    if (r.error) { $('mMsg').textContent = MESSAGES[r.error]; $('mMsg').hidden = false; return; }
    $('mMsg').hidden = true; $('markForm').reset(); render(); $('mUrl').focus();
  };
  $('mUrl').oninput = () => { $('mMsg').hidden = true; };
  $('mSearch').oninput = e => { query = e.target.value.trim().toLowerCase(); render(); };
  $('mFavBtn').onclick = () => { favOnly = !favOnly; render(); };
}
export function show() { render(); }
export function reset() { tagFilter = null; favOnly = false; editingId = null; }

function render() {
  $('mFavBtn').setAttribute('aria-pressed', favOnly);
  const tags = markTags();
  if (tagFilter && !tags.includes(tagFilter)) tagFilter = null;
  $('mTagbar').replaceChildren(...tags.map(g => {
    const b = el('button', { className: 'tagchip', type: 'button', textContent: '#' + g });
    b.setAttribute('aria-pressed', g === tagFilter);
    b.onclick = () => { tagFilter = tagFilter === g ? null : g; render(); };
    return b;
  }));

  const shown = filterMarks({ q: query, tag: tagFilter, fav: favOnly });
  if (!shown.length) {
    const e = el('div', { className: 'empty' });
    e.innerHTML = '<p class="serif"></p><span></span>';
    e.firstChild.textContent = state.marks.length ? 'No matches' : 'No bookmarks yet';
    e.lastChild.textContent = state.marks.length ? 'Try a different search or filter.' : 'Paste a link above to save your first one.';
    $('mList').replaceChildren(e);
  } else $('mList').replaceChildren(...shown.map(rowFor));
  const n = state.marks.length;
  $('mCount').textContent = n + (n === 1 ? ' bookmark' : ' bookmarks') + (shown.length !== n ? ' · ' + shown.length + ' shown' : '');
}

function editRow(m, li) {
  const ui = el('input', { className: 'input', type: 'text', value: m.url });
  ui.setAttribute('aria-label', 'URL');
  const ti = el('input', { className: 'input', type: 'text', value: m.title, placeholder: 'Title' });
  const gi = el('input', { className: 'input', type: 'text', value: (m.tags || []).join(', '), placeholder: 'Tags: read, dev' });
  const commit = () => {
    const r = updateMark(m, { url: ui.value, title: ti.value, tags: gi.value });
    if (r.error) { ui.setCustomValidity(r.error === 'invalid' ? 'Enter a valid http(s) URL' : 'You already saved this link'); ui.reportValidity(); return; }
    editingId = null; render();
  };
  const cancel = () => { editingId = null; render(); };
  ui.oninput = () => ui.setCustomValidity('');
  [ui, ti, gi].forEach(i => { i.onkeydown = e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }; });
  li.append(el('div', { className: 'editbox' }, ui, ti, gi,
    el('button', { className: 'btn btn-default sm-text', type: 'button', textContent: 'Save', onclick: commit }),
    el('button', { className: 'btn btn-outline sm-text', type: 'button', textContent: 'Cancel', onclick: cancel })));
  setTimeout(() => ti.focus(), 0);
}

function rowFor(m) {
  const li = el('li', { className: 'mark' });
  if (editingId === m.id) { editRow(m, li); return li; }

  const link = el('a', { className: 'mt', href: m.url, target: '_blank', rel: 'noopener noreferrer', textContent: m.title });
  const body = el('div', { className: 'mb' }, link, el('div', { className: 'mu', textContent: shortUrl(m.url), title: m.url }));
  if ((m.tags || []).length) {
    const meta = el('div', { className: 'meta' });
    m.tags.forEach(g => {
      const c = el('button', { className: 'badge badge-secondary', type: 'button', textContent: '#' + g, title: 'Filter by #' + g });
      c.onclick = () => { tagFilter = g; render(); };
      meta.append(c);
    });
    body.append(meta);
  }

  const star = iconBtn('star', m.fav ? 'Remove from favorites' : 'Add to favorites', m.fav ? 'faved' : '', () => { toggleFav(m); render(); });
  if (m.fav) star.firstElementChild.setAttribute('fill', 'currentColor');
  const copy = iconBtn('copy', 'Copy link', '', () => copyText(m.url, () => {
    copy.innerHTML = svg('check', 15); setTimeout(() => { copy.innerHTML = svg('copy', 15); }, 1200);
  }));
  const actions = el('div', { className: 'actions' }, star, copy,
    iconBtn('pencil', 'Edit', '', () => { editingId = m.id; render(); }),
    iconBtn('trash', 'Delete', 'destructive', () => { removeMark(m.id); render(); }));
  li.append(el('div', { className: 'avatar', textContent: hostOf(m.url).charAt(0) || '?' }), body, actions);
  return li;
}
