import { state } from '../src/core/store.js';
import { defaultNotify } from '../src/core/notify-schema.js';

// fresh, empty app state for each test (storage is in-memory under Node)
export function resetState() {
  state.todos = []; state.plan = {}; state.marks = []; state.notes = []; state.vault = null; state.notify = defaultNotify();
}
