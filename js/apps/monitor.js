// AstroOS — Správce úloh (seznam oken AstroOS, ukončení úloh)

import { el, bus } from '../util.js';
import { icon, glyfAplikace } from '../icons.js';
import { toast } from '../ui.js';
import { windows, close as closeWin, focus as focusWin } from '../wm.js';

export const monitorApp = {
  id: 'monitor', name: 'Správce úloh', icon: 'cpu', color: 'linear-gradient(145deg,#ef6a5a,#b8382c)',
  cat: 'system', width: 760, height: 520,

  mount(body, win) {
    let vybrany = null;       // id vybraného okna
    const obsah = el('div.mo-body');
    const paticka = el('div.mo-foot');
    body.append(el('div.mo', {}, obsah, paticka));

    function kresli() {
      const tabulka = el('div.mo-table');
      tabulka.append(el('div.mo-row.head.okna', {},
        el('div', { text: 'Okno' }), el('div', { text: 'Aplikace' }), el('div', { text: 'Stav' })));
      for (const w of windows) {
        const r = el('div.mo-row.okna' + (vybrany === w.id ? '.sel' : ''), {},
          el('div.mo-name', {},
            glyfAplikace(w.app, 'span.mo-ic', { styl: { color: '#fff' } }),
            el('span', {}, el('b', { text: w.title })),
          ),
          el('div.mo-stav', { text: w.app.name }),
          el('div.mo-stav', { text: w.minimized ? 'Minimalizováno' : 'Běží' }),
        );
        r.onclick = () => { vybrany = w.id; kresli(); };
        r.ondblclick = () => focusWin(w);
        tabulka.append(r);
      }
      // „nákaza“ ze Stáhni si víc RAM (nakaza.js): proces, který nejde ukončit
      if (document.documentElement.hasAttribute('data-nakaza-ram')) {
        const r = el('div.mo-row.okna.nk-proces', {},
          el('div.mo-name', {},
            el('span.mo-ic', { style: { background: 'linear-gradient(145deg,#3fd0c8,#1a4f8a)', color: '#fff' } }, icon('chip')),
            el('span', {}, el('b', { text: 'ramstahovac.exe' }))),
          el('div.mo-stav', { text: 'Stahuje RAM · CPU 99 %' }),
          el('div.mo-stav', { text: 'Nereaguje' }));
        r.onclick = () => toast({ title: 'Přístup odepřen', body: 'ramstahovac.exe se nedá ukončit. Zkus Astro Defender.', icon: 'shieldX' });
        tabulka.append(r);
      }
      const posun = obsah.scrollTop;
      obsah.replaceChildren(tabulka);
      obsah.scrollTop = posun;

      const okno = windows.find((w) => w.id === vybrany);
      paticka.replaceChildren(
        el('div.mo-sum', {}, el('span', {}, el('b', { text: String(windows.length) }), ' oken')),
        el('button.btn' + (okno ? '.danger' : ''), {
          text: 'Ukončit úlohu',
          disabled: !okno,
          onclick: () => { if (okno) { closeWin(okno, true); vybrany = null; kresli(); } },
        }),
      );
    }

    const off = bus.on('wm:change', () => { if (body.isConnected) kresli(); });
    win.onClose = () => off();
    kresli();
  },

  unmount(win) { win.onClose?.(); },
};
