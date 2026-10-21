// AstroOS — správce oken (přesun, změna velikosti, přichycení, minimalizace)

import { $, el, clamp, bus, drag } from './util.js';
import { icon, glyfAplikace } from './icons.js';
import { panelMisto } from './vzhled.js';

let zTop = 100;
let cascade = 0;

export const windows = [];
let focused = null;
let aktivniPlocha = 0;

/** Okna aktuální plochy (to, co uživatel vidí a co patří do panelu). */
export const oknaPlochy = (p = aktivniPlocha) => windows.filter((w) => w.plocha === p);
export const getPlocha = () => aktivniPlocha;

/** Přepne plochu — okna ostatních ploch se jen schovají, nezavírají. */
export function prepniPlochu(p) {
  if (p === aktivniPlocha) return;
  aktivniPlocha = p;
  for (const w of windows) w.node.classList.toggle('jina-plocha', w.plocha !== p);
  if (focused && focused.plocha !== p) {
    focused.node.classList.remove('focused');
    focused = null;
  }
  const dalsi = oknaPlochy().filter((w) => !w.minimized)
    .sort((a, b) => +b.node.style.zIndex - +a.node.style.zIndex)[0];
  if (dalsi) focus(dalsi);
  change();
}

/** Přesune okno na jinou plochu. */
export function presunNaPlochu(win, p) {
  win.plocha = p;
  win.node.classList.toggle('jina-plocha', p !== aktivniPlocha);
  if (p !== aktivniPlocha && focused === win) {
    focused.node.classList.remove('focused');
    focused = null;
  }
  change();
}

const layer = () => $('#windows');
const area = () => ({ w: innerWidth, h: innerHeight - panelMisto() });

function change() { bus.emit('wm:change', windows); }

export function getFocused() { return focused; }

/** Otevře okno pro aplikaci. app: { id, name, icon, color, width, height, mount } */
export function openWindow(app, opts = {}) {
  const { w: AW, h: AH } = area();
  const width = clamp(opts.width || app.width || 760, 320, AW - 20);
  const height = clamp(opts.height || app.height || 520, 200, AH - 20);
  const off = (cascade++ % 6) * 28;
  const left = clamp(opts.left ?? Math.round((AW - width) / 2 - 80 + off), 10, AW - width - 10);
  const top = clamp(opts.top ?? Math.round((AH - height) / 2 - 20 + off), 10, Math.max(10, AH - height - 10));

  const body = el('div.win-body');
  const titleEl = el('div.title', { text: opts.title || app.name });
  const glyph = glyfAplikace(app);

  const btnMin = el('button', { title: 'Minimalizovat' }, icon('minus'));
  const btnMax = el('button', { title: 'Maximalizovat' }, icon('square'));
  const btnClose = el('button.close', { title: 'Zavřít' }, icon('x'));

  const bar = el('div.win-bar', {}, glyph, titleEl, el('div.drag'),
    el('div.win-ctl', {}, btnMin, btnMax, btnClose));

  const node = el('div.win', {
    style: { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px', zIndex: String(++zTop) },
  }, bar, body);

  for (const d of ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se']) node.append(el('div.rs.' + d, { dataset: { dir: d } }));

  const win = {
    id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    app, node, body, opts,
    plocha: aktivniPlocha,
    get title() { return titleEl.textContent; },
    set title(v) { titleEl.textContent = v; change(); },
    minimized: false,
    maximized: false,
    restoreRect: null,
    focus() { focus(win); },
    close() { close(win); },
    minimize() { minimize(win); },
    toggleMax() { toggleMax(win); },
    setBounds(r) { Object.assign(node.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); },
  };

  btnMin.onclick = () => minimize(win);
  btnMax.onclick = () => toggleMax(win);
  btnClose.onclick = () => close(win);
  bar.addEventListener('dblclick', (e) => { if (!e.target.closest('.win-ctl')) toggleMax(win); });
  node.addEventListener('pointerdown', () => focus(win), true);
  bar.addEventListener('pointerdown', (e) => startMove(win, e));
  node.querySelectorAll('.rs').forEach((h) => h.addEventListener('pointerdown', (e) => startResize(win, e, h.dataset.dir)));
  bar.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    import('./ui.js').then(({ contextMenu }) => contextMenu([
      { icon: 'restore', label: win.maximized ? 'Obnovit' : 'Maximalizovat', onClick: () => toggleMax(win) },
      { icon: 'minus', label: 'Minimalizovat', onClick: () => minimize(win) },
      'sep',
      {
        icon: 'grid',
        label: `Přesunout na plochu ${win.plocha === 0 ? 2 : 1}`,
        onClick: () => presunNaPlochu(win, win.plocha === 0 ? 1 : 0),
      },
      'sep',
      { icon: 'x', label: 'Zavřít', key: 'Alt+F4', danger: true, onClick: () => close(win) },
    ], { x: e.clientX, y: e.clientY }));
  });

  layer().append(node);
  windows.push(win);
  focus(win);
  app.mount?.(body, win);
  change();
  return win;
}

