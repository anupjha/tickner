// End-to-end runner:  npm run test:e2e   (builds first; on headless Linux it wraps Electron in xvfb-run)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..', '..');
const electron = createRequire(import.meta.url)('electron');
const headless = process.platform === 'linux' && !process.env.DISPLAY;
const asRoot = process.platform === 'linux' && process.getuid && process.getuid() === 0;
const sh = (cmd, args, env = {}) => spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, ...env } }).status;
const electronRun = (script, ud) => {
  const args = [...(asRoot ? ['--no-sandbox'] : []), '--disable-gpu', '--disable-dev-shm-usage', join(here, script)];
  return headless ? sh('xvfb-run', ['-a', electron, ...args], { UD: ud }) : sh(electron, args, { UD: ud });
};

if (sh('node', [join(root, 'scripts/build.mjs'), '--web']) !== 0) process.exit(1);
let failed = 0;
const step = (title, code) => { console.log(`\n=== ${title} ===`); if (code !== 0) failed++; };

const ud = mkdtempSync(join(tmpdir(), 'tickner-e2e-'));
step('desktop app, first launch (all features through the UI)', electronRun('phase1.cjs', ud));
step('SQLite file contents', sh('node', [join(here, 'check-db.mjs'), ud]));
step('desktop app, second launch (everything reloads from SQLite)', electronRun('phase2.cjs', ud));
rmSync(ud, { recursive: true, force: true });

const ud4 = mkdtempSync(join(tmpdir(), 'tickner-e2e-upgrade-'));
step('upgrading user sees "what\'s new" in the notification center', electronRun('upgrade.cjs', ud4));
rmSync(ud4, { recursive: true, force: true });

const ud5 = mkdtempSync(join(tmpdir(), 'tickner-e2e-feed-'));
step('update notices from a release feed', electronRun('updatefeed.cjs', ud5));
rmSync(ud5, { recursive: true, force: true });

const ud3 = mkdtempSync(join(tmpdir(), 'tickner-e2e-legacy-'));
step('desktop app launched on a data folder from the old "Tasks" app', electronRun('legacy.cjs', ud3));
rmSync(ud3, { recursive: true, force: true });

const ud2 = mkdtempSync(join(tmpdir(), 'tickner-e2e-web-'));
step('web build in a plain browser window', electronRun('web.cjs', ud2));
rmSync(ud2, { recursive: true, force: true });

console.log(failed ? `\n${failed} e2e step(s) FAILED` : '\nAll e2e steps passed');
process.exit(failed ? 1 : 0);
