'use strict';
// Coercion helpers: everything that reaches the database is forced into the expected type and size first.
const DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const REPEATS = ['daily', 'weekdays', 'weekly', 'monthly'];

const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const flag = v => (v ? 1 : 0);
const int = (v, d = 0) => (Number.isFinite(v) ? Math.trunc(v) : d);
const tagsJson = v => JSON.stringify(Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 8).map(x => x.slice(0, 24)) : []);
const parse = (json, fallback) => { try { return JSON.parse(json); } catch (e) { return fallback; } };
const hasId = x => x && typeof x.id === 'string' && x.id.length > 0;

module.exports = { DATE, REPEATS, s, flag, int, tagsJson, parse, hasId };
