// Inspects tickner.db after the first launch: schema, row counts, and that no secret is stored in plain text.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dir = process.argv[2], file = join(dir, 'tickner.db');
const db = new DatabaseSync(file, { readOnly: true });
const count = t => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
const check = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) process.exitCode = 1; };

check(db.prepare('PRAGMA integrity_check').get().integrity_check === 'ok', 'integrity_check is ok');
check(count('todos') === 3, 'todos table has 3 rows');
check(count('plan_blocks') === 1 && count('bookmarks') === 1 && count('notes') === 1 && count('vault') === 1, 'plan, bookmark, notes and vault rows are present');
check(db.prepare("SELECT value FROM meta WHERE name='theme'").get()?.value === readFileSync(join(dir, 'theme.txt'), 'utf8'), 'theme is stored in meta');
const raw = ['', '-wal'].map(x => { try { return readFileSync(file + x, 'latin1'); } catch { return ''; } }).join('');
check(!/S3cr3t-Pa55|octo@example/.test(raw), 'no plain-text secret anywhere in the database files');
check(/Water the plants/.test(raw), 'ordinary data is stored (sanity check for the scan)');
const env = JSON.parse(db.prepare('SELECT env FROM vault').get().env);
check(env.kdf === 'PBKDF2-SHA256' && env.iter === 600000 && env.data.length > 20, 'vault row is an encrypted envelope (PBKDF2-SHA256, 600k rounds)');
