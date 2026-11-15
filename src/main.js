// Entry point: wires the shell together and lists the views. To add a feature, create a module that exports
//   { id, label, mount(section), show(), hide?(), reset?() }   and add it to VIEWS below.
import './styles/base.css';
import './styles/components.css';

import { $ } from './core/dom.js';
import { initUI } from './core/ui.js';
import { initTheme } from './core/theme.js';
import { initDesktop } from './core/desktop.js';
import { initRouter } from './core/router.js';
import { startClock } from './core/clock.js';
import { initBackup } from './features/backup.js';
import { initNotifications } from './features/notifications/index.js';

import * as tasks from './features/tasks/index.js';
import * as plan from './features/plan/index.js';
import * as bookmarks from './features/bookmarks/index.js';
import * as notes from './features/notes/index.js';
import * as vault from './features/vault/index.js';

const VIEWS = [tasks, plan, bookmarks, notes, vault];

initUI();
initDesktop();
initNotifications($('hdrActions'));   // bell: what's new + update notices
initBackup($('hdrActions'));   // export / import buttons
initTheme($('hdrActions'));    // light / dark switch
startClock($('clock'));
initRouter({ tabs: $('views'), root: $('viewRoot'), list: VIEWS, initial: 'tasks' });

// test hook: only available when the page is opened with ?debug
if (new URLSearchParams(location.search).has('debug')) {
  Promise.all([import('./core/store.js'), import('./services/todos.js'), import('./services/backup.js'), import('./services/vault/session.js')])
    .then(([store, todos, backup, session]) => { window.__app = { state: store.state, todos, backup, session }; });
}
