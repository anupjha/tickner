'use strict';
// Update check, done in the main process (the page has no network access by design).
// It only READS a release feed and reports the newest version; nothing is downloaded or installed automatically.
//
// Feed: set "tickner.updateFeed" in package.json (or the TICKNER_UPDATE_FEED environment variable) to either
//   - a GitHub "latest release" URL:  https://api.github.com/repos/OWNER/REPO/releases/latest
//   - or any JSON file shaped like:   { "version": "1.2.0", "url": "https://…release page…", "notes": "what changed" }
const pkg = require('../package.json');

const isHttps = u => typeof u === 'string' && /^https:[/][/]/i.test(u);
// plain http is only allowed for local test servers
const isLocalHttp = u => { try { const x = new URL(u); return x.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(x.hostname); } catch (e) { return false; } };

const feedUrl = () => {
  const url = process.env.TICKNER_UPDATE_FEED || (pkg.tickner && pkg.tickner.updateFeed) || '';
  return isHttps(url) || isLocalHttp(url) ? url : '';
};

// accepts a GitHub release object or our simple feed; returns { version, url, notes } or null
function normalize(json) {
  if (!json || typeof json !== 'object' || json.draft || json.prerelease) return null;
  const raw = json.tag_name || json.version;
  const version = typeof raw === 'string' ? raw.replace(/^v/, '') : '';
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) return null;
  const url = json.html_url || json.url;
  if (!isHttps(url)) return null;
  const notes = typeof (json.body ?? json.notes) === 'string' ? (json.body ?? json.notes).slice(0, 2000) : '';
  return { version, url: url.slice(0, 500), notes };
}

async function checkForUpdates(fetchImpl) {
  const url = feedUrl();
  if (!url) return { ok: false, reason: 'not-configured' };
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await (fetchImpl || require('electron').net.fetch)(url, { signal: ctrl.signal, headers: { Accept: 'application/json', 'User-Agent': 'Tickner' } });
    if (!res.ok) return { ok: false, reason: 'error' };
    const text = await res.text();
    if (text.length > 200000) return { ok: false, reason: 'error' };
    const info = normalize(JSON.parse(text));
    return info ? { ok: true, ...info } : { ok: false, reason: 'error' };
  } catch (e) { return { ok: false, reason: 'error' }; }
  finally { clearTimeout(timer); }
}

module.exports = { feedUrl, normalize, checkForUpdates, isHttps };
