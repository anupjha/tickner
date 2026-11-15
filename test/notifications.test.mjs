import test from 'node:test';
import assert from 'node:assert/strict';
import { resetState } from './helpers.mjs';
import { state } from '../src/core/store.js';
import { cleanNotify } from '../src/core/notify-schema.js';
import { addTodo } from '../src/services/todos.js';
import { compareVersions, detectUpgrade, list, unreadCount, markAllRead, dismiss, setPref, recordUpdate, shouldAutoCheck, markChecked, currentVersion } from '../src/services/notifications.js';
import { CHANGELOG } from '../src/changelog.js';

test('version comparison', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('v2.0.0', '1.99.99'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.0.1', '1.1.0'), -1);
});

test('the changelog is well formed and newest first', () => {
  for (let i = 1; i < CHANGELOG.length; i++) assert.equal(compareVersions(CHANGELOG[i - 1].version, CHANGELOG[i].version), 1);
  CHANGELOG.forEach(r => { assert.match(r.version, /^\d+\.\d+\.\d+$/); assert.ok(r.title && r.highlights.length); });
  assert.equal(currentVersion(), CHANGELOG[0].version);
});

test('a fresh install records the version and shows nothing', () => {
  resetState();
  assert.deepEqual(detectUpgrade('1.1.0'), []);
  assert.equal(state.notify.seenVersion, '1.1.0');
  assert.equal(unreadCount(), 0);
});

test('an existing install (has data, no recorded version) is treated as coming from 1.0.0', () => {
  resetState(); addTodo({ text: 'already using it' });
  const added = detectUpgrade('1.1.0');
  assert.deepEqual(added.map(i => i.id), ['whatsnew:1.1.0']);
  assert.equal(unreadCount(), 1);
  assert.equal(state.notify.seenVersion, '1.1.0');
  assert.deepEqual(detectUpgrade('1.1.0'), [], 'does not repeat on the next launch');
});

test('skipping several versions lists every release you missed', () => {
  resetState(); state.notify.seenVersion = '0.9.0';
  assert.deepEqual(detectUpgrade('1.1.0').map(i => i.version).sort(), ['1.0.0', '1.1.0']);
  assert.deepEqual(list().map(i => i.version), ['1.1.0', '1.0.0']);
});

test('turning "new features" off still moves the recorded version forward', () => {
  resetState(); state.notify.seenVersion = '1.0.0'; setPref('newFeatures', false);
  assert.deepEqual(detectUpgrade('1.1.0'), []);
  assert.equal(state.notify.seenVersion, '1.1.0');
});

test('read, dismiss and unknown preferences', () => {
  resetState(); state.notify.seenVersion = '0.9.0'; detectUpgrade('1.1.0');
  assert.equal(unreadCount(), 2);
  markAllRead(); assert.equal(unreadCount(), 0);
  dismiss('whatsnew:1.0.0'); assert.equal(list().length, 1);
  setPref('bogus', true); assert.ok(!('bogus' in state.notify.prefs));
});

test('update notifications: newer only, https only, announced once, dismissed stays dismissed', () => {
  resetState();
  assert.equal(recordUpdate({ version: '1.1.0', url: 'https://example.com/r' }, '1.1.0'), null, 'same version');
  assert.equal(recordUpdate({ version: '1.2.0', url: 'http://example.com/r' }, '1.1.0'), null, 'not https');
  assert.equal(recordUpdate({ version: 'latest', url: 'https://example.com/r' }, '1.1.0'), null, 'not a version');
  const item = recordUpdate({ version: 'v1.2.0', url: 'https://example.com/r', notes: 'x'.repeat(5000) }, '1.1.0');
  assert.equal(item.id, 'update:1.2.0'); assert.equal(item.notes.length, 2000);
  assert.equal(recordUpdate({ version: '1.2.0', url: 'https://example.com/r' }, '1.1.0'), null, 'already announced');
  const newer = recordUpdate({ version: '1.3.0', url: 'https://example.com/r3' }, '1.1.0');
  assert.deepEqual(list().map(i => i.id), ['update:1.3.0'], 'a newer release replaces the older pending one');
  dismiss(newer.id);
  assert.equal(recordUpdate({ version: '1.3.0', url: 'https://example.com/r3' }, '1.1.0'), null, 'dismissed updates are not re-announced');
  assert.ok(recordUpdate({ version: '1.4.0', url: 'https://example.com/r4' }, '1.1.0'), 'but a later release is');
});

test('an update that has been installed is removed on the next start', () => {
  resetState(); state.notify.seenVersion = '1.1.0';
  recordUpdate({ version: '1.2.0', url: 'https://example.com/r' }, '1.1.0');
  detectUpgrade('1.2.0');
  assert.equal(list().filter(i => i.type === 'update').length, 0);
});

test('automatic checks run at most once a day and respect the preference', () => {
  resetState();
  assert.equal(shouldAutoCheck(), true);
  markChecked(Date.now()); assert.equal(shouldAutoCheck(), false);
  assert.equal(shouldAutoCheck(Date.now() + 25 * 3600 * 1000), true);
  setPref('updateCheck', false); assert.equal(shouldAutoCheck(Date.now() + 99 * 3600 * 1000), false);
});

test('stored notification state is rebuilt defensively', () => {
  const c = cleanNotify({ seenVersion: 'abc', prefs: { newFeatures: 'yes', system: false }, lastCheck: 'x',
    dismissedUpdates: ['1.2.0', 5], items: [{ type: 'update', version: '1.2.0', url: 'javascript:alert(1)', notes: 7 }, { type: 'bogus', version: '1.0.0' }, null] });
  assert.equal(c.seenVersion, null); assert.deepEqual(c.prefs, { newFeatures: true, updateCheck: true, system: false });
  assert.equal(c.lastCheck, 0); assert.deepEqual(c.dismissedUpdates, ['1.2.0']);
  assert.equal(c.items.length, 1); assert.equal(c.items[0].url, ''); assert.equal(c.items[0].notes, '');
  assert.deepEqual(cleanNotify('garbage'), cleanNotify(null));
});
