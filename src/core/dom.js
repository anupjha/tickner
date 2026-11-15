export const $ = id => document.getElementById(id);

// el('div', { className: 'x', onclick }, child1, 'text', ...)  -  safe element builder (never parses HTML)
export function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  kids.forEach(k => node.append(k));
  return node;
}

// scoped lookup helper for a view:  const $ = scope(root);  $('list')
export const scope = root => id => root.querySelector('#' + id);
