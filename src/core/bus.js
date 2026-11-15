// Tiny event bus so modules can react to each other without importing each other.
//   data:replaced  - an import replaced the stored data (views should reset and re-render)
//   day:changed    - the calendar date rolled over at midnight
//   tick           - once per second
//   vault:locked   - the vault was locked (manually, on idle, or by an import)
const handlers = new Map();

export function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(fn);
  return () => handlers.get(event).delete(fn);
}

export function emit(event, payload) {
  (handlers.get(event) || []).forEach(fn => fn(payload));
}
