// AstroOS — Archiv ZIP: co je uvnitř .zip a tlačítko Rozbalit vše (dvojklik na .zip v Souborech)

import { el, cz, plural } from '../util.js';
import { icon } from '../icons.js';
import * as FS from '../fs.js';
import * as Zip from '../zip.js';
import { toast } from '../ui.js';
import { glyfSouboru } from '../soubory.js';

export const archivApp = {
  id: 'archiv', name: 'Archiv ZIP', icon: 'box', color: 'linear-gradient(145deg,#f0c35c,#b07a1c)',
  cat: 'tools', width: 640, height: 520, hidden: true,

  async mount(body, win) {
    const cesta = win.opts?.path;
    const obal = el('div.zipv');
    body.append(obal);
    win.title = FS.basename(cesta || '') || 'Archiv ZIP';

    let polozky;
    try {
      const c = FS.read(cesta);
      if (!c.startsWith('data:')) throw new Error('Tenhle soubor není skutečný ZIP.');
      polozky = await Zip.prectiZip(Zip.zDataUrl(c).data);
    } catch (err) {
      obal.append(el('div.fm-empty', {}, icon('box'), el('div', { text: 'ZIP nejde otevřít' }), el('div.set-s', { text: err.message })));
      return;
    }

    const soubory = polozky.filter((p) => !p.slozka);
    const rozbaleno = soubory.reduce((s, p) => s + p.data.length, 0);
    const zabaleno = soubory.reduce((s, p) => s + p.zabaleno, 0);
    const usetreno = rozbaleno ? Math.max(0, Math.round((1 - zabaleno / rozbaleno) * 100)) : 0;

    const tlacitko = el('button.btn.primary', {}, icon('box'), el('span', { text: 'Rozbalit vše' }));
    tlacitko.onclick = async () => {
      tlacitko.disabled = true;
      try {
        const r = await Zip.rozbal(cesta);
        toast({ title: 'Rozbaleno', body: `${plural(r.souboru, ['soubor', 'soubory', 'souborů'])} → ${r.cesta.replace(FS.HOME, '~')}`, icon: 'box' });
        import('../apps.js').then(({ openApp }) => openApp('files', { path: r.cesta }));
        win.close();
      } catch (err) {
        toast({ title: 'Rozbalení se nepovedlo', body: err.message, icon: 'x' });
        tlacitko.disabled = false;
      }
    };

    obal.append(
      el('div.zipv-hlava', {},
        el('div.zipv-ic', {}, icon('box')),
        el('div', { style: { flex: '1', minWidth: '0' } },
          el('div.zipv-n', { text: FS.basename(cesta), 'data-no-i18n': true }),
          el('div.set-s', { text: `${plural(soubory.length, ['soubor', 'soubory', 'souborů'])} · ${FS.humanSize(rozbaleno)} rozbaleno · komprese ušetřila ${usetreno} %` })),
        tlacitko),
      el('div.zipv-seznam', {}, polozky.map((p) => el('div.zipv-radek' + (p.slozka ? '.slozka' : ''), {},
        el('div.zipv-glyf', {}, p.slozka ? icon('folder') : glyfSouboru('/' + p.cesta, { c: '' })),
        el('div.zipv-cesta', { text: p.cesta.replace(/\/$/, ''), 'data-no-i18n': true }),
        el('div.zipv-vel', { text: p.slozka ? '' : FS.humanSize(p.data.length) }),
        el('div.zipv-vel', { text: p.slozka ? '' : `${p.data.length ? Math.round(p.zabaleno / p.data.length * 100) : 100} %`, title: 'Velikost po kompresi' }),
        el('div.zipv-vel', { text: cz.datumKratky(new Date(p.cas)) }),
      ))),
    );
  },

  reopen(win, opts) {
    if (!opts?.path || opts.path === win.opts?.path) return;
    win.opts = opts;
    win.body.innerHTML = '';
    archivApp.mount(win.body, win);
  },
};
