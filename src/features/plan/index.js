// Daily plan view: day navigation, block form, summary and a timeline.
import './plan.css';
import { el, scope } from '../../core/dom.js';
import { svg } from '../../core/icons.js';
import { on } from '../../core/bus.js';
import { state } from '../../core/store.js';
import { toast, iconBtn } from '../../core/ui.js';
import { today, parseDay, dayStr, toMin, toTime, fmtTime, durFmt } from '../../core/dates.js';
import { short } from '../../core/util.js';
import { describeNext } from '../../services/todos.js';
import { blocksOf, linkedTodo, isBlockDone, unscheduled, summarize, hourRange, layout, saveBlock, removeBlock, toggleBlock } from '../../services/plan.js';

export const id = 'plan';
export const label = 'Daily plan';

const HOUR = 56;   // pixels per hour

const TEMPLATE = `
<div class="plan-head">
  <div class="day-nav">
    <button class="btn btn-outline btn-icon" id="prevDay" type="button" aria-label="Previous day"><span data-i="left"></span></button>
    <button class="btn btn-outline" id="todayBtn" type="button">Today</button>
    <button class="btn btn-outline btn-icon" id="nextDay" type="button" aria-label="Next day"><span data-i="right"></span></button>
  </div>
  <h2 class="serif" id="planTitle"></h2>
</div>
<div class="card card-pad">
  <form class="add" id="blockForm">
    <input class="input" id="bTitle" type="text" placeholder="Block title, e.g. Deep work" aria-label="Block title" required>
    <input class="input" id="bStart" type="time" aria-label="Start time" required>
    <input class="input" id="bEnd" type="time" aria-label="End time" required>
    <select class="input" id="bTask" aria-label="Linked task"></select>
    <button class="btn btn-default" id="bSubmit" type="submit">Add block</button>
    <button class="btn btn-outline" id="bCancel" type="button" hidden>Cancel</button>
  </form>
</div>
<div class="plan-summary" id="planSummary"></div>
<div class="card timeline" id="timeline"></div>
<div class="footer"><span>Click an hour to start a block · click a block to edit it</span></div>`;

let $, active = false;
let planDay = today(), editingBlock = null, startH = 6, endH = 22;

export function mount(section) {
  $ = scope(section);
  section.innerHTML = TEMPLATE;
  $('blockForm').onsubmit = onSubmit;
  $('bStart').oninput = $('bEnd').oninput = () => $('bEnd').setCustomValidity('');
  $('bTask').onchange = () => { const t = state.todos.find(x => x.id === $('bTask').value); if (t && !$('bTitle').value.trim()) $('bTitle').value = t.text; };
  $('bCancel').onclick = () => { resetForm(); render(); };
  $('prevDay').onclick = () => shiftDay(-1);
  $('nextDay').onclick = () => shiftDay(1);
  $('todayBtn').onclick = () => { planDay = today(); resetForm(); render(); };
  on('tick', moveNow);
  resetForm();
}
export function show() { active = true; render(); }
export function hide() { active = false; }
export function reset() { planDay = today(); resetForm(); }

function shiftDay(n) {
  const d = parseDay(planDay); d.setDate(d.getDate() + n);
  planDay = dayStr(d); resetForm(); render();
}

function resetForm() {
  editingBlock = null;
  $('blockForm').reset();
  const h = planDay === today() ? Math.min(new Date().getHours() + 1, 22) : 9;
  $('bStart').value = toTime(h * 60);
  $('bEnd').value = toTime((h + 1) * 60);
  $('bSubmit').textContent = 'Add block';
  $('bCancel').hidden = true;
}

function onSubmit(e) {
  e.preventDefault();
  const start = toMin($('bStart').value), end = toMin($('bEnd').value), title = $('bTitle').value.trim();
  if (!title) return;
  if (end <= start) { $('bEnd').setCustomValidity('End must be after start'); $('bEnd').reportValidity(); return; }
  saveBlock(planDay, { title, start, end, todoId: $('bTask').value || '' }, editingBlock);
  resetForm(); render();
}

function moveNow() {
  const line = $ && $('nowLine');
  if (!line) return;
  const n = new Date(), m = n.getHours() * 60 + n.getMinutes();
  line.style.top = ((m - startH * 60) / 60 * HOUR) + 'px';
  line.hidden = m < startH * 60 || m > endH * 60;
}

