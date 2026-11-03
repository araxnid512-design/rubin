// Мини-фреймворк DOM-интерфейса: создание элементов, кнопки, полосы, стоимость.
import { audio } from '../../engine/audio.js';
import { Game } from '../state.js';
import { itemName } from '../items.js';

export function h(tag, props = {}, ...kids) {
  const [t, ...cls] = tag.split('.');
  const el = document.createElement(t || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, val] of Object.entries(props || {})) {
    if (val === undefined || val === null || val === false) continue;
    if (k === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), val);
    else if (k === 'text') el.textContent = val;
    else if (k === 'html') el.innerHTML = val;
    else if (k === 'class') el.className += (el.className ? ' ' : '') + val;
    else el.setAttribute(k, val === true ? '' : val);
  }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export function btn(text, cb, cls = '', disabled = false) {
  const b = h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { type: 'button', disabled }, text);
  b.addEventListener('click', (e) => { e.stopPropagation(); if (b.disabled) return; audio.play('ui', -6); cb(e); });
  return b;
}
export function bar(value, color, cls = '') {
  const el = h('div.bar' + (cls ? '.' + cls : ''), {}, h('i', { style: { width: Math.max(0, Math.min(100, value)) + '%', background: color } }));
  el.set = (v) => { el.firstChild.style.width = Math.max(0, Math.min(100, v)) + '%'; };
  return el;
}
export function costText(cost) {
  const parts = Object.entries(cost).map(([k, n]) => { const have = Game.total(k); return h('span.cost' + (have >= n ? '.ok' : '.no'), {}, `${have >= n ? '✓' : '✗'} ${itemName(k)} ${have}/${n}`); });
  return parts.length ? h('div.costs', {}, parts) : h('span.dim', {}, '—');
}
export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
export const short = (n) => (n.length <= 9 ? n : n.slice(0, 8) + '.');