export function focus(win) {
  if (focused === win && !win.minimized) return;
  focused?.node.classList.remove('focused');
  focused = win;
  win.node.classList.add('focused');
  win.node.style.zIndex = String(++zTop);
  if (win.minimized) restore(win);
  change();
}

export function minimize(win) {
  if (win.minimized) return;
  win.minimized = true;
  win.node.classList.add('minimizing');
  setTimeout(() => { if (win.minimized) win.node.style.display = 'none'; }, 190);
  if (focused === win) {
    focused.node.classList.remove('focused');
    focused = null;
    const next = oknaPlochy().filter((w) => !w.minimized).sort((a, b) => +b.node.style.zIndex - +a.node.style.zIndex)[0];
    if (next) focus(next);
  }
  change();
}

export function restore(win) {
  win.minimized = false;
  win.node.style.display = '';
  win.node.classList.remove('minimizing');
  change();
}

export function close(win, vynutit = false) {
  // aplikace se může zeptat na uložení (vrátí false a zavře se sama později)
  if (!vynutit && win.app.muzeZavrit && win.app.muzeZavrit(win) === false) return;
  win.app.unmount?.(win);
  win.node.classList.add('closing');
  setTimeout(() => win.node.remove(), 170);
  const i = windows.indexOf(win);
  if (i >= 0) windows.splice(i, 1);
  if (focused === win) {
    focused = null;
    const next = oknaPlochy().filter((w) => !w.minimized).sort((a, b) => +b.node.style.zIndex - +a.node.style.zIndex)[0];
    if (next) focus(next);
  }
  change();
}

export function toggleMax(win) {
  const { w: AW, h: AH } = area();
  if (win.maximized) {
    win.maximized = false;
    win.node.classList.remove('max');
    win.setBounds(win.restoreRect);
  } else {
    win.restoreRect = rectOf(win);
    win.maximized = true;
    win.node.classList.add('max');
    win.setBounds({ left: 0, top: 0, width: AW, height: AH });
  }
  win.node.classList.add('snapping');
  setTimeout(() => win.node.classList.remove('snapping'), 200);
  const b = win.node.querySelector('.win-ctl button:nth-child(2)');
  b.replaceChildren(icon(win.maximized ? 'restore' : 'square'));
  b.title = win.maximized ? 'Obnovit' : 'Maximalizovat';
  change();
}

export function minimizeAll() {
  oknaPlochy().filter((w) => !w.minimized).forEach(minimize);
}

function rectOf(win) {
  const s = win.node.style;
  return { left: parseInt(s.left, 10), top: parseInt(s.top, 10), width: parseInt(s.width, 10), height: parseInt(s.height, 10) };
}

// ---------------------------------------------------------------- přesun + přichycení
let ghost = null;

function showGhost(r) {
  if (!ghost) { ghost = el('div.snap-ghost'); layer().append(ghost); }
  Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}
function hideGhost() { ghost?.remove(); ghost = null; }

