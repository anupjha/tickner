// Tabs + view registry. A view is a module exporting { id, label, mount(section), show(), hide?(), reset?() }.
// To add a feature: create the module, then add it to the list in src/main.js.
import { el } from './dom.js';
import { hydrateIcons } from './icons.js';
import { on } from './bus.js';
import { register as registerCommand } from './commands.js';

const views = [];
let current = null, tabsEl = null;

export const currentView = () => (current ? current.id : null);

export function renderTabs() {
  tabsEl.replaceChildren(...views.map(v => {
    const b = el('button', { className: 'tab', type: 'button', textContent: v.label, onclick: () => setView(v.id) });
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', v === current);
    return b;
  }));
}

export function setView(id) {
  const next = views.find(v => v.id === id) || views[0];
  if (current && current !== next && current.hide) current.hide();
  current = next;
  views.forEach(v => { v.section.hidden = v !== current; });
  renderTabs();
  current.show();
}

export function initRouter({ tabs, root, list, initial }) {
  tabsEl = tabs;
  list.forEach(v => {
    views.push(v);
    v.section = el('section', { id: 'view-' + v.id });
    v.section.hidden = true;
    root.append(v.section);
    v.mount(v.section);
    hydrateIcons(v.section);
    registerCommand('view:' + v.id, () => setView(v.id));
  });
  // an import replaced all data: clear editing state everywhere, then redraw what is on screen
  on('data:replaced', () => { views.forEach(v => v.reset && v.reset()); if (current) current.show(); });
  setView(initial || views[0].id);
}
