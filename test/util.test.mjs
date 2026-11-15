import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTags, normUrl, hostOf, shortUrl, dedupe } from '../src/core/util.js';
import { toMin, toTime, durFmt, isDate } from '../src/core/dates.js';

test('parseTags lowercases, strips #, dedupes and caps at 8', () => {
  assert.deepEqual(parseTags(' Work, #home ,work,, #Home '), ['work', 'home']);
  assert.equal(parseTags('a,b,c,d,e,f,g,h,i,j').length, 8);
});

test('normUrl accepts web links and rejects dangerous schemes', () => {
  assert.equal(normUrl('example.com/docs'), 'https://example.com/docs');
  assert.equal(normUrl('http://localhost:3000/x'), 'http://localhost:3000/x');
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://example.com', 'mailto:a@b.co', '', 'nodots']) {
    assert.equal(normUrl(bad), null, bad);
  }
});

test('url display helpers', () => {
  assert.equal(hostOf('https://www.example.com/a'), 'example.com');
  assert.equal(shortUrl('https://example.com/a/b?q=1'), 'example.com/a/b?q=1');
});

test('dedupe keeps the first of each key', () => {
  assert.deepEqual(dedupe([{ id: 1, v: 'a' }, { id: 1, v: 'b' }, { id: 2, v: 'c' }], 'id').map(x => x.v), ['a', 'c']);
});

test('time helpers', () => {
  assert.equal(toMin('09:30'), 570); assert.equal(toTime(570), '09:30');
  assert.equal(durFmt(90), '1h 30m'); assert.equal(durFmt(0), '0m'); assert.equal(durFmt(45), '45m');
  assert.ok(isDate('2026-11-13')); assert.ok(!isDate('13/11/2026')); assert.ok(!isDate(null));
});