function snapZone(x, y) {
  const { w: AW, h: AH } = area();
  const m = 8;
  if (y <= m) return { left: 0, top: 0, width: AW, height: AH, kind: 'max' };
  if (x <= m) return { left: 0, top: 0, width: Math.round(AW / 2), height: AH, kind: 'left' };
  if (x >= AW - m) return { left: Math.round(AW / 2), top: 0, width: Math.round(AW / 2), height: AH, kind: 'right' };
  return null;
}

function startMove(win, e) {
  if (e.button !== 0 || e.target.closest('.win-ctl')) return;
  e.preventDefault();
  const start = rectOf(win);
  const sx = e.clientX, sy = e.clientY;
  let moved = false, zone = null;
  const { w: AW, h: AH } = area();

  win.node.classList.add('moving');
  const step = (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    moved = true;

    if (win.maximized) {
      // odtržení z maximalizace — okno se „chytne“ pod kurzor
      const r = win.restoreRect || { width: 760, height: 520 };
      win.maximized = false;
      win.node.classList.remove('max');
      const b = win.node.querySelector('.win-ctl button:nth-child(2)');
      b.replaceChildren(icon('square'));
      start.width = r.width; start.height = r.height;
      start.left = ev.clientX - r.width / 2; start.top = Math.max(0, ev.clientY - 20);
      win.setBounds({ left: start.left, top: start.top, width: start.width, height: start.height });
      return;
    }

    const left = clamp(start.left + dx, -start.width + 80, AW - 80);
    const top = clamp(start.top + dy, 0, AH - 40);
    win.node.style.left = left + 'px';
    win.node.style.top = top + 'px';

    zone = snapZone(ev.clientX, ev.clientY);
    if (zone) showGhost(zone); else hideGhost();
  };

  drag(step, (ev) => {
    if (moved) step(ev);          // poslední poloha kurzoru rozhoduje o přichycení
    win.node.classList.remove('moving');
    hideGhost();
    if (zone && moved) {
      win.restoreRect = start;
      win.node.classList.add('snapping');
      if (zone.kind === 'max') {
        win.maximized = true;
        win.node.classList.add('max');
        const b = win.node.querySelector('.win-ctl button:nth-child(2)');
        b.replaceChildren(icon('restore'));
      }
      win.setBounds(zone);
      setTimeout(() => win.node.classList.remove('snapping'), 200);
      change();
    }
  });
}

function startResize(win, e, dir) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  if (win.maximized) return;
  const start = rectOf(win);
  const sx = e.clientX, sy = e.clientY;
  const { w: AW, h: AH } = area();
  const MINW = 320, MINH = 180;

  win.node.classList.add('sizing');
  const step = (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    const r = { ...start };
    if (dir.includes('e')) r.width = clamp(start.width + dx, MINW, AW - start.left);
    if (dir.includes('s')) r.height = clamp(start.height + dy, MINH, AH - start.top);
    if (dir.includes('w')) {
      const w = clamp(start.width - dx, MINW, start.left + start.width);
      r.left = start.left + start.width - w;
      r.width = w;
    }
    if (dir.includes('n')) {
      const h = clamp(start.height - dy, MINH, start.top + start.height);
      r.top = start.top + start.height - h;
      r.height = h;
    }
    win.setBounds(r);
  };

  drag(step, (ev) => {
    step(ev);
    win.node.classList.remove('sizing');
  });
}

// okna se drží uvnitř plochy i po změně velikosti prohlížeče
addEventListener('resize', () => {
  const { w: AW, h: AH } = area();
  for (const win of windows) {
    if (win.maximized) { win.setBounds({ left: 0, top: 0, width: AW, height: AH }); continue; }
    const r = rectOf(win);
    win.setBounds({
      left: clamp(r.left, -r.width + 80, Math.max(0, AW - 80)),
      top: clamp(r.top, 0, Math.max(0, AH - 40)),
      width: Math.min(r.width, AW), height: Math.min(r.height, AH),
    });
  }
});
