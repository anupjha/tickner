// Named commands: lets the native menu (and later, shortcuts or a palette) trigger actions
// without knowing which module implements them.  register('note:new', fn)  /  run('note:new')
const commands = new Map();
export const register = (name, fn) => commands.set(name, fn);
export const run = (name, ...args) => (commands.has(name) ? commands.get(name)(...args) : undefined);
