'use strict';
const { DATE, s, flag, int, hasId } = require('../sanitize');

module.exports = {
  key: 'todos.plan.v1',
  save(db, obj, h) {
    const rows = [];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [day, list] of Object.entries(obj)) {
        if (!DATE.test(day) || !Array.isArray(list)) continue;
        for (const b of list) if (hasId(b)) rows.push([s(b.id, 80), day, int(b.start), int(b.end), s(b.title, 200), s(b.todoId, 80), flag(b.done)]);
      }
    }
    h.prune('plan_blocks', rows.map(r => r[0]));
    const up = db.prepare(`INSERT INTO plan_blocks (id, day, start_min, end_min, title, todo_id, done) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET day=excluded.day, start_min=excluded.start_min, end_min=excluded.end_min,
      title=excluded.title, todo_id=excluded.todo_id, done=excluded.done`);
    rows.forEach(r => up.run(...r));
  },
  load(db) {
    const plan = {}; let n = 0;
    for (const r of db.prepare('SELECT * FROM plan_blocks ORDER BY day, start_min, end_min, rowid').all()) {
      (plan[r.day] ||= []).push({ id: r.id, title: r.title, start: r.start_min, end: r.end_min, todoId: r.todo_id, done: !!r.done });
      n++;
    }
    return n ? JSON.stringify(plan) : undefined;
  }
};
