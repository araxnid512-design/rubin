/* Мини-помощник для построения DOM без фреймворков. */
(function (G) {
  'use strict';

  function append(el, kids) {
    for (const k of kids) {
      if (k == null || k === false) continue;
      if (Array.isArray(k)) append(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    }
  }

  // h('div', { class: 'card', onclick: fn }, 'текст', h('b', null, 'жирный'))
  function h(tag, props) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'disabled') el.disabled = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }

  // SVG-элементы
  function svg(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) {
      if (attrs[k] == null) continue;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    for (let i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  }

  function bar(value, max, cls) {
    const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
    return h('div', { class: 'bar ' + (cls || '') }, h('i', { style: 'width:' + pct.toFixed(1) + '%' }));
  }

  function paragraphs(text) {
    return String(text).split(/\n\n+/).map((p) => h('p', null, p));
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  G.Dom = { h, svg, bar, paragraphs, clear, append };
})(globalThis.G = globalThis.G || {});
