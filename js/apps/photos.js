// AstroOS — Fotky (galerie obrázků z virtuálního disku)

import { el, bus, cz, clamp } from '../util.js';
import { icon } from '../icons.js';
import * as FS from '../fs.js';
import { State } from '../state.js';
import { applyWallpaper } from '../wallpapers.js';
import { toast, contextMenu } from '../ui.js';
import { tahni } from '../prenos.js';
import { presun, vlastnosti, PLOCHA } from '../soubory.js';

const PICS = FS.HOME + '/Obrázky';

export const photosApp = {
  id: 'photos', name: 'Fotky', icon: 'image', color: 'linear-gradient(145deg,#a077f0,#6a43c0)',
  cat: 'media', width: 900, height: 620,

  mount(body, win) {
    const st = { dir: win.opts?.path ? FS.dirname(win.opts.path) : PICS, vse: true, i: -1, list: [] };
    win.fotky = st;

    const grid = el('div.ph-grid');
    const info = el('div.ph-info');
    const lightbox = el('div.ph-box.hidden');
    const bVse = el('button.ph-tab', { text: 'Všechny obrázky' });
    const bSlozka = el('button.ph-tab', { text: 'Jen tahle složka' });

    bVse.onclick = () => { st.vse = true; draw(); };
    bSlozka.onclick = () => { st.vse = false; draw(); };

    const bar = el('div.ph-bar', {}, bVse, bSlozka, el('div.ph-spacer'), info);
    body.append(el('div.ph', {}, bar, grid, lightbox));

    // ---------------------------------------------------------------- seznam
    function nacti() {
      st.list = st.vse ? FS.findImages(FS.HOME) : FS.findImages(st.dir);
      st.list.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    }

    function draw() {
      nacti();
      bVse.classList.toggle('on', st.vse);
      bSlozka.classList.toggle('on', !st.vse);
      info.textContent = st.vse
        ? `${st.list.length} obrázků na disku`
        : `${FS.basename(st.dir)} · ${st.list.length} obrázků`;
      win.title = 'Fotky';

      grid.innerHTML = '';
      if (!st.list.length) {
        grid.append(el('div.ph-empty', {}, icon('image'),
          el('div', { text: 'Žádné obrázky. Zkus je nasypat do složky Obrázky.' })));
        return;
      }
      st.list.forEach((it, i) => {
        const src = FS.imageSrc(it.path);
        const t = el('button.ph-tile', {},
          el('img', { src, alt: it.name, loading: 'lazy' }),
          el('span.ph-name', { text: it.name }),
        );
        t.onclick = () => otevri(i);
        t.onpointerdown = (e) => tahni(e, {
          cesty: [it.path], vychoziKopie: true, nahled: el('span.nahled-souboru', {}, el('img', { src, alt: '' })),
        });
        t.oncontextmenu = (e) => {
          e.preventDefault();
          contextMenu([
            { icon: 'image', label: 'Otevřít', onClick: () => otevri(i) },
            { icon: 'palette', label: 'Nastavit jako tapetu', onClick: () => tapeta(it) },
            { icon: 'brush', label: 'Upravit v Malování', onClick: () => import('../apps.js').then(({ openApp }) => openApp('malovani', { path: it.path })) },
            '-',
            { icon: 'folderOpen', label: 'Ukázat ve složce', onClick: () => import('../apps.js').then(({ openApp }) => openApp('files', { path: FS.dirname(it.path) })) },
            {
              icon: 'monitor', label: 'Kopírovat na plochu',
              onClick: () => { presun([it.path], PLOCHA, { kopie: true }); toast({ title: 'Zkopírováno na plochu', body: it.name, icon: 'copy', timeout: 2200 }); },
            },
            { icon: 'info', label: 'Vlastnosti', onClick: () => vlastnosti(it.path) },
            { icon: 'trash', label: 'Vyhodit do koše', danger: true, onClick: () => { FS.remove(it.path); toast({ title: 'V koši', body: it.name, icon: 'trash' }); } },
          ], { x: e.clientX, y: e.clientY });
        };
        grid.append(t);
      });
    }

    // ---------------------------------------------------------------- prohlížeč
    function otevri(i) {
      st.i = clamp(i, 0, st.list.length - 1);
      const it = st.list[st.i];
      if (!it) return;
      const src = FS.imageSrc(it.path);
      const inf = FS.fileInfo(it.name);

      lightbox.innerHTML = '';
      lightbox.append(
        el('div.ph-top', {},
          el('div.ph-t', {}, el('b', { text: it.name }),
            el('span', { text: `${inf.kind} · ${FS.humanSize(it.size)} · ${cz.datumKratky(new Date(it.modified))}` })),
          el('div.ph-acts', {},
            el('button.ph-act', { title: 'Nastavit jako tapetu', onclick: () => tapeta(it) }, icon('palette'), el('span', { text: 'Tapeta' })),
            el('button.ph-act', { title: 'Zeptat se AstroAI na tenhle obrázek', onclick: () => import('../apps.js').then(({ openApp }) => openApp('astroai', { obrazek: it.path })) }, icon('ai'), el('span', { text: 'Zeptat se AI' })),
            el('button.ph-act', { title: 'Ukázat ve složce', onclick: () => import('../apps.js').then(({ openApp }) => openApp('files', { path: FS.dirname(it.path) })) }, icon('folderOpen')),
            el('button.ph-act', { title: 'Zavřít (Esc)', onclick: zavri }, icon('x')),
          ),
        ),
        el('div.ph-stage', {},
          el('button.ph-nav.prev', { title: 'Předchozí', onclick: () => otevri(st.i - 1 < 0 ? st.list.length - 1 : st.i - 1) }, icon('chevronLeft')),
          el('img', { src, alt: it.name }),
          el('button.ph-nav.next', { title: 'Další', onclick: () => otevri((st.i + 1) % st.list.length) }, icon('chevronRight')),
        ),
        el('div.ph-count', { text: `${st.i + 1} / ${st.list.length}` }),
      );
      lightbox.classList.remove('hidden');
    }

    function zavri() {
      lightbox.classList.add('hidden');
      st.i = -1;
    }

    function tapeta(it) {
      const src = FS.imageSrc(it.path);
      if (!src) return;
      State.patch({ customWallpaper: src, customWallpaperName: it.name, wallpaper: 'vlastni' });
      applyWallpaper('vlastni');
      toast({ title: 'Tapeta nastavena', body: it.name, icon: 'image' });
    }

    body.tabIndex = 0;
    body.onkeydown = (e) => {
      if (st.i < 0) return;
      if (e.key === 'Escape') { e.preventDefault(); zavri(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); otevri((st.i + 1) % st.list.length); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); otevri(st.i - 1 < 0 ? st.list.length - 1 : st.i - 1); }
    };

    const off = bus.on('fs:change', () => { if (body.isConnected && st.i < 0) draw(); });
    win.onClose = off;

    draw();
    if (win.opts?.path) {
      const i = st.list.findIndex((x) => x.path === FS.normalize(win.opts.path));
      if (i >= 0) otevri(i);
    }
    setTimeout(() => body.focus(), 60);

    win.ukazObrazek = (path) => {
      st.vse = true;
      draw();
      const i = st.list.findIndex((x) => x.path === FS.normalize(path));
      if (i >= 0) otevri(i);
    };
  },

  unmount(win) { win.onClose?.(); },
  reopen(win, opts) { if (opts?.path) win.ukazObrazek?.(opts.path); },
};
