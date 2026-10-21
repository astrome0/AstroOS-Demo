// AstroOS — sdílené UI prvky: kontextové menu, vyskakovací panely, toasty, tooltipy

import { $, el, clamp, bus, pred } from './util.js';
import { icon } from './icons.js';

const overlay = () => $('#overlay');

// ---------------------------------------------------------------- kontextové menu
let openMenu = null;
let openSub = null;
let menuOff = null;

export function closeMenu() {
  menuOff?.();            // jinak by hlídač starého menu zavřel to nově otevřené
  menuOff = null;
  openSub?.remove();
  openSub = null;
  openMenu?.remove();
  openMenu = null;
}

function sestavMenu(items, vnorene) {
  const menu = el('div.ctx' + (vnorene ? '.ctx-sub' : ''));
  for (const it of items) {
    if (!it) continue;
    if (it === 'sep' || it === '-') { menu.append(el('div.ctx-sep')); continue; }
    const b = el('button.ctx-item' + (it.danger ? '.danger' : '') + (it.sub ? '.ma-sub' : ''), { disabled: it.disabled },
      // barva = barevná tečka místo ikony (štítky, barvy složek)
      it.barva ? el('span.ctx-tecka', { style: { background: it.barva } })
        : it.icon ? icon(it.icon) : el('span', { style: { width: '16px', flex: 'none' } }),
      el('span', { text: it.label }),
      it.sub ? el('span.key', {}, icon('chevronRight')) : it.key ? el('span.key', { text: it.key }) : null,
    );
    if (it.sub) {
      const otevri = () => { if (!it.disabled && openSub?._od !== b) otevriSub(it.sub, b); };
      b.addEventListener('pointerenter', otevri);
      b.onclick = otevri;
    } else {
      b.onclick = () => { if (it.disabled) return; closeMenu(); it.onClick?.(); };
      if (!vnorene) b.addEventListener('pointerenter', () => { openSub?.remove(); openSub = null; });
    }
    menu.append(b);
  }
  return menu;
}

function otevriSub(items, rodic) {
  openSub?.remove();
  const sub = sestavMenu(items, true);
  sub._od = rodic;
  overlay().append(sub);
  const r = rodic.getBoundingClientRect(), s = sub.getBoundingClientRect();
  let x = r.right + 2;
  if (x + s.width > innerWidth - 6) x = r.left - s.width - 2;
  sub.style.left = Math.max(6, x) + 'px';
  sub.style.top = clamp(r.top - 5, 6, innerHeight - s.height - 6) + 'px';
  openSub = sub;
}

/**
 * items: [{ icon, label, key, onClick, disabled, danger, sub: [...] } | 'sep']
 * at: { x, y, align?: 'tl' | 'br' }
 */
export function contextMenu(items, at) {
  closeMenu();
  closePopup();

  const menu = sestavMenu(items, false);
  overlay().append(menu);
  const r = menu.getBoundingClientRect();
  let x = at.x, y = at.y;
  if (at.align === 'br') { x -= r.width; y -= r.height; menu.style.transformOrigin = 'bottom right'; }
  x = clamp(x, 6, innerWidth - r.width - 6);
  y = clamp(y, 6, innerHeight - r.height - 6);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  openMenu = menu;
  queueMicrotask(() => {
    if (openMenu !== menu) return;
    const off = (e) => { if (!menu.contains(e.target) && !openSub?.contains(e.target)) closeMenu(); };
    window.addEventListener('pointerdown', off, true);
    menuOff = () => window.removeEventListener('pointerdown', off, true);
  });
  return menu;
}

// ---------------------------------------------------------------- panely (lišta)
let openPop = null;
let popOff = null;

export function closePopup(instant = false) {
  popOff?.();
  popOff = null;
  if (!openPop) return;
  const { node, onClose } = openPop;
  openPop = null;
  onClose?.();
  if (instant) return node.remove();
  node.classList.add('closing');
  setTimeout(() => node.remove(), 170);
}

export const popupId = () => openPop?.id || null;