function renderPicker(blocks) {
  const editing = editingBlock && blocks.find(b => b.id === editingBlock);
  const sel = $('bTask'), keep = editing ? editing.todoId : sel.value;
  sel.replaceChildren(el('option', { value: '', textContent: 'No linked task' }),
    ...state.todos.filter(t => !t.done || t.id === keep).map(t => el('option', { value: t.id, textContent: short(t.text, 40) })));
  sel.value = keep || '';
}

function renderSummary() {
  const s = summarize(planDay), sum = $('planSummary');
  sum.replaceChildren(el('span', { textContent: s.count
    ? `${s.count} block${s.count > 1 ? 's' : ''} · ${durFmt(s.minutes)} planned · ${s.done} done`
    : 'Nothing planned yet. Add a block, or click an hour on the timeline.' }));
  const open = unscheduled(planDay);
  if (open.length) {
    sum.append(el('span', { textContent: 'Unscheduled:' }));
    open.forEach(t => {
      const c = el('button', { className: 'tagchip', type: 'button', textContent: short(t.text, 28), title: 'Schedule this task' });
      c.onclick = () => { $('bTask').value = t.id; if (!$('bTitle').value.trim()) $('bTitle').value = t.text; $('bTitle').focus(); };
      sum.append(c);
    });
  }
}

function blockNode(b, col, n) {
  const done = isBlockDone(b), linked = linkedTodo(b);
  const height = Math.max((b.end - b.start) / 60 * HOUR - 2, 24);
  const d = el('div', { className: 'block' + (done ? ' done' : ''), title: `${b.title}\n${fmtTime(b.start)} – ${fmtTime(b.end)}` });
  d.style.cssText = `top:${(b.start - startH * 60) / 60 * HOUR + 1}px;height:${height}px;left:calc(${col / n * 100}% + 2px);width:calc(${100 / n}% - 4px)`;

  const cb = el('button', { type: 'button', className: 'cb' });
  cb.setAttribute('role', 'checkbox'); cb.setAttribute('aria-checked', done); cb.setAttribute('aria-label', 'Mark done');
  cb.innerHTML = svg('check', 13, 3);
  cb.onclick = e => { e.stopPropagation(); const { todo, next } = toggleBlock(b); if (next) toast(describeNext(todo, next)); render(); };

  const text = el('div', { className: 'bx' }, el('div', { className: 'bt', textContent: b.title }));
  if (height >= 46) text.append(el('div', { className: 'bm', textContent: `${fmtTime(b.start)} – ${fmtTime(b.end)}` + (linked ? ' · task' : '') }));
  const del = iconBtn('trash', 'Delete block', 'destructive', e => { e.stopPropagation(); removeBlock(planDay, b.id); if (editingBlock === b.id) resetForm(); render(); });
  d.append(cb, text, del);
  d.onclick = () => {
    editingBlock = b.id;
    $('bTitle').value = b.title; $('bStart').value = toTime(b.start); $('bEnd').value = toTime(b.end); $('bTask').value = b.todoId || '';
    $('bSubmit').textContent = 'Save block'; $('bCancel').hidden = false; $('bTitle').focus();
  };
  return d;
}

function render() {
  $('planTitle').textContent = parseDay(planDay).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + (planDay === today() ? ' · Today' : '');
  const blocks = blocksOf(planDay);
  renderPicker(blocks);
  renderSummary();

  ({ startH, endH } = hourRange(blocks));
  const inner = el('div', { className: 'tl-inner' });
  inner.style.height = ((endH - startH) * HOUR) + 'px';
  for (let h = startH; h < endH; h++) {
    const row = el('div', { className: 'hour', title: 'Click to add a block' });
    row.style.top = ((h - startH) * HOUR) + 'px'; row.style.height = HOUR + 'px';
    row.append(el('span', { textContent: fmtTime(h * 60) }));
    row.onclick = () => {
      if (editingBlock) resetForm();
      $('bStart').value = toTime(h * 60); $('bEnd').value = toTime(Math.min(h * 60 + 60, 1439)); $('bTitle').focus();
    };
    inner.append(row);
  }
  layout(blocks).forEach(({ b, col, n }) => inner.append(blockNode(b, col, n)));
  if (planDay === today()) inner.append(el('div', { className: 'now-line', id: 'nowLine' }));
  $('timeline').replaceChildren(inner);
  moveNow();
}
