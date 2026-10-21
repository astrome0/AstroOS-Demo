// AstroOS — drobné pomocné funkce

import { anglicky } from './i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Vytvoří element: el('div.trida#id', { onclick }, ...děti) */
export function el(spec, props = {}, ...kids) {
  const [tagPart, ...classes] = spec.split('.');
  const [tag, id] = tagPart.split('#');
  const n = document.createElement(tag || 'div');
  if (id) n.id = id;
  if (classes.length) n.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const pad = (n) => String(n).padStart(2, '0');

/** Jednoduchá sběrnice událostí. */
export const bus = {
  map: new Map(),
  on(ev, fn) {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev).add(fn);
    return () => this.off(ev, fn);
  },
  off(ev, fn) { this.map.get(ev)?.delete(fn); },
  emit(ev, data) { this.map.get(ev)?.forEach((fn) => fn(data)); },
};

// ---------- čas v češtině (a v angličtině, když je tak nastavený systém) ----------
const DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const DNY_ZKR = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
const MESICE = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
const MESICE_1 = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
const EN_DNY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MESICE = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export const cz = {
  dny: DNY, dnyZkr: DNY_ZKR, mesice: MESICE, mesice1: MESICE_1,
  cas: (d = new Date()) => `${d.getHours()}:${pad(d.getMinutes())}`,
  casS: (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  datumDlouhy: (d = new Date()) => (anglicky()
    ? `${EN_DNY[d.getDay()]}, ${EN_MESICE[d.getMonth()]} ${d.getDate()}`
    : `${DNY[d.getDay()]} ${d.getDate()}. ${MESICE[d.getMonth()]}`),
  datumKratky: (d = new Date()) => (anglicky()
    ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
    : `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`),
  mesicRok: (d = new Date()) => `${(anglicky() ? EN_MESICE : MESICE_1)[d.getMonth()]} ${d.getFullYear()}`,
  /** Zkratky dnů od pondělí (kalendář v panelu). */
  dnyTydne: () => (anglicky() ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne']),
};

/** České skloňování: plural(3, ['položka','položky','položek']) → „3 položky“ */
export function plural(n, [one, few, many]) {
  if (n === 1) return `1 ${one}`;
  if (n >= 2 && n <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** Relativní čas: „před 2 min“ */
export function pred(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  const en = anglicky();
  if (s < 60) return en ? 'now' : 'teď';
  const m = Math.floor(s / 60);
  if (m < 60) return en ? `${m} min ago` : `před ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return en ? `${h} h ago` : `před ${h} h`;
  return en ? `${Math.floor(h / 24)} days ago` : `před ${Math.floor(h / 24)} dny`;
}

/** Sledování tažení myší; vrací funkci pro odpojení. */
export function drag(onMove, onEnd) {
  const move = (e) => onMove(e);
  const up = (e) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    onEnd?.(e);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  return up;
}