/** O kolik pixelů je zrovna odsunutý hlavní panel (kvůli skrývání). */
function posunPanelu(node) {
  const bar = node?.closest?.('.taskbar');
  if (!bar) return 0;
  const t = getComputedStyle(bar).transform;
  if (!t || t === 'none') return 0;
  try { return new DOMMatrixReadOnly(t).f; } catch { return 0; }
}

/**
 * Otevře panel nad hlavním panelem. Když je stejný už otevřený, zavře ho (toggle).
 * opts: { id, node, anchor, align: 'center'|'right'|'left', width, onClose }
 */
export function popup({ id, node, anchor, align = 'center', onClose }) {
  const same = openPop?.id === id;
  closePopup();
  closeMenu();
  if (same) return null;

  node.classList.add('panel');
  overlay().append(node);

  const r = node.getBoundingClientRect();
  const ar = anchor?.getBoundingClientRect();
  // Skrytý hlavní panel je odsunutý dolů (transform), ale vyskakovací panel patří
  // nad jeho normální místo — posun proto z naměřené pozice odečteme.
  const vrch = ar ? ar.top - posunPanelu(anchor) : innerHeight;
  const bottom = 8 + (innerHeight - vrch);
  let left;
  if (align === 'center') left = (ar ? ar.left + ar.width / 2 : innerWidth / 2) - r.width / 2;
  else if (align === 'right') left = innerWidth - r.width - 8;
  else left = (ar?.left ?? 8);
  node.style.left = clamp(left, 8, innerWidth - r.width - 8) + 'px';
  node.style.bottom = bottom + 'px';
  node.style.transformOrigin = align === 'right' ? 'bottom right' : 'bottom center';

  openPop = { id, node, onClose };
  queueMicrotask(() => {
    if (openPop?.node !== node) return;
    const off = (e) => {
      if (node.contains(e.target) || anchor?.contains(e.target)) return;
      closePopup();
    };
    window.addEventListener('pointerdown', off, true);
    popOff = () => window.removeEventListener('pointerdown', off, true);
  });
  bus.emit('popup', id);
  return node;
}

// ---------------------------------------------------------------- oznámení
export const notifications = [];

export function toast({ title, body, icon: ic = 'info', timeout = 5200, silent = false, onClick }) {
  const rec = { title, body, icon: ic, ts: Date.now() };
  import('./zvuk.js').then(({ zvuk }) => { if (!silent) zvuk('oznameni'); });
  notifications.unshift(rec);
  if (notifications.length > 40) notifications.pop();
  bus.emit('notif', rec);

  if (silent) return rec;
  const t = el('div.toast', {},
    el('div.ic', {}, icon(ic)),
    el('div', {}, el('h4', { text: title }), body ? el('p', { text: body }) : null),
  );
  $('#toasts').append(t);
  const kill = () => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 280);
  };
  const timer = setTimeout(kill, timeout);
  t.onclick = () => { clearTimeout(timer); kill(); onClick?.(); };
  if (onClick) t.classList.add('klikaci');
  return rec;
}

export function notifItem(n) {
  return el('div.notif-item', {},
    el('div.ic', {}, icon(n.icon || 'info')),
    el('div', {},
      el('h4', { text: n.title }),
      n.body ? el('p', { text: n.body }) : null,
      el('div.tm', { text: pred(n.ts) }),
    ),
  );
}

// ---------------------------------------------------------------- tooltip
let tipEl = null, tipTimer = null;

export function tooltip(target, text) {
  target.addEventListener('pointerenter', () => {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      hideTip();
      tipEl = el('div.tip', { text });
      overlay().append(tipEl);
      const r = target.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
      tipEl.style.left = clamp(r.left + r.width / 2 - t.width / 2, 6, innerWidth - t.width - 6) + 'px';
      tipEl.style.top = (r.top - t.height - 8) + 'px';
    }, 550);
  });
  target.addEventListener('pointerleave', hideTip);
  target.addEventListener('pointerdown', hideTip);
}

export function hideTip() {
  clearTimeout(tipTimer);
  tipEl?.remove();
  tipEl = null;
}
