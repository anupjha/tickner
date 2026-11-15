import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { normalize, feedUrl, checkForUpdates } = createRequire(import.meta.url)('../electron/updates.js');

const withFeed = async (value, fn) => {
  const before = process.env.TICKNER_UPDATE_FEED;
  if (value === undefined) delete process.env.TICKNER_UPDATE_FEED; else process.env.TICKNER_UPDATE_FEED = value;
  try { return await fn(); } finally { if (before === undefined) delete process.env.TICKNER_UPDATE_FEED; else process.env.TICKNER_UPDATE_FEED = before; }
};
const reply = body => async () => ({ ok: true, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

test('reads a GitHub "latest release" object and the simple feed format', () => {
  assert.deepEqual(normalize({ tag_name: 'v1.2.0', html_url: 'https://github.com/o/r/releases/tag/v1.2.0', body: 'Notes', draft: false, prerelease: false }),
    { version: '1.2.0', url: 'https://github.com/o/r/releases/tag/v1.2.0', notes: 'Notes' });
  assert.deepEqual(normalize({ version: '2.0.1', url: 'https://example.com/r', notes: 'n' }), { version: '2.0.1', url: 'https://example.com/r', notes: 'n' });
});

test('rejects drafts, pre-releases, odd versions and non-https links', () => {
  const ok = { version: '1.2.0', url: 'https://example.com/r' };
  assert.ok(normalize(ok));
  assert.equal(normalize({ ...ok, draft: true }), null);
  assert.equal(normalize({ ...ok, prerelease: true }), null);
  for (const version of ['latest', '1.2', '1.2.0-beta', '', 5]) assert.equal(normalize({ ...ok, version }), null, String(version));
  for (const url of ['http://example.com/r', 'javascript:alert(1)', 'file:///etc/passwd', '', undefined]) assert.equal(normalize({ ...ok, url }), null, String(url));
  assert.equal(normalize(null), null); assert.equal(normalize('x'), null);
  assert.equal(normalize({ ...ok, notes: 'x'.repeat(9000) }).notes.length, 2000);
});

test('the feed address must be https (plain http only for local test servers)', async () => {
  await withFeed(undefined, () => assert.equal(feedUrl(), ''));
  await withFeed('https://api.github.com/repos/o/r/releases/latest', () => assert.ok(feedUrl()));
  await withFeed('http://127.0.0.1:8080/feed.json', () => assert.ok(feedUrl()));
  await withFeed('http://example.com/feed.json', () => assert.equal(feedUrl(), ''));
  await withFeed('file:///tmp/feed.json', () => assert.equal(feedUrl(), ''));
});

test('checkForUpdates: not configured, success, bad body, http error, network failure', async () => {
  await withFeed(undefined, async () => assert.deepEqual(await checkForUpdates(reply({})), { ok: false, reason: 'not-configured' }));
  await withFeed('https://example.com/feed.json', async () => {
    const good = await checkForUpdates(reply({ version: '1.2.0', url: 'https://example.com/r', notes: 'hi' }));
    assert.deepEqual(good, { ok: true, version: '1.2.0', url: 'https://example.com/r', notes: 'hi' });
    assert.equal((await checkForUpdates(reply('not json'))).reason, 'error');
    assert.equal((await checkForUpdates(reply({ version: 'nope' }))).reason, 'error');
    assert.equal((await checkForUpdates(async () => ({ ok: false }))).reason, 'error');
    assert.equal((await checkForUpdates(async () => { throw new Error('offline'); })).reason, 'error');
    assert.equal((await checkForUpdates(reply('x'.repeat(300000)))).reason, 'error', 'oversized feeds are refused');
  });
});
